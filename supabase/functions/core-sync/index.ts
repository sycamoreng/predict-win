import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Sync-Secret",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface InboundRecord {
  email?: string;
  name?: string;
  phone_number?: string;
  account_number?: string;
  active_customer_flag?: boolean;
  qualifying_transactions_count?: number;
}

interface NormalisedRecord {
  email: string;
  name: string;
  phone_number: string;
  account_number: string;
  active_customer_flag: boolean;
  is_account_valid: boolean;
  qualifying_transactions_count: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NUBAN_RE = /^\d{10}$/;

function validate(rec: InboundRecord): { ok: true; row: NormalisedRecord } | { ok: false; reason: string } {
  const email = (rec.email || "").trim().toLowerCase();
  const name = (rec.name || "").trim();
  const phone = (rec.phone_number || "").trim();
  const account = (rec.account_number || "").trim();

  if (!email || !EMAIL_RE.test(email)) return { ok: false, reason: "invalid_email" };
  if (!account) return { ok: false, reason: "missing_account_number" };

  const flag = rec.active_customer_flag ?? false;
  const txCount = Number.isFinite(rec.qualifying_transactions_count)
    ? Math.max(0, Math.floor(rec.qualifying_transactions_count as number))
    : 0;

  return {
    ok: true,
    row: {
      email,
      name: name || email.split("@")[0],
      phone_number: phone,
      account_number: account,
      active_customer_flag: !!flag,
      is_account_valid: NUBAN_RE.test(account),
      qualifying_transactions_count: txCount,
    },
  };
}

function authorise(req: Request): boolean {
  const expected = Deno.env.get("CORE_SYNC_SECRET");
  if (!expected) return true;
  const provided = req.headers.get("X-Sync-Secret") || "";
  return provided === expected;
}

async function upsertOne(row: NormalisedRecord) {
  const { error } = await supabase
    .from("synced_users")
    .upsert(
      {
        ...row,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" },
    );
  if (error) throw new Error(error.message);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (!authorise(req)) {
      return new Response(JSON.stringify({ error: "Invalid sync secret." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const route = url.pathname.split("/").pop();
    const body = await req.json().catch(() => ({}));

    if (route === "upsert") {
      const result = validate(body);
      if (!result.ok) {
        return new Response(JSON.stringify({ error: result.reason }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await upsertOne(result.row);
      return new Response(
        JSON.stringify({ success: true, email: result.row.email, is_account_valid: result.row.is_account_valid }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (route === "bulk") {
      const records: InboundRecord[] = Array.isArray(body.records) ? body.records : [];
      if (records.length === 0) {
        return new Response(JSON.stringify({ error: "records[] required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (records.length > 1000) {
        return new Response(JSON.stringify({ error: "max 1000 records per request" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const accepted: NormalisedRecord[] = [];
      const rejected: { email: string; reason: string }[] = [];
      for (const r of records) {
        const result = validate(r);
        if (result.ok) accepted.push(result.row);
        else rejected.push({ email: r.email || "", reason: result.reason });
      }

      if (accepted.length > 0) {
        const { error } = await supabase
          .from("synced_users")
          .upsert(
            accepted.map((row) => ({ ...row, updated_at: new Date().toISOString() })),
            { onConflict: "email" },
          );
        if (error) throw new Error(error.message);
      }

      return new Response(
        JSON.stringify({
          success: true,
          accepted: accepted.length,
          rejected: rejected.length,
          rejected_detail: rejected,
          invalid_accounts: accepted.filter((a) => !a.is_account_valid).map((a) => a.email),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (route === "active-customer-flag") {
      const email = (body.email || "").trim().toLowerCase();
      const flag = !!body.active_customer_flag;
      const txCountRaw = body.qualifying_transactions_count;
      const txCount = Number.isFinite(txCountRaw)
        ? Math.max(0, Math.floor(Number(txCountRaw)))
        : null;
      if (!email || !EMAIL_RE.test(email)) {
        return new Response(JSON.stringify({ error: "invalid_email" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: existing } = await supabase
        .from("synced_users")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (!existing) {
        return new Response(JSON.stringify({ error: "user_not_found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const update: Record<string, unknown> = {
        active_customer_flag: flag,
        updated_at: new Date().toISOString(),
      };
      if (txCount !== null) update.qualifying_transactions_count = txCount;
      const { error } = await supabase
        .from("synced_users")
        .update(update)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return new Response(
        JSON.stringify({
          success: true,
          email,
          active_customer_flag: flag,
          qualifying_transactions_count: txCount,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (route === "result") {
      const { winning_team_id, winning_team_name, winning_team_code, match_id, triggered_at, opted_in_users, status: batchStatus } = body;

      if (!winning_team_id || !Array.isArray(opted_in_users) || opted_in_users.length === 0) {
        return new Response(JSON.stringify({ error: "winning_team_id and opted_in_users[] required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const processed: { account_number: string; status: string }[] = [];
      const emailQueue: { event_name: string; to_email: string; data: Record<string, unknown> }[] = [];

      for (const u of opted_in_users) {
        const userStatus = u.status || batchStatus || "completed";
        const resolved = userStatus === "completed" || userStatus === "failed";

        const updatePayload: Record<string, unknown> = {
          status: userStatus === "completed" ? "completed" : userStatus === "failed" ? "failed" : "pending",
          updated_at: new Date().toISOString(),
        };
        if (resolved) updatePayload.resolved_at = new Date().toISOString();
        if (u.failure_reason) updatePayload.failure_reason = u.failure_reason;
        if (u.core_reference) updatePayload.core_reference = u.core_reference;

        const { error } = await supabase
          .from("sweep_results")
          .update(updatePayload)
          .eq("idempotency_key", u.idempotency_key);

        if (error) {
          processed.push({ account_number: u.account_number, status: "db_error" });
          continue;
        }

        processed.push({ account_number: u.account_number, status: updatePayload.status as string });

        if (resolved) {
          const { data: sweepRow } = await supabase
            .from("sweep_results")
            .select("user_id")
            .eq("idempotency_key", u.idempotency_key)
            .maybeSingle();

          let userEmail: string | null = null;
          if (sweepRow?.user_id) {
            const { data: usr } = await supabase
              .from("synced_users")
              .select("email")
              .eq("id", sweepRow.user_id)
              .maybeSingle();
            userEmail = usr?.email || null;
          }

          if (userEmail) {
            const eventName = userStatus === "completed"
              ? "team_win_sweep_completed"
              : "team_win_sweep_skipped";

            emailQueue.push({
              event_name: eventName,
              to_email: userEmail,
              data: {
                account_number: u.account_number,
                amount: u.amount,
                duration: u.duration,
                team_name: winning_team_name || "",
                team_code: winning_team_code || "",
                match_id: match_id || null,
                action: u.action,
                failure_reason: u.failure_reason || null,
                core_reference: u.core_reference || null,
              },
            });
          }
        }
      }

      // Fire emails via send-email function
      if (emailQueue.length > 0) {
        const sendEmailUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`;
        try {
          await fetch(sendEmailUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify(
              emailQueue.map((e) => ({
                event_name: e.event_name,
                to_email: e.to_email,
                dynamic_template_data: e.data,
              })),
            ),
          });
        } catch { /* best-effort */ }
      }

      return new Response(
        JSON.stringify({
          success: true,
          winning_team_id,
          match_id: match_id || null,
          processed_count: processed.length,
          processed,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: "Unknown route" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
