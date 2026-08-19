import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { pulseTrack } from "../_shared/pulse.ts";

/**
 * Sweep Catchup: finds completed matches where a team won but opted-in users
 * have no corresponding sweep_results row — then triggers sweep-trigger for each.
 *
 * Designed to run on a cron (every 30 min) as a safety net, and also callable
 * manually for backfill.
 *
 * Campaign-aware: only processes matches and participants for the active campaign.
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

const SWEEP_TRIGGER_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/sweep-trigger`;

async function getActiveCampaign() {
  const { data } = await supabase.from("campaigns").select("*").eq("is_active", true).maybeSingle();
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const campaign = await getActiveCampaign();

    if (!campaign) {
      return new Response(JSON.stringify({ success: true, checked: 0, triggered: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find all completed matches with a decisive result (not a draw) for the active campaign
    const { data: matches } = await supabase
      .from("matches")
      .select("id, home_team_id, away_team_id, home_score, away_score, kickoff_at")
      .eq("campaign_id", campaign.id)
      .eq("status", "completed")
      .not("home_score", "is", null)
      .not("away_score", "is", null);

    if (!matches?.length) {
      return new Response(JSON.stringify({ success: true, checked: 0, triggered: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const decisiveMatches = matches.filter((m) => m.home_score !== m.away_score);

    let triggered = 0;
    const details: { match_id: string; winning_team_id: string; users_affected: number }[] = [];

    for (const match of decisiveMatches) {
      const winningTeamId = match.home_score > match.away_score
        ? match.home_team_id
        : match.away_team_id;

      // Find opted-in campaign participants who backed this winning team
      const { data: optedInUsers } = await supabase
        .from("campaign_participants")
        .select("user_id")
        .eq("campaign_id", campaign.id)
        .eq("backed_team_id", winningTeamId)
        .eq("auto_savings_enabled", true);

      if (!optedInUsers?.length) continue;

      // Check if sweep_results already exist for this match + these users
      const { data: existingResults } = await supabase
        .from("sweep_results")
        .select("user_id")
        .eq("match_id", match.id)
        .in("user_id", optedInUsers.map((u) => u.user_id));

      const existingUserIds = new Set((existingResults || []).map((r) => r.user_id));
      const missedUsers = optedInUsers.filter((u) => !existingUserIds.has(u.user_id));

      if (missedUsers.length === 0) continue;

      // Trigger sweep for this match
      try {
        const res = await fetch(SWEEP_TRIGGER_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ winning_team_id: winningTeamId, match_id: match.id }),
        });

        if (res.ok) {
          triggered++;
          details.push({
            match_id: match.id,
            winning_team_id: winningTeamId,
            users_affected: missedUsers.length,
          });
        } else {
          const errText = await res.text().catch(() => "");
          pulseTrack("system", "sweep_catchup_trigger_failed", {
            match_id: match.id,
            winning_team_id: winningTeamId,
            missed_users: missedUsers.length,
            status: res.status,
            error: errText,
          });
        }
      } catch (err) {
        pulseTrack("system", "sweep_catchup_trigger_error", {
          match_id: match.id,
          winning_team_id: winningTeamId,
          missed_users: missedUsers.length,
          error: (err as Error).message,
        });
      }
    }

    if (triggered > 0) {
      const totalUsers = details.reduce((sum, d) => sum + d.users_affected, 0);
      pulseTrack("system", "sweep_catchup_completed", {
        decisive_matches_checked: decisiveMatches.length,
        matches_triggered: triggered,
        total_users_affected: totalUsers,
        details,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      checked: decisiveMatches.length,
      triggered,
      details,
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
