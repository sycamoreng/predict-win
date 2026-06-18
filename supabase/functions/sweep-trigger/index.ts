import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { pulseTrack } from "../_shared/pulse.ts";

/**
 * Sweep Trigger: predictor → core platform
 *
 * PRD §4.5: POST /games/fifa-predict/wins
 * When a backed team wins, this function:
 *   1. Finds all users who backed that team AND have auto_savings_enabled
 *   2. Calls the core platform webhook with the winning team + opted-in account numbers
 *   3. Logs the event (completed or skipped)
 *
 * The core platform handles the actual money movement (balance check + savings create/top-up).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CORE_API_BASE = (Deno.env.get("SYCAMORE_CORE_API_URL") || "https://api.sycamore.ng/api/v1").replace(/\/+$/, "");
const CORE_API_KEY = Deno.env.get("SYCAMORE_CORE_API_KEY") || "";
const SEND_EMAIL_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`;
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") || "https://play.sycamore.ng";

function deriveFirstName(name: string | null | undefined, username: string | null | undefined, email: string): string {
  if (name) {
    const first = name.split(" ")[0].trim();
    if (first.length >= 2 && /^[A-Za-z]/.test(first)) return first;
  }
  if (username && username.length >= 2) return username;
  return email.split("@")[0];
}

async function logEvent(userId: string | null, eventName: string, properties: Record<string, unknown>, templateData?: Record<string, unknown>) {
  const email = properties.email as string | undefined;
  let delivered = false;

  if (email) {
    try {
      const res = await fetch(SEND_EMAIL_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          event_name: eventName,
          to_email: email,
          to_name: properties.name || "",
          dynamic_template_data: templateData || { ...properties, user_id: userId },
        }),
      });
      const result = await res.json().catch(() => null);
      delivered = result?.results?.[0]?.delivered === true;
    } catch {
      delivered = false;
    }
  }

  await supabase.from("analytics_events").insert({
    user_id: userId,
    event_name: eventName,
    properties,
    delivered_to_netcore: delivered,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { winning_team_id, match_id } = body;

    if (!winning_team_id) {
      return new Response(JSON.stringify({ error: "winning_team_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: team } = await supabase
      .from("teams")
      .select("id, name, code")
      .eq("id", winning_team_id)
      .maybeSingle();

    if (!team) {
      return new Response(JSON.stringify({ error: "Team not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: optedInUsers } = await supabase
      .from("synced_users")
      .select("id, email, name, username, account_number, auto_savings_amount, auto_savings_duration, backed_team_wins")
      .eq("backed_team_id", winning_team_id)
      .eq("auto_savings_enabled", true);

    if (!optedInUsers || optedInUsers.length === 0) {
      pulseTrack("system", "sweep_no_opted_in_users", {
        winning_team_id,
        winning_team_name: team.name,
        winning_team_code: team.code,
        match_id: match_id || null,
      });
      return new Response(JSON.stringify({
        success: true,
        winning_team: team.name,
        opted_in_users: 0,
        core_triggered: false,
        reason: "no_opted_in_users",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const triggeredAt = new Date().toISOString();

    const sweepPayload = {
      winning_team_id: team.id,
      winning_team_name: team.name,
      winning_team_code: team.code,
      match_id: match_id || null,
      triggered_at: triggeredAt,
      opted_in_users: optedInUsers.map((u) => ({
        idempotency_key: `${u.account_number}_${match_id || "unknown"}`,
        account_number: u.account_number,
        amount: u.auto_savings_amount,
        duration: u.auto_savings_duration,
        backed_team_wins: u.backed_team_wins || 0,
        action: (u.backed_team_wins || 0) <= 1 ? "create" : "topup",
        plan_name: `World Cup 2026 — ${team.name}`,
      })),
    };

    // Create pending records in sweep_results
    const sweepRows = optedInUsers.map((u) => ({
      idempotency_key: `${u.account_number}_${match_id || "unknown"}`,
      user_id: u.id,
      account_number: u.account_number,
      match_id: match_id || null,
      winning_team_id: team.id,
      amount: u.auto_savings_amount,
      duration: u.auto_savings_duration,
      action: (u.backed_team_wins || 0) <= 1 ? "create" : "topup",
      status: "pending",
      triggered_at: triggeredAt,
    }));

    // Upsert so reruns don't create duplicates
    for (const row of sweepRows) {
      await supabase
        .from("sweep_results")
        .upsert(row, { onConflict: "idempotency_key" });
    }

    // Track sweep triggered for each user with full financial data
    const totalSweepAmount = optedInUsers.reduce((sum, u) => sum + (u.auto_savings_amount || 0), 0);
    pulseTrack("system", "sweep_batch_triggered", {
      winning_team_id: team.id,
      winning_team_name: team.name,
      winning_team_code: team.code,
      match_id: match_id || null,
      opted_in_user_count: optedInUsers.length,
      total_sweep_amount: totalSweepAmount,
      triggered_at: triggeredAt,
    });
    for (const u of optedInUsers) {
      pulseTrack(u.email || u.id, "sweep_triggered", {
        user_id: u.id,
        email: u.email,
        account_number: u.account_number,
        winning_team_id: team.id,
        winning_team_name: team.name,
        winning_team_code: team.code,
        match_id: match_id || null,
        auto_savings_amount: u.auto_savings_amount,
        auto_savings_duration: u.auto_savings_duration,
        backed_team_wins: u.backed_team_wins || 0,
        action: (u.backed_team_wins || 0) <= 1 ? "create" : "topup",
        triggered_at: triggeredAt,
      });
    }

    let coreResult: { ok: boolean; status: number; body: unknown } = {
      ok: false,
      status: 0,
      body: "SYCAMORE_CORE_API_URL not configured",
    };

    if (CORE_API_BASE) {
      try {
        const res = await fetch(`${CORE_API_BASE}/games/fifa-predict/wins`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": CORE_API_KEY,
          },
          body: JSON.stringify(sweepPayload),
        });
        const resBody = await res.json().catch(() => null);
        coreResult = { ok: res.ok, status: res.status, body: resBody };
      } catch (err) {
        coreResult = { ok: false, status: 0, body: (err as Error).message };
      }
    }

    // If the core call completely failed (unreachable/error), mark all as failed now
    // and send emails immediately.
    if (!coreResult.ok) {
      pulseTrack("system", "sweep_core_failed", {
        winning_team_id: team.id,
        winning_team_name: team.name,
        match_id: match_id || null,
        core_status: coreResult.status,
        error: typeof coreResult.body === "string" ? coreResult.body : JSON.stringify(coreResult.body),
        affected_users: optedInUsers.length,
        total_amount_blocked: totalSweepAmount,
      });
      for (const u of optedInUsers) {
        const idemKey = `${u.account_number}_${match_id || "unknown"}`;
        await supabase
          .from("sweep_results")
          .update({
            status: "failed",
            failure_reason: "core_unreachable",
            resolved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("idempotency_key", idemKey);

        pulseTrack(u.email || u.id, "sweep_failed", {
          user_id: u.id,
          email: u.email,
          account_number: u.account_number,
          winning_team_id: team.id,
          winning_team_name: team.name,
          match_id: match_id || null,
          auto_savings_amount: u.auto_savings_amount,
          auto_savings_duration: u.auto_savings_duration,
          reason: "core_unreachable",
          core_status: coreResult.status,
        });

        await logEvent(u.id, "team_win_sweep_skipped", {
          email: u.email,
          name: u.name || "",
          account_number: u.account_number,
          team_id: winning_team_id,
          team_name: team.name,
          match_id: match_id || null,
          amount: u.auto_savings_amount,
          duration: u.auto_savings_duration,
          reason: "core_unreachable",
        }, {
          firstName: deriveFirstName(u.name, u.username, u.email),
          amount: u.auto_savings_amount,
          lastFourDigits: (u.account_number || "").slice(-4) || null,
          fundLink: `${APP_BASE_URL}/settings`,
        });
      }
    } else {
      // Core responded -- check if it returned per-user statuses inline
      const responseUsers = (coreResult.body as any)?.opted_in_users as any[] | undefined;
      const hasInlineResults = Array.isArray(responseUsers) &&
        responseUsers.some((ru: any) => ru.status === "completed" || ru.status === "failed");

      if (hasInlineResults) {
        // Resolve immediately using inline results
        const usersByAccount = new Map(optedInUsers.map((u) => [u.account_number, u]));
        for (const ru of responseUsers!) {
          const localUser = usersByAccount.get(ru.account_number);
          const idemKey = ru.idempotency_key || `${ru.account_number}_${match_id || "unknown"}`;
          const resolved = ru.status === "completed" || ru.status === "failed";

          if (resolved) {
            await supabase
              .from("sweep_results")
              .update({
                status: ru.status,
                failure_reason: ru.failure_reason || null,
                core_reference: ru.core_reference || null,
                resolved_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("idempotency_key", idemKey);

            if (localUser) {
              const eventName = ru.status === "completed"
                ? "team_win_sweep_completed"
                : "team_win_sweep_skipped";
              pulseTrack(localUser.email || localUser.id, ru.status === "completed" ? "sweep_completed" : "sweep_failed", {
                user_id: localUser.id,
                email: localUser.email,
                account_number: localUser.account_number,
                winning_team_id: team.id,
                winning_team_name: team.name,
                match_id: match_id || null,
                auto_savings_amount: localUser.auto_savings_amount,
                auto_savings_duration: localUser.auto_savings_duration,
                action: (localUser.backed_team_wins || 0) <= 1 ? "create" : "topup",
                core_reference: ru.core_reference || null,
                failure_reason: ru.failure_reason || null,
                status: ru.status,
              });
              const lastFourDigits = (localUser.account_number || "").slice(-4) || null;
              const tplData = ru.status === "completed" ? {
                firstName: deriveFirstName(localUser.name, localUser.username, localUser.email),
                amount: localUser.auto_savings_amount,
                teamName: team.name,
                lastFourDigits,
                savingsLink: `${APP_BASE_URL}/settings`,
              } : {
                firstName: deriveFirstName(localUser.name, localUser.username, localUser.email),
                amount: localUser.auto_savings_amount,
                lastFourDigits,
                fundLink: `${APP_BASE_URL}/settings`,
              };
              await logEvent(localUser.id, eventName, {
                email: localUser.email,
                name: localUser.name || "",
                account_number: localUser.account_number,
                team_id: winning_team_id,
                team_name: team.name,
                match_id: match_id || null,
                amount: localUser.auto_savings_amount,
                duration: localUser.auto_savings_duration,
                core_reference: ru.core_reference || null,
                failure_reason: ru.failure_reason || null,
              }, tplData);
            }
          }
        }
      } else {
        // No inline results -- log dispatch, wait for callback via /core-sync/result
        for (const u of optedInUsers) {
          pulseTrack(u.email || u.id, "sweep_dispatched", {
            user_id: u.id,
            email: u.email,
            account_number: u.account_number,
            winning_team_id: team.id,
            winning_team_name: team.name,
            winning_team_code: team.code,
            match_id: match_id || null,
            auto_savings_amount: u.auto_savings_amount,
            auto_savings_duration: u.auto_savings_duration,
            action: (u.backed_team_wins || 0) <= 1 ? "create" : "topup",
          });
          await supabase.from("analytics_events").insert({
            user_id: u.id,
            event_name: "sweep_dispatched",
            properties: {
              email: u.email,
              account_number: u.account_number,
              team_id: winning_team_id,
              team_name: team.name,
              match_id: match_id || null,
              amount: u.auto_savings_amount,
            },
            delivered_to_netcore: false,
          });
        }
      }
    }

    const responseUsers = (coreResult.body as any)?.opted_in_users as any[] | undefined;
    const resolvedInline = Array.isArray(responseUsers) &&
      responseUsers.some((ru: any) => ru.status === "completed" || ru.status === "failed");

    return new Response(JSON.stringify({
      success: true,
      winning_team: team.name,
      opted_in_users: optedInUsers.length,
      core_configured: !!CORE_API_BASE,
      core_triggered: coreResult.ok,
      resolved_inline: resolvedInline,
      pending_callback: coreResult.ok && !resolvedInline,
      core_status: coreResult.status,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
