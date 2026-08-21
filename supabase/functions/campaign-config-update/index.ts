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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { fields, campaign_id } = body;
    const adminClaims = await verifySession(readAdminToken(req));
    const admin_email = adminClaims?.admin ? adminClaims.email : "";

    if (!admin_email || !fields || typeof fields !== "object") {
      return new Response(JSON.stringify({ error: "Admin sign-in and fields required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: adminUser } = await supabase
      .from("admin_users")
      .select("role")
      .eq("email", admin_email.trim().toLowerCase())
      .maybeSingle();

    if (!adminUser || !["super_admin"].includes(adminUser.role)) {
      return new Response(JSON.stringify({ error: "Not authorised" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allowedFields = [
      "predictions_enabled", "leaderboard_enabled", "team_picking_enabled",
      "public_access_enabled",
      "require_eligibility_leaderboard", "require_eligibility_chips",
      "registration_open", "campaign_ended", "name",
      "week_start_date", "prediction_lock_minutes",
      "scoring_result", "scoring_first_to_score",
      "scoring_exact_ft", "scoring_exact_aet", "scoring_exact_pen",
      "max_double_down_uses", "max_triple_captain_uses",
      "max_first_blood_uses", "max_streak_shield_uses",
      "max_last_stand_uses", "max_perfect_week_uses",
      "total_matchweeks",
      "upset_multiplier_enabled", "upset_multiplier_favourite",
      "upset_multiplier_draw", "upset_multiplier_underdog",
      "h2h_weekly_limit",
    ];
    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };

    for (const [key, value] of Object.entries(fields)) {
      if (allowedFields.includes(key)) {
        updatePayload[key] = value;
      }
    }

    if (Object.keys(updatePayload).length <= 1) {
      return new Response(JSON.stringify({ error: "No valid fields to update" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update the specific campaign, or the active one if no campaign_id provided
    let query = supabase.from("campaigns").update(updatePayload);
    if (campaign_id) {
      query = query.eq("id", campaign_id);
    } else {
      query = query.eq("is_active", true);
    }
    const { error: dbError } = await query;

    if (dbError) {
      return new Response(JSON.stringify({ error: dbError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Also update legacy campaign_config if it exists
    try {
      await supabase.from("campaign_config").update(updatePayload).eq("id", 1);
    } catch {}

    return new Response(JSON.stringify({ success: true, updated: updatePayload }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
