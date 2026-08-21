import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { verifySession, readAdminToken } from "../_shared/session.ts";

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
 *
 * Campaign-aware: reads from campaign_participants for the active campaign
 * rather than directly from synced_users.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-App-Token, X-App-Admin-Token",
};

function isServiceRoleRequest(req: Request): boolean {
  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  return token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CORE_API_BASE = Deno.env.get("SYCAMORE_CORE_API_URL") || "";
const CORE_API_KEY = Deno.env.get("SYCAMORE_CORE_API_KEY") || "";

async function getActiveCampaign() {
  const { data } = await supabase.from("campaigns").select("*").eq("is_active", true).maybeSingle();
  return data;
}

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
    const adminClaims = await verifySession(readAdminToken(req));
    if (!adminClaims?.admin && !isServiceRoleRequest(req)) {
      return new Response(JSON.stringify({ error: "Not authorised" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const url = new URL(req.url);
    const route = url.pathname.split("/").pop();

    const campaign = await getActiveCampaign();

    if (route === "single") {
      const accountNumber = (body.account_number || "").trim();
      if (!accountNumber) {
        return new Response(JSON.stringify({ error: "account_number required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Look up the user by account_number
      const { data: user } = await supabase
        .from("synced_users")
        .select("id, account_number")
        .eq("account_number", accountNumber)
        .maybeSingle();

      if (!user) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get campaign-specific participation data
      let participation: any = null;
      if (campaign) {
        const { data } = await supabase
          .from("campaign_participants")
          .select("backed_team_id, auto_savings_enabled, auto_savings_amount, auto_savings_duration, auto_savings_consented_at, backed_team:teams!campaign_participants_backed_team_id_fkey(name, code)")
          .eq("campaign_id", campaign.id)
          .eq("user_id", user.id)
          .maybeSingle();
        participation = data;
      }

      const payload = {
        account_number: user.account_number,
        backed_team: participation?.backed_team ? (participation.backed_team as any).name : null,
        backed_team_code: participation?.backed_team ? (participation.backed_team as any).code : null,
        auto_savings_enabled: participation?.auto_savings_enabled ?? false,
        auto_savings_amount: participation?.auto_savings_amount ?? null,
        auto_savings_duration: participation?.auto_savings_duration ?? null,
        auto_savings_consented_at: participation?.auto_savings_consented_at ?? null,
      };

      const result = await pushToCore(payload);
      return new Response(JSON.stringify({ success: result.ok, payload, core_response: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (route === "batch") {
      if (!campaign) {
        return new Response(JSON.stringify({ success: true, synced: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: participants } = await supabase
        .from("campaign_participants")
        .select("user_id, backed_team_id, auto_savings_enabled, auto_savings_amount, auto_savings_duration, auto_savings_consented_at, backed_team:teams!campaign_participants_backed_team_id_fkey(name, code), user:synced_users!campaign_participants_user_id_fkey(account_number)")
        .eq("campaign_id", campaign.id)
        .or("backed_team_id.not.is.null,auto_savings_enabled.eq.true");

      if (!participants || participants.length === 0) {
        return new Response(JSON.stringify({ success: true, synced: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const records = participants
        .filter((p) => p.user && (p.user as any).account_number)
        .map((p) => ({
          account_number: (p.user as any).account_number,
          backed_team: p.backed_team ? (p.backed_team as any).name : null,
          backed_team_code: p.backed_team ? (p.backed_team as any).code : null,
          auto_savings_enabled: p.auto_savings_enabled,
          auto_savings_amount: p.auto_savings_amount,
          auto_savings_duration: p.auto_savings_duration,
          auto_savings_consented_at: p.auto_savings_consented_at,
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
