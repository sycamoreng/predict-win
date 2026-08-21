import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { verifySession, readAdminToken } from "../_shared/session.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-App-Token, X-App-Admin-Token",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function resolveCampaignId(campaignId?: string): Promise<string | null> {
  if (campaignId) return campaignId;
  const { data } = await supabase
    .from("campaigns")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  return data?.id ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const route = url.pathname.replace(/^\/reports\/?/, "");
    const body = await req.json().catch(() => ({}));
    const { campaign_id, matchweek, month } = body ?? {};
    const adminClaims = await verifySession(readAdminToken(req));
    const admin_email = adminClaims?.admin ? adminClaims.email : "";

    if (!admin_email) {
      return json({ error: "Admin sign-in required" }, 401);
    }

    const { data: adminUser } = await supabase
      .from("admin_users")
      .select("email")
      .eq("email", String(admin_email).trim().toLowerCase())
      .maybeSingle();

    if (!adminUser) {
      return json({ error: "Not authorised" }, 403);
    }

    if (route === "daily-signups") {
      const cid = await resolveCampaignId(campaign_id);
      const { data, error } = await supabase.rpc("get_daily_signups", { p_campaign_id: cid });
      if (error) return json({ error: error.message }, 500);
      return json({ rows: data ?? [] });
    }

    if (route === "daily-predictions") {
      const cid = await resolveCampaignId(campaign_id);
      const { data, error } = await supabase.rpc("get_daily_predictions", { p_campaign_id: cid });
      if (error) return json({ error: error.message }, 500);
      return json({ rows: data ?? [] });
    }

    if (route === "exact-scorelines") {
      const cid = await resolveCampaignId(campaign_id);
      const { data, error } = await supabase.rpc("get_exact_scorelines_count", {
        p_campaign_id: cid,
        p_from: (body as any)?.from ?? null,
        p_to: (body as any)?.to ?? null,
      });
      if (error) return json({ error: error.message }, 500);
      return json({ count: Number(data) || 0 });
    }

    const activeCampaign = await resolveCampaignId(campaign_id);
    if (!activeCampaign) {
      return json({ error: "No campaign found" }, 404);
    }

    const rpcByRoute: Record<string, { fn: string; args: Record<string, unknown> }> = {
      participation: { fn: "report_participation", args: { p_campaign_id: activeCampaign } },
      savings: { fn: "report_savings", args: { p_campaign_id: activeCampaign } },
      leagues: { fn: "report_leagues", args: { p_campaign_id: activeCampaign } },
      groups: { fn: "report_groups", args: { p_campaign_id: activeCampaign } },
      rewards: {
        fn: "report_monthly_rewards",
        args: {
          p_campaign_id: activeCampaign,
          p_month: month === undefined || month === null || month === "" ? null : String(month),
        },
      },
      audit: {
        fn: "report_audit",
        args: {
          p_campaign_id: activeCampaign,
          p_matchweek: matchweek === undefined || matchweek === null || matchweek === ""
            ? null
            : Number(matchweek),
        },
      },
    };

    const target = rpcByRoute[route];
    if (!target) {
      return json({ error: "Unknown report" }, 404);
    }

    const { data, error } = await supabase.rpc(target.fn, target.args);
    if (error) {
      return json({ error: error.message }, 500);
    }

    return json({ campaign_id: activeCampaign, report: data });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
