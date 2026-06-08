import { createClient } from "npm:@supabase/supabase-js@2.45.4";

/**
 * Reverse-sync: predictor → core platform
 *
 * PRD §4.2 endpoint #2: POST /api/users/update
 * Pushes backed team + auto-savings opt-in & parameters to Sycamore core.
 *
 * This function reads the current state from our DB and forwards it to
 * the core platform's webhook. It can be called:
 *   - On team change (back-team)
 *   - On auto-savings toggle
 *   - Periodically as a batch sync
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

const CORE_API_BASE = Deno.env.get("SYCAMORE_CORE_API_URL") || "";
const CORE_API_KEY = Deno.env.get("SYCAMORE_CORE_API_KEY") || "";

async function pushToCore(payload: Record<string, unknown>): Promise<{ ok: boolean; status: number; body: unknown }> {
  if (!CORE_API_BASE) {
    return { ok: false, status: 0, body: "SYCAMORE_CORE_API_URL not configured" };
  }

  const res = await fetch(`${CORE_API_BASE}/api/users/update`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": CORE_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => ({ raw: await res.text().catch(() => "") }));
  return { ok: res.ok, status: res.status, body };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const url = new URL(req.url);
    const route = url.pathname.split("/").pop();

    if (route === "single") {
      const accountNumber = (body.account_number || "").trim();
      if (!accountNumber) {
        return new Response(JSON.stringify({ error: "account_number required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: user } = await supabase
        .from("synced_users")
        .select("*, backed_team:teams!synced_users_backed_team_id_fkey(name, code)")
        .eq("account_number", accountNumber)
        .maybeSingle();

      if (!user) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const payload = {
        account_number: user.account_number,
        backed_team: user.backed_team ? (user.backed_team as any).name : null,
        backed_team_code: user.backed_team ? (user.backed_team as any).code : null,
        auto_savings_enabled: user.auto_savings_enabled,
        auto_savings_amount: user.auto_savings_amount,
        auto_savings_duration: user.auto_savings_duration,
        auto_savings_consented_at: user.auto_savings_consented_at,
      };

      const result = await pushToCore(payload);
      return new Response(JSON.stringify({ success: result.ok, payload, core_response: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (route === "batch") {
      const { data: users } = await supabase
        .from("synced_users")
        .select("account_number, backed_team_id, auto_savings_enabled, auto_savings_amount, auto_savings_duration, auto_savings_consented_at, backed_team:teams!synced_users_backed_team_id_fkey(name, code)")
        .or("backed_team_id.not.is.null,auto_savings_enabled.eq.true");

      if (!users || users.length === 0) {
        return new Response(JSON.stringify({ success: true, synced: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const records = users.map((u) => ({
        account_number: u.account_number,
        backed_team: u.backed_team ? (u.backed_team as any).name : null,
        backed_team_code: u.backed_team ? (u.backed_team as any).code : null,
        auto_savings_enabled: u.auto_savings_enabled,
        auto_savings_amount: u.auto_savings_amount,
        auto_savings_duration: u.auto_savings_duration,
        auto_savings_consented_at: u.auto_savings_consented_at,
      }));

      let coreResult: { ok: boolean; status: number; body: unknown } = { ok: false, status: 0, body: null };
      if (CORE_API_BASE) {
        const res = await fetch(`${CORE_API_BASE}/api/users/update`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": CORE_API_KEY,
          },
          body: JSON.stringify({ records }),
        });
        const resBody = await res.json().catch(() => null);
        coreResult = { ok: res.ok, status: res.status, body: resBody };
      }

      return new Response(JSON.stringify({
        success: true,
        synced: records.length,
        core_configured: !!CORE_API_BASE,
        core_response: coreResult,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Use /single or /batch" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
