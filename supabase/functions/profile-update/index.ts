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
    const { user_id, email, username, social_handles } = body;

    if (!user_id || !email) {
      return new Response(JSON.stringify({ error: "user_id and email required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user_id + email match in synced_users
    const { data: existing } = await supabase
      .from("synced_users")
      .select("id, email")
      .eq("id", user_id)
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();

    if (!existing) {
      return new Response(JSON.stringify({ error: "User not found or email mismatch" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate username if provided
    if (username !== undefined) {
      const trimmed = (username || "").trim().toLowerCase();
      if (trimmed.length < 3 || trimmed.length > 24 || !/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
        return new Response(JSON.stringify({ error: "Invalid username format" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Validate social_handles if provided
    if (social_handles !== undefined && typeof social_handles !== "object") {
      return new Response(JSON.stringify({ error: "social_handles must be an object" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updatePayload: Record<string, unknown> = {};
    if (username !== undefined) {
      updatePayload.username = username.trim().toLowerCase();
      updatePayload.username_set_by_user = true;
    }
    if (social_handles !== undefined) updatePayload.social_handles = social_handles;

    if (Object.keys(updatePayload).length === 0) {
      return new Response(JSON.stringify({ error: "Nothing to update" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: dbError } = await supabase
      .from("synced_users")
      .update(updatePayload)
      .eq("id", user_id);

    if (dbError) {
      const isDuplicate = dbError.message.includes("unique") || dbError.message.includes("duplicate");
      return new Response(JSON.stringify({
        error: isDuplicate ? "Username already taken" : dbError.message,
        code: isDuplicate ? "username_taken" : "db_error",
      }), {
        status: isDuplicate ? 409 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
