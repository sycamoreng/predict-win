import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
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
    const { admin_email, fields } = body;

    if (!admin_email || !fields || typeof fields !== "object") {
      return new Response(JSON.stringify({ error: "admin_email and fields required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify admin has permission
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

    // Verify admin has active session
    const { data: session } = await supabase
      .from("admin_sessions")
      .select("admin_email")
      .eq("admin_email", admin_email.trim().toLowerCase())
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!session) {
      return new Response(JSON.stringify({ error: "No active admin session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only allow known fields
    const allowedFields = ["predictions_enabled", "leaderboard_enabled", "team_picking_enabled", "campaign_name"];
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

    const { error: dbError } = await supabase
      .from("campaign_config")
      .update(updatePayload)
      .eq("id", 1);

    if (dbError) {
      return new Response(JSON.stringify({ error: dbError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
