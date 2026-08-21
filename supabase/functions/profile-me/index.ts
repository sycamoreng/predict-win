import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { verifySession, readSessionToken } from "../_shared/session.ts";

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
    const claims = await verifySession(readSessionToken(req));
    if (!claims) {
      return new Response(JSON.stringify({ error: "Sign-in required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = claims.email.trim().toLowerCase();

    // Prefer the id in the token; fall back to email so guest rows resolve too.
    let { data: row } = await supabase
      .from("synced_users")
      .select("*")
      .eq("id", claims.uid)
      .maybeSingle();

    if (!row) {
      const byEmail = await supabase
        .from("synced_users")
        .select("*")
        .eq("email", email)
        .maybeSingle();
      row = byEmail.data;
    }

    if (!row) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ user: row }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
