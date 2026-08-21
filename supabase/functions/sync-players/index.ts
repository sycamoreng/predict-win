import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifySession, readAdminToken } from "../_shared/session.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-App-Token, X-App-Admin-Token",
};

function isServiceRoleRequest(req: Request): boolean {
  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  return token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
}

const API_BASE = "https://v3.football.api-sports.io";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function callApi(path: string): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "x-apisports-key": Deno.env.get("FOOTBALL_API_KEY")! },
  });
  if (!res.ok) {
    throw new Error(`api-football ${path} returned ${res.status}`);
  }
  return await res.json();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    const campaignId: string | undefined = body.campaign_id;
    const force: boolean = body.force === true;
    if (!campaignId) {
      return new Response(JSON.stringify({ error: "campaign_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: teamRows, error: teamErr } = await supabase
      .from("campaign_teams")
      .select("team:teams!campaign_teams_team_id_fkey(id, name, api_football_id)")
      .eq("campaign_id", campaignId);
    if (teamErr) throw teamErr;

    const teams = (teamRows || [])
      .map((r: any) => r.team)
      .filter((t: any) => t && t.api_football_id);

    let playersUpserted = 0;
    let teamsProcessed = 0;
    let teamsSkipped = 0;
    const failures: string[] = [];

    for (const team of teams) {
      try {
        if (!force) {
          const { count: existing } = await supabase
            .from("players")
            .select("id", { count: "exact", head: true })
            .eq("campaign_id", campaignId)
            .eq("team_id", team.id);
          if ((existing || 0) > 0) {
            teamsSkipped++;
            continue;
          }
        }
        const json = await callApi(`/players/squads?team=${team.api_football_id}`);
        const squad = json?.response?.[0]?.players || [];
        if (squad.length === 0) {
          failures.push(`${team.name}: no squad returned`);
        } else {
          const rows = squad
            .filter((p: any) => p?.id && p?.name)
            .map((p: any) => ({
              campaign_id: campaignId,
              team_id: team.id,
              api_football_id: p.id,
              name: p.name,
              position: p.position || null,
              photo_url: p.photo || null,
              number: p.number ?? null,
              active: true,
              updated_at: new Date().toISOString(),
            }));
          const { error: upErr } = await supabase
            .from("players")
            .upsert(rows, { onConflict: "campaign_id,api_football_id" });
          if (upErr) {
            failures.push(`${team.name}: ${upErr.message}`);
          } else {
            playersUpserted += rows.length;
          }
        }
        teamsProcessed++;
        await sleep(350);
      } catch (err) {
        failures.push(`${team.name}: ${(err as Error).message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        teams_total: teams.length,
        teams_processed: teamsProcessed,
        teams_skipped: teamsSkipped,
        players_upserted: playersUpserted,
        failures,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
