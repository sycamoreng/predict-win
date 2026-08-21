import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { pulseTrack } from "../_shared/pulse.ts";
import { verifySession, readSessionToken, readAdminToken } from "../_shared/session.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-App-Token, X-App-Admin-Token",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const SEND_EMAIL_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`;
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") || "https://play.sycamore.ng";

async function getActiveCampaign() {
  const { data } = await supabase
    .from("campaigns")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();
  return data;
}

async function getLockBeforeKickoffMs(): Promise<number> {
  const campaign = await getActiveCampaign();
  const minutes = campaign?.prediction_lock_minutes ?? 60;
  return minutes * 60 * 1000;
}

function deriveFirstName(name: string | null | undefined, username: string | null | undefined, email: string): string {
  if (name) {
    const first = name.split(" ")[0].trim();
    if (first.length >= 2 && /^[A-Za-z]/.test(first)) return first;
  }
  if (username && username.length >= 2) return username;
  return email.split("@")[0];
}

async function logEvent(userId: string | null, eventName: string, properties: Record<string, unknown>, templateData?: Record<string, unknown>) {
  const email = properties.email as string | undefined;
  let delivered = false;

  if (email) {
    try {
      const res = await fetch(SEND_EMAIL_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          event_name: eventName,
          to_email: email,
          to_name: properties.name || "",
          dynamic_template_data: templateData || { ...properties, user_id: userId },
        }),
      });
      const result = await res.json().catch(() => null);
      delivered = result?.results?.[0]?.delivered === true;
    } catch {
      delivered = false;
    }
  }

  await supabase.from("analytics_events").insert({
    user_id: userId,
    event_name: eventName,
    properties,
    delivered_to_netcore: delivered,
  });
}

type AdminPermission = "manage_results" | "manage_fixtures" | "view_payouts" | "manage_admins";

const ROLE_PERMISSIONS: Record<string, AdminPermission[]> = {
  super_admin: ["manage_results", "manage_fixtures", "view_payouts", "manage_admins"],
  results: ["manage_results"],
  fixtures: ["manage_fixtures"],
  payouts: ["view_payouts"],
};

async function adminHasPermission(email: string, permission: AdminPermission): Promise<boolean> {
  const { data } = await supabase
    .from("admin_users")
    .select("role")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (!data) return false;
  return (ROLE_PERMISSIONS[data.role] || []).includes(permission);
}

async function refreshUserCounters(userId: string, campaignId?: string) {
  const cid = campaignId || (await getActiveCampaign())?.id;
  const query = supabase
    .from("predictions")
    .select("points_awarded, predicted_home_score, predicted_away_score, wants_exact_score_pick, match:matches!predictions_match_id_fkey(home_score, away_score, status)")
    .eq("user_id", userId);
  if (cid) query.eq("campaign_id", cid);
  const { data: rows } = await query;

  let total = 0;
  let correct = 0;
  let exact = 0;
  for (const r of rows || []) {
    const pts = r.points_awarded || 0;
    total += pts;
    if (pts > 0) correct++;
    const m = r.match as any;
    if (
      r.wants_exact_score_pick && m && m.status === "completed" &&
      m.home_score === r.predicted_home_score &&
      m.away_score === r.predicted_away_score
    ) {
      exact++;
    }
  }

  // Update campaign_participants
  if (cid) {
    await supabase.from("campaign_participants").update({
      total_points: total,
      correct_predictions_count: correct,
      exact_scorelines_count: exact,
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId).eq("campaign_id", cid);
  }

  // Also update synced_users for backward compat
  await supabase.from("synced_users").update({
    total_points: total,
    correct_predictions_count: correct,
    exact_scorelines_count: exact,
    updated_at: new Date().toISOString(),
  }).eq("id", userId);
}

async function eliminateGroupStageTeams() {
  const { data: groupMatches } = await supabase
    .from("matches")
    .select("id, status")
    .eq("stage", "group");

  if (!groupMatches?.length) return;

  const allDone = groupMatches.every((m) => m.status === "completed");
  if (!allDone) return;

  const KNOCKOUT_STAGES = ["round_of_16", "round_of_32", "quarter_final", "semi_final", "final"];
  const { data: knockoutMatches } = await supabase
    .from("matches")
    .select("home_team_id, away_team_id")
    .in("stage", KNOCKOUT_STAGES);

  // Safety: don't eliminate if knockout fixtures haven't been created yet
  if (!knockoutMatches?.length) return;

  const advancingIds = new Set<string>();
  for (const m of knockoutMatches || []) {
    if (m.home_team_id) advancingIds.add(m.home_team_id);
    if (m.away_team_id) advancingIds.add(m.away_team_id);
  }

  // Only eliminate if we have a reasonable number of advancing teams
  if (advancingIds.size < 16) return;

  const { data: allTeams } = await supabase
    .from("teams")
    .select("id")
    .eq("is_eliminated", false);

  for (const t of allTeams || []) {
    if (!advancingIds.has(t.id)) {
      await supabase
        .from("teams")
        .update({ is_eliminated: true })
        .eq("id", t.id);
    }
  }
}

function getWeekNumber(kickoffAt: string, weekStartDate: string): number {
  const kickoff = new Date(kickoffAt);
  const anchor = new Date(weekStartDate + "T00:00:00Z");
  const daysSince = Math.floor((kickoff.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24));
  return Math.floor(daysSince / 7) + 1;
}

async function updateUserStreak(userId: string, campaignId: string, matchId: string) {
  const { data: scoredPreds } = await supabase
    .from("predictions")
    .select("points_awarded, match:matches!predictions_match_id_fkey(kickoff_at)")
    .eq("user_id", userId)
    .eq("campaign_id", campaignId)
    .eq("scored", true)
    .order("match(kickoff_at)", { ascending: false });

  let currentStreak = 0;
  for (const p of scoredPreds || []) {
    if ((p.points_awarded || 0) > 0) {
      currentStreak++;
    } else {
      break;
    }
  }

  const { data: existing } = await supabase
    .from("user_streaks")
    .select("longest_streak")
    .eq("user_id", userId)
    .eq("campaign_id", campaignId)
    .maybeSingle();

  const longestStreak = Math.max(existing?.longest_streak || 0, currentStreak);

  await supabase.from("user_streaks").upsert({
    user_id: userId,
    campaign_id: campaignId,
    current_streak: currentStreak,
    longest_streak: longestStreak,
    last_match_id: matchId,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,campaign_id" });
}

async function resolveH2HPairings(campaignId: string, weekNumber: number, weekStartDate: string) {
  const anchor = new Date(weekStartDate + "T00:00:00Z");
  const weekStart = new Date(anchor.getTime() + (weekNumber - 1) * 7 * 24 * 60 * 60 * 1000);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const pairings: any[] = [];
  {
    const PAGE = 1000;
    let from = 0;
    while (true) {
      const { data: page } = await supabase
        .from("h2h_pairings")
        .select("*")
        .eq("campaign_id", campaignId)
        .eq("week_number", weekNumber)
        .eq("status", "active")
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (!page || page.length === 0) break;
      pairings.push(...page);
      if (page.length < PAGE) break;
      from += PAGE;
    }
  }

  if (!pairings.length) return;

  for (const pairing of pairings) {
    const { data: aPreds } = await supabase
      .from("predictions")
      .select("points_awarded, match:matches!predictions_match_id_fkey(kickoff_at)")
      .eq("user_id", pairing.player_a_id)
      .eq("campaign_id", campaignId)
      .eq("scored", true)
      .gte("match.kickoff_at", weekStart.toISOString())
      .lt("match.kickoff_at", weekEnd.toISOString());

    const { data: bPreds } = await supabase
      .from("predictions")
      .select("points_awarded, match:matches!predictions_match_id_fkey(kickoff_at)")
      .eq("user_id", pairing.player_b_id)
      .eq("campaign_id", campaignId)
      .eq("scored", true)
      .gte("match.kickoff_at", weekStart.toISOString())
      .lt("match.kickoff_at", weekEnd.toISOString());

    const aPoints = (aPreds || []).reduce((sum, p) => sum + (p.points_awarded || 0), 0);
    const bPoints = (bPreds || []).reduce((sum, p) => sum + (p.points_awarded || 0), 0);

    const winnerId = aPoints > bPoints ? pairing.player_a_id : bPoints > aPoints ? pairing.player_b_id : null;

    await supabase.from("h2h_pairings").update({
      player_a_points: aPoints,
      player_b_points: bPoints,
      winner_id: winnerId,
      status: "completed",
      resolved_at: new Date().toISOString(),
    }).eq("id", pairing.id);

    // Update standings for both players
    for (const playerId of [pairing.player_a_id, pairing.player_b_id]) {
      const isWinner = winnerId === playerId;
      const isDraw = winnerId === null;
      const pointsGained = isWinner ? 3 : isDraw ? 1 : 0;

      const { data: standing } = await supabase
        .from("h2h_standings")
        .select("h2h_points, wins, draws, losses")
        .eq("user_id", playerId)
        .eq("campaign_id", campaignId)
        .maybeSingle();

      await supabase.from("h2h_standings").upsert({
        user_id: playerId,
        campaign_id: campaignId,
        h2h_points: (standing?.h2h_points || 0) + pointsGained,
        wins: (standing?.wins || 0) + (isWinner ? 1 : 0),
        draws: (standing?.draws || 0) + (isDraw ? 1 : 0),
        losses: (standing?.losses || 0) + (!isWinner && !isDraw ? 1 : 0),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,campaign_id" });
    }
  }
}

async function rescoreMatch(matchId: string) {
  const { data: match } = await supabase
    .from("matches")
    .select("*, home_team:teams!matches_home_team_id_fkey(name, code), away_team:teams!matches_away_team_id_fkey(name, code)")
    .eq("id", matchId)
    .maybeSingle();

  if (!match || match.status !== "completed") return;

  // Load campaign scoring + gamification config
  let scoringResult = 5, scoringFTS = 10, scoringExactFT = 15, scoringExactAET = 20, scoringExactPEN = 25;
  let upsetEnabled = false, upsetUnderdog = 2.0, upsetDraw = 1.5, upsetFavourite = 1.0;
  let weekStartDate = "2026-06-11";
  if (match.campaign_id) {
    const { data: camp } = await supabase.from("campaigns").select("scoring_result, scoring_first_to_score, scoring_exact_ft, scoring_exact_aet, scoring_exact_pen, upset_multiplier_enabled, upset_multiplier_underdog, upset_multiplier_draw, upset_multiplier_favourite, week_start_date").eq("id", match.campaign_id).maybeSingle();
    if (camp) {
      scoringResult = camp.scoring_result ?? 5;
      scoringFTS = camp.scoring_first_to_score ?? 10;
      scoringExactFT = camp.scoring_exact_ft ?? 15;
      scoringExactAET = camp.scoring_exact_aet ?? 20;
      scoringExactPEN = camp.scoring_exact_pen ?? 25;
      upsetEnabled = camp.upset_multiplier_enabled ?? false;
      upsetUnderdog = Number(camp.upset_multiplier_underdog) || 2.0;
      upsetDraw = Number(camp.upset_multiplier_draw) || 1.5;
      upsetFavourite = Number(camp.upset_multiplier_favourite) || 1.0;
      weekStartDate = camp.week_start_date || "2026-06-11";
    }
  }

  const matchWeekNumber = getWeekNumber(match.kickoff_at, weekStartDate);

  const { data: preds } = await supabase
    .from("predictions")
    .select("*, user:synced_users!predictions_user_id_fkey(email, name, username)")
    .eq("match_id", matchId);

  if (!preds) return;

  const winnerId =
    match.home_score > match.away_score
      ? match.home_team_id
      : match.away_score > match.home_score
        ? match.away_team_id
        : match.penalty_winner_team_id || null;

  for (const p of preds) {
    let pts = 0;

    const winnerCorrect =
      (winnerId === null && p.predicted_winner_team_id === null) ||
      (winnerId !== null && p.predicted_winner_team_id === winnerId);
    if (p.wants_winner_pick && winnerCorrect) pts += scoringResult;

    if (
      p.wants_first_to_score_pick &&
      match.first_to_score_team_id &&
      p.predicted_first_to_score_team_id === match.first_to_score_team_id
    ) {
      pts += scoringFTS;
    }

    if (
      p.wants_exact_score_pick &&
      p.predicted_home_score === match.home_score &&
      p.predicted_away_score === match.away_score
    ) {
      if (match.finish_type === "PEN" && p.predicted_finish_type === "PEN") {
        pts += scoringExactPEN;
      } else if (match.finish_type === "AET" && p.predicted_finish_type === "AET") {
        pts += scoringExactAET;
      } else {
        pts += scoringExactFT;
      }
    }

    // Apply upset multiplier
    if (upsetEnabled && match.favourite_team_id && pts > 0 && winnerCorrect) {
      const underdogId = match.favourite_team_id === match.home_team_id
        ? match.away_team_id
        : match.home_team_id;

      if (p.predicted_winner_team_id === null && winnerId === null) {
        pts = Math.round(pts * upsetDraw);
      } else if (p.predicted_winner_team_id === underdogId && winnerId === underdogId) {
        pts = Math.round(pts * upsetUnderdog);
      } else {
        pts = Math.round(pts * upsetFavourite);
      }
    }

    // Apply chips: check for any chip this matchweek (only 1 allowed per week)
    const { data: chipActive } = await supabase
      .from("chip_activations")
      .select("id, chip_type, match_id")
      .eq("user_id", p.user_id)
      .eq("campaign_id", match.campaign_id)
      .eq("week_number", matchWeekNumber)
      .maybeSingle();
    if (chipActive && pts > 0) {
      if (chipActive.chip_type === "triple_captain" && chipActive.match_id === match.id) {
        pts = pts * 3;
      } else if (chipActive.chip_type === "double_down") {
        pts = pts * 2;
      }
    }

    await supabase
      .from("predictions")
      .update({ points_awarded: pts, scored: true })
      .eq("id", p.id);

    const u = p.user as any;
    const homeTeam = (match.home_team as any).name || (match.home_team as any).code;
    const awayTeam = (match.away_team as any).name || (match.away_team as any).code;

    const winnerCorrectPts = (p.wants_winner_pick && ((winnerId === null && p.predicted_winner_team_id === null) || (winnerId !== null && p.predicted_winner_team_id === winnerId))) ? scoringResult : 0;
    const firstToScorePts = (p.wants_first_to_score_pick && match.first_to_score_team_id && p.predicted_first_to_score_team_id === match.first_to_score_team_id) ? scoringFTS : 0;
    const exactScorePts = (p.wants_exact_score_pick && p.predicted_home_score === match.home_score && p.predicted_away_score === match.away_score)
      ? (match.finish_type === "PEN" && p.predicted_finish_type === "PEN" ? scoringExactPEN : match.finish_type === "AET" && p.predicted_finish_type === "AET" ? scoringExactAET : scoringExactFT)
      : 0;

    await logEvent(p.user_id, pts > 0 ? "prediction_correct" : "prediction_incorrect", {
      email: u?.email,
      name: u?.name || "",
      match_id: match.id,
      match: `${(match.home_team as any).code}-${(match.away_team as any).code}`,
      team_a: homeTeam,
      team_b: awayTeam,
      match_result_points: winnerCorrectPts,
      first_goalscorer_points: firstToScorePts,
      exact_scoreline_points: exactScorePts,
      total_points: pts,
      predicted_home: p.predicted_home_score,
      predicted_away: p.predicted_away_score,
      actual_home: match.home_score,
      actual_away: match.away_score,
      points_earned: pts,
      backed_team_id: u?.backed_team_id || null,
    }, pts > 0 ? {
      firstName: deriveFirstName(u?.name, u?.username, u?.email || ""),
      teamA: homeTeam,
      teamB: awayTeam,
      matchResultPoints: winnerCorrectPts,
      firstGoalscorerPoints: firstToScorePts,
      exactScorelinePoints: exactScorePts,
      totalPoints: pts,
      leaderboardLink: `${APP_BASE_URL}/leaderboard`,
    } : {
      firstName: deriveFirstName(u?.name, u?.username, u?.email || ""),
      teamA: homeTeam,
      teamB: awayTeam,
      predictLink: `${APP_BASE_URL}/predict`,
    });
  }

  if (winnerId) {
    const { data: winningTeam } = await supabase
      .from("teams")
      .select("name, code")
      .eq("id", winnerId)
      .maybeSingle();
    const winnerName = winningTeam?.name || winningTeam?.code || "Your Team";

    // Increment the per-campaign backed_team_wins FIRST — this is the single
    // source of truth for the "create vs top-up" decision, so it must be
    // updated before the sweep is fired.
    if (match.campaign_id) {
      const { data: cpBackers } = await supabase
        .from("campaign_participants")
        .select("id, backed_team_wins, auto_savings_enabled, auto_savings_amount, user:synced_users!campaign_participants_user_id_fkey(id, email, name, username)")
        .eq("campaign_id", match.campaign_id)
        .eq("backed_team_id", winnerId);

      for (const cpb of cpBackers || []) {
        const newWins = (cpb.backed_team_wins || 0) + 1;
        await supabase.from("campaign_participants").update({
          backed_team_wins: newWins,
          updated_at: new Date().toISOString(),
        }).eq("id", cpb.id);

        const bu = (cpb as any).user;
        if (bu) {
          await logEvent(bu.id, "team_won", {
            email: bu.email,
            name: bu.name || "",
            match_id: match.id,
            match: `${(match.home_team as any).code}-${(match.away_team as any).code}`,
            team_id: winnerId,
            team_name: winnerName,
            score: `${match.home_score}-${match.away_score}`,
            backed_team_wins: newWins,
            amount: cpb.auto_savings_enabled ? cpb.auto_savings_amount : null,
            auto_savings_enabled: cpb.auto_savings_enabled || false,
          }, {
            firstName: deriveFirstName(bu.name, bu.username, bu.email),
            teamName: winnerName,
            amount: cpb.auto_savings_enabled ? cpb.auto_savings_amount : null,
            savingsLink: `${APP_BASE_URL}/team`,
          });
        }
      }
    }

    // Fire sweep-trigger (fire-and-forget) after win counts are updated.
    const sweepUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/sweep-trigger`;
    fetch(sweepUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ winning_team_id: winnerId, match_id: match.id }),
    }).catch(() => {});
  }

  const userIds = [...new Set(preds.map((p) => p.user_id))];
  for (const uid of userIds) {
    await refreshUserCounters(uid, match.campaign_id);
    await updateUserStreak(uid, match.campaign_id, match.id);
  }

  // Check if all matches this week are completed -> resolve H2H
  const anchor = new Date(weekStartDate + "T00:00:00Z");
  const weekStart = new Date(anchor.getTime() + (matchWeekNumber - 1) * 7 * 24 * 60 * 60 * 1000);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const { data: weekMatches } = await supabase
    .from("matches")
    .select("id, status")
    .eq("campaign_id", match.campaign_id)
    .gte("kickoff_at", weekStart.toISOString())
    .lt("kickoff_at", weekEnd.toISOString());
  const allComplete = weekMatches?.every((m) => m.status === "completed");
  if (allComplete) {
    await resolveH2HPairings(match.campaign_id, matchWeekNumber, weekStartDate);
  }

  // Auto-eliminate the loser in knockout stages
  const KNOCKOUT_STAGES = new Set(["round_of_16", "round_of_32", "quarter_final", "semi_final", "final"]);
  if (KNOCKOUT_STAGES.has(match.stage) && winnerId) {
    const loserId = winnerId === match.home_team_id ? match.away_team_id : match.home_team_id;
    await supabase
      .from("teams")
      .update({ is_eliminated: true })
      .eq("id", loserId);

    // Also update campaign_teams
    if (match.campaign_id) {
      await supabase.from("campaign_teams").update({ is_eliminated: true })
        .eq("team_id", loserId).eq("campaign_id", match.campaign_id);
    }
  }

  // After group stage completes, eliminate teams that didn't advance
  if (match.stage === "group") {
    await eliminateGroupStageTeams();
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const route = url.pathname.split("/").pop();
    const body = await req.json().catch(() => ({}));

    const ADMIN_ONLY_ROUTES = new Set([
      "submit-result", "set-status", "admins-list", "admins-upsert",
      "admins-remove", "teams-list", "team-eliminate", "me-admin",
      "generate-h2h",
    ]);
    const isAdminRoute = ADMIN_ONLY_ROUTES.has(route || "");

    // Identity comes from a signed token issued at login, never from the
    // request body. This prevents a caller from impersonating another user.
    const userClaims = await verifySession(readSessionToken(req));
    const adminClaims = await verifySession(readAdminToken(req));

    let email: string;
    if (isAdminRoute) {
      if (!adminClaims?.admin) {
        return new Response(JSON.stringify({ error: "Admin sign-in required" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      email = (adminClaims.email || "").trim().toLowerCase();
    } else {
      if (!userClaims) {
        return new Response(JSON.stringify({ error: "Sign-in required" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      email = (userClaims.email || "").trim().toLowerCase();
    }

    if (!email) {
      return new Response(JSON.stringify({ error: "Sign-in required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let user: any = null;
    if (!isAdminRoute) {
      const { data } = await supabase
        .from("synced_users")
        .select("*, backed_team:teams!synced_users_backed_team_id_fkey(name, code)")
        .eq("email", email)
        .maybeSingle();

      if (!data) {
        const guestName = email.split("@")[0];
        const { data: inserted, error: insertErr } = await supabase
          .from("synced_users")
          .insert({
            email,
            name: guestName,
            phone_number: "",
            account_number: null,
            active_customer_flag: false,
            is_account_valid: false,
            qualifying_transactions_count: 0,
            total_points: 0,
            is_guest: true,
          })
          .select("*, backed_team:teams!synced_users_backed_team_id_fkey(name, code)")
          .single();

        if (insertErr) {
          const { data: retry } = await supabase
            .from("synced_users")
            .select("*, backed_team:teams!synced_users_backed_team_id_fkey(name, code)")
            .eq("email", email)
            .maybeSingle();
          user = retry;
        } else {
          user = inserted;
        }

        if (!user) {
          return new Response(JSON.stringify({ error: "Could not create guest user" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        user = data;
      }
    }

    if (route === "activate-chip") {
      const { chip_type = "double_down", week_number, campaign_id, match_id } = body;

      if (!campaign_id) {
        return new Response(JSON.stringify({ error: "campaign_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const validChipTypes = new Set(["double_down", "triple_captain", "first_blood", "streak_shield", "last_stand", "perfect_week"]);
      if (!validChipTypes.has(chip_type)) {
        return new Response(JSON.stringify({ error: "Invalid chip_type" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: camp } = await supabase.from("campaigns").select("max_double_down_uses, max_triple_captain_uses, max_first_blood_uses, max_streak_shield_uses, max_last_stand_uses, max_perfect_week_uses, total_matchweeks, week_start_date, prediction_lock_minutes, require_eligibility_chips").eq("id", campaign_id).maybeSingle();
      if (!camp) {
        return new Response(JSON.stringify({ error: "Campaign not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (camp.require_eligibility_chips && !user?.active_customer_flag) {
        return new Response(JSON.stringify({ error: "Power-up chips are only available to active Sycamore customers. Complete a qualifying transaction to unlock them." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Determine the effective week_number for this chip
      let effectiveWeekNumber: number;
      const lockMinutes = camp.prediction_lock_minutes ?? 60;

      if (chip_type === "triple_captain") {
        if (!match_id) {
          return new Response(JSON.stringify({ error: "match_id required for triple_captain" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const { data: matchData } = await supabase.from("matches").select("kickoff_at, status, campaign_id, matchweek").eq("id", match_id).maybeSingle();
        if (!matchData) {
          return new Response(JSON.stringify({ error: "Match not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (matchData.campaign_id !== campaign_id) {
          return new Response(JSON.stringify({ error: "Match does not belong to this campaign" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const lockTime = new Date(matchData.kickoff_at).getTime() - lockMinutes * 60 * 1000;
        if (matchData.status === "completed" || Date.now() >= lockTime) {
          return new Response(JSON.stringify({ error: "Cannot activate chip — predictions are locked for this match" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        // Use matchweek from match, or compute from week_start_date
        effectiveWeekNumber = matchData.matchweek || getWeekNumber(matchData.kickoff_at, camp.week_start_date || "2026-06-11");

        // Check TC uses remaining
        const { count: tcCount } = await supabase.from("chip_activations").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("campaign_id", campaign_id).eq("chip_type", "triple_captain");
        if ((tcCount || 0) >= (camp.max_triple_captain_uses || 1)) {
          return new Response(JSON.stringify({ error: "No Triple Captain chips remaining" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } else if (chip_type === "first_blood" || chip_type === "streak_shield" || chip_type === "last_stand" || chip_type === "perfect_week") {
        // New chip types: week-based like Double Down
        if (!week_number) {
          return new Response(JSON.stringify({ error: "week_number required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        effectiveWeekNumber = week_number;

        // Check uses remaining
        const maxUsesMap: Record<string, number> = {
          first_blood: camp.max_first_blood_uses || 3,
          streak_shield: camp.max_streak_shield_uses || 1,
          last_stand: camp.max_last_stand_uses || 1,
          perfect_week: camp.max_perfect_week_uses || 1,
        };
        const { count: chipCount } = await supabase.from("chip_activations").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("campaign_id", campaign_id).eq("chip_type", chip_type);
        if ((chipCount || 0) >= maxUsesMap[chip_type]) {
          return new Response(JSON.stringify({ error: `No ${chip_type} chips remaining` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Last Stand: only allowed in final 5 matchweeks
        if (chip_type === "last_stand") {
          const totalWeeks = camp.total_matchweeks || 38;
          if (week_number <= totalWeeks - 5) {
            return new Response(JSON.stringify({ error: "Last Stand can only be used in the final 5 matchweeks" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        }

        // Check the week hasn't started
        const { data: weekMatches2 } = await supabase.from("matches").select("kickoff_at").eq("campaign_id", campaign_id).eq("matchweek", week_number).order("kickoff_at", { ascending: true }).limit(1);
        if (weekMatches2?.length) {
          const firstLock2 = new Date(weekMatches2[0].kickoff_at).getTime() - lockMinutes * 60 * 1000;
          if (Date.now() >= firstLock2) {
            return new Response(JSON.stringify({ error: "Cannot activate chip — predictions for this week are already locked" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        }
      } else {
        // Double Down
        if (!week_number) {
          return new Response(JSON.stringify({ error: "week_number required for double_down" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        effectiveWeekNumber = week_number;

        // Check DD uses remaining
        const { count: ddCount } = await supabase.from("chip_activations").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("campaign_id", campaign_id).eq("chip_type", "double_down");
        if ((ddCount || 0) >= (camp.max_double_down_uses || 2)) {
          return new Response(JSON.stringify({ error: "No Double Down chips remaining" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Check the week hasn't started (first match lock time hasn't passed)
        const anchor = new Date((camp.week_start_date || "2026-06-11") + "T00:00:00Z");
        const weekStart = new Date(anchor.getTime() + (week_number - 1) * 7 * 24 * 60 * 60 * 1000);
        const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        const { data: weekMatches } = await supabase.from("matches").select("kickoff_at").eq("campaign_id", campaign_id).gte("kickoff_at", weekStart.toISOString()).lt("kickoff_at", weekEnd.toISOString()).order("kickoff_at", { ascending: true }).limit(1);
        if (weekMatches?.length) {
          const firstLock = new Date(weekMatches[0].kickoff_at).getTime() - lockMinutes * 60 * 1000;
          if (Date.now() >= firstLock) {
            return new Response(JSON.stringify({ error: "Cannot activate chip — predictions for this week are already locked" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        }
      }

      // CRITICAL: Only 1 chip per user per matchweek (any type)
      const { data: existingChip } = await supabase.from("chip_activations").select("id, chip_type").eq("user_id", user.id).eq("campaign_id", campaign_id).eq("week_number", effectiveWeekNumber).maybeSingle();
      if (existingChip) {
        return new Response(JSON.stringify({ error: `You already have a chip active for this matchweek. Only 1 chip per matchweek is allowed.` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const insertPayload: Record<string, unknown> = { user_id: user.id, campaign_id, chip_type, week_number: effectiveWeekNumber };
      if (chip_type === "triple_captain") insertPayload.match_id = match_id;

      const { error: insertErr } = await supabase.from("chip_activations").insert(insertPayload);
      if (insertErr) {
        if (insertErr.message.includes("idx_chip_one_per_user_per_week")) {
          return new Response(JSON.stringify({ error: "Only 1 chip per matchweek is allowed." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ error: insertErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ success: true, week_number: effectiveWeekNumber }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (route === "cancel-chip") {
      const { campaign_id, chip_type, week_number, match_id } = body;

      if (!campaign_id) {
        return new Response(JSON.stringify({ error: "campaign_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Find the chip activation
      let chipQuery = supabase.from("chip_activations").select("id, chip_type, week_number, match_id").eq("user_id", user.id).eq("campaign_id", campaign_id);
      if (chip_type === "triple_captain" && match_id) {
        chipQuery = chipQuery.eq("chip_type", "triple_captain").eq("match_id", match_id);
      } else if (week_number) {
        chipQuery = chipQuery.eq("week_number", week_number);
      } else {
        return new Response(JSON.stringify({ error: "Provide week_number or match_id to identify the chip" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: chip } = await chipQuery.maybeSingle();
      if (!chip) {
        return new Response(JSON.stringify({ error: "No active chip found to cancel" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Verify predictions are not yet locked for this matchweek
      const { data: camp } = await supabase.from("campaigns").select("week_start_date, prediction_lock_minutes").eq("id", campaign_id).maybeSingle();
      const lockMinutes2 = camp?.prediction_lock_minutes ?? 60;
      const anchor2 = new Date((camp?.week_start_date || "2026-06-11") + "T00:00:00Z");
      const weekStart2 = new Date(anchor2.getTime() + (chip.week_number - 1) * 7 * 24 * 60 * 60 * 1000);
      const weekEnd2 = new Date(weekStart2.getTime() + 7 * 24 * 60 * 60 * 1000);
      const { data: weekMatches2 } = await supabase.from("matches").select("kickoff_at").eq("campaign_id", campaign_id).gte("kickoff_at", weekStart2.toISOString()).lt("kickoff_at", weekEnd2.toISOString()).order("kickoff_at", { ascending: true }).limit(1);

      if (weekMatches2?.length) {
        const firstLock = new Date(weekMatches2[0].kickoff_at).getTime() - lockMinutes2 * 60 * 1000;
        if (Date.now() >= firstLock) {
          return new Response(JSON.stringify({ error: "Cannot cancel chip — predictions for this matchweek are already locked" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      const { error: delErr } = await supabase.from("chip_activations").delete().eq("id", chip.id);
      if (delErr) {
        return new Response(JSON.stringify({ error: delErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ success: true, cancelled_chip: chip.chip_type }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (route === "generate-h2h") {
      if (!email || !(await adminHasPermission(email, "manage_fixtures"))) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { campaign_id, week_number } = body;
      if (!campaign_id || !week_number) {
        return new Response(JSON.stringify({ error: "campaign_id and week_number required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Check no pairings already exist
      const { count: existingCount } = await supabase.from("h2h_pairings").select("id", { count: "exact", head: true }).eq("campaign_id", campaign_id).eq("week_number", week_number);
      if ((existingCount || 0) > 0) {
        return new Response(JSON.stringify({ error: "Pairings already generated for this week" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Only pair players who opted into this week (paginate to avoid the 1000-row cap)
      const playerIds: string[] = [];
      {
        const PAGE = 1000;
        let from = 0;
        while (true) {
          const { data: page } = await supabase
            .from("h2h_optins")
            .select("user_id")
            .eq("campaign_id", campaign_id)
            .eq("week_number", week_number)
            .order("user_id", { ascending: true })
            .range(from, from + PAGE - 1);
          if (!page || page.length === 0) break;
          playerIds.push(...page.map((p) => p.user_id));
          if (page.length < PAGE) break;
          from += PAGE;
        }
      }

      if (playerIds.length < 2) {
        return new Response(JSON.stringify({ error: "Not enough players opted in for this week (need at least 2)." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Shuffle
      for (let i = playerIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [playerIds[i], playerIds[j]] = [playerIds[j], playerIds[i]];
      }

      // Trim to the campaign's weekly cap (0 = unlimited) as a safety net
      const { data: campaignRow } = await supabase.from("campaigns").select("h2h_weekly_limit").eq("id", campaign_id).maybeSingle();
      const weeklyLimit = campaignRow?.h2h_weekly_limit || 0;
      let overflow = 0;
      if (weeklyLimit > 0 && playerIds.length > weeklyLimit) {
        overflow = playerIds.length - weeklyLimit;
        playerIds.length = weeklyLimit;
      }

      // Pair up
      const pairings = [];
      for (let i = 0; i < playerIds.length - 1; i += 2) {
        pairings.push({
          campaign_id,
          week_number,
          player_a_id: playerIds[i],
          player_b_id: playerIds[i + 1],
          status: "active",
        });
      }

      if (pairings.length > 0) {
        const { error: pairErr } = await supabase.from("h2h_pairings").insert(pairings);
        if (pairErr) {
          return new Response(JSON.stringify({ error: pairErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      return new Response(JSON.stringify({ success: true, pairings_created: pairings.length, bye: playerIds.length % 2 === 1 ? playerIds[playerIds.length - 1] : null, overflow }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (route === "save") {
      const {
        match_id,
        winner_team_id,
        first_to_score_team_id,
        home_score,
        away_score,
        wants_winner_pick,
        wants_first_to_score_pick,
        wants_exact_score_pick,
        predicted_finish_type,
      } = body;

      const wantsWinner = wants_winner_pick !== false;
      const wantsFirstToScore = wants_first_to_score_pick !== false;
      const wantsExactScore = wants_exact_score_pick !== false;

      if (!wantsWinner && !wantsFirstToScore && !wantsExactScore) {
        return new Response(
          JSON.stringify({ error: "Pick at least one prediction type." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: match } = await supabase
        .from("matches")
        .select("kickoff_at, status, home_team_id, away_team_id, matchweek, campaign_id, home_team:teams!matches_home_team_id_fkey(code), away_team:teams!matches_away_team_id_fkey(code)")
        .eq("id", match_id)
        .maybeSingle();

      if (!match) {
        return new Response(JSON.stringify({ error: "Match not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // MATCHWEEK ENFORCEMENT: only the current matchweek is predictable
      if (match.matchweek && match.campaign_id) {
        const { data: earlierUnfinished } = await supabase
          .from("matches")
          .select("id")
          .eq("campaign_id", match.campaign_id)
          .lt("matchweek", match.matchweek)
          .in("status", ["scheduled", "upcoming", "postponed"])
          .limit(1);

        // Determine current matchweek: lowest matchweek that has any unfinished match
        const { data: currentMwRow } = await supabase
          .from("matches")
          .select("matchweek")
          .eq("campaign_id", match.campaign_id)
          .in("status", ["scheduled", "upcoming", "postponed"])
          .order("matchweek", { ascending: true })
          .limit(1);

        const currentMatchweek = currentMwRow?.[0]?.matchweek || 1;

        if (match.matchweek !== currentMatchweek) {
          return new Response(
            JSON.stringify({ error: "Predictions are only allowed for the current matchweek." }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }

      if (match.status === "cancelled") {
        return new Response(
          JSON.stringify({ error: "This match has been cancelled — predictions are closed." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (match.status === "completed") {
        return new Response(
          JSON.stringify({ error: "Predictions are locked — match is complete." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const lockMs = await getLockBeforeKickoffMs();
      const lockTime = new Date(match.kickoff_at).getTime() - lockMs;
      if (Date.now() >= lockTime && match.status !== "postponed") {
        return new Response(
          JSON.stringify({ error: "Predictions are locked for this match." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const homeScoreNum = Math.max(0, Math.min(15, Number(home_score) || 0));
      const awayScoreNum = Math.max(0, Math.min(15, Number(away_score) || 0));

      const derivedWinner = wantsWinner
        ? (wantsExactScore
          ? (homeScoreNum > awayScoreNum
            ? match.home_team_id
            : awayScoreNum > homeScoreNum
              ? match.away_team_id
              : (predicted_finish_type === "AET" || predicted_finish_type === "PEN")
                ? (winner_team_id === match.home_team_id || winner_team_id === match.away_team_id
                  ? winner_team_id
                  : null)
                : null)
          : (winner_team_id === match.home_team_id || winner_team_id === match.away_team_id
            ? winner_team_id
            : null))
        : null;

      const firstToScoreVal = wantsFirstToScore
        ? (wantsExactScore
          ? (first_to_score_team_id === match.home_team_id && homeScoreNum > 0
            ? match.home_team_id
            : first_to_score_team_id === match.away_team_id && awayScoreNum > 0
              ? match.away_team_id
              : null)
          : (first_to_score_team_id === match.home_team_id || first_to_score_team_id === match.away_team_id
            ? first_to_score_team_id
            : null))
        : null;

      const validFinishTypes = new Set(["FT", "AET", "PEN"]);
      const finishTypeVal = wantsExactScore && validFinishTypes.has(predicted_finish_type)
        ? predicted_finish_type
        : null;

      const payload: Record<string, unknown> = {
        user_id: user.id,
        match_id,
        campaign_id: match.campaign_id,
        predicted_winner_team_id: derivedWinner,
        predicted_first_to_score_team_id: firstToScoreVal,
        predicted_home_score: homeScoreNum,
        predicted_away_score: awayScoreNum,
        predicted_finish_type: finishTypeVal,
        wants_winner_pick: wantsWinner,
        wants_first_to_score_pick: wantsFirstToScore,
        wants_exact_score_pick: wantsExactScore,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("predictions")
        .upsert(payload, { onConflict: "user_id,match_id" });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if this is the user's first prediction (for welcome email)
      const { count: predCount } = await supabase
        .from("predictions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (predCount === 1) {
        await logEvent(user.id, "welcome", {
          email: user.email,
          name: user.name,
        }, {
          firstName: deriveFirstName(user.name, user.username, user.email),
          dashboardLink: `${APP_BASE_URL}/predict`,
        });
      }

      const homeTeamName = (match.home_team as any).code;
      const awayTeamName = (match.away_team as any).code;

      // Log analytics event only (no email on each prediction — emails sent by cron at lock time)
      pulseTrack(user.email || user.id, "prediction_submitted_server", {
        user_id: user.id,
        email: user.email,
        match_id,
        match: `${homeTeamName}-${awayTeamName}`,
        team_a: homeTeamName,
        team_b: awayTeamName,
        predicted_home_score: homeScoreNum,
        predicted_away_score: awayScoreNum,
        predicted_winner_team_id: derivedWinner,
        predicted_first_to_score_team_id: firstToScoreVal,
        wants_winner_pick: wantsWinner,
        wants_first_to_score_pick: wantsFirstToScore,
        wants_exact_score_pick: wantsExactScore,
        backed_team_id: user.backed_team_id || null,
        is_first_prediction: predCount === 1,
        prediction_count: predCount || 0,
      });
      await supabase.from("analytics_events").insert({
        user_id: user.id,
        event_name: "prediction_submitted",
        properties: {
          email: user.email,
          name: user.name,
          match_id,
          match: `${homeTeamName}-${awayTeamName}`,
          team_a: homeTeamName,
          team_b: awayTeamName,
          predicted_home: homeScoreNum,
          predicted_away: awayScoreNum,
          match_result: `${homeScoreNum}-${awayScoreNum}`,
          first_goalscorer: firstToScoreVal === match.home_team_id ? homeTeamName : firstToScoreVal === match.away_team_id ? awayTeamName : "None",
          exact_scoreline: wantsExactScore ? `${homeScoreNum}-${awayScoreNum}` : "N/A",
          predicted_winner_team_id: derivedWinner,
          predicted_first_to_score_team_id: firstToScoreVal,
          wants_winner_pick: wantsWinner,
          wants_first_to_score_pick: wantsFirstToScore,
          wants_exact_score_pick: wantsExactScore,
          backed_team_id: user.backed_team_id || null,
        },
        delivered_to_netcore: false,
      });

      return new Response(JSON.stringify({ success: true, prediction: payload }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (route === "back-team") {
      const { team_id } = body;

      if (user.backed_team_id && user.backed_team_id !== team_id) {
        const { data: currentTeam } = await supabase
          .from("teams")
          .select("is_eliminated, name")
          .eq("id", user.backed_team_id)
          .maybeSingle();

        if (currentTeam && !currentTeam.is_eliminated) {
          return new Response(
            JSON.stringify({ error: `You're locked in with ${currentTeam.name}. You can only switch if your team is eliminated from the tournament.` }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }

      const updatePayload: Record<string, unknown> = {
        backed_team_id: team_id,
        updated_at: new Date().toISOString(),
      };
      if (!user.backed_team_id) {
        updatePayload.backed_team_locked_at = new Date().toISOString();
        updatePayload.backed_team_wins = 0;
      } else if (user.backed_team_id !== team_id) {
        updatePayload.backed_team_wins = 0;
        updatePayload.backed_team_locked_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("synced_users")
        .update(updatePayload)
        .eq("id", user.id);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Also update campaign_participants
      const activeCampaign = await getActiveCampaign();
      if (activeCampaign) {
        await supabase.from("campaign_participants").upsert({
          campaign_id: activeCampaign.id,
          user_id: user.id,
          ...updatePayload,
        }, { onConflict: "campaign_id,user_id" });

        // Auto-map the user into their club's system group, and remove them
        // from any other club group in this campaign (e.g. after a switch).
        // Scoped to the 'club' kind so other system-group categories
        // (countries, states, etc.) a user belongs to are left untouched.
        const { data: sysGroups } = await supabase
          .from("groups")
          .select("id, team_id")
          .eq("campaign_id", activeCampaign.id)
          .eq("is_system", true)
          .eq("system_kind", "club");

        const otherGroupIds = (sysGroups || [])
          .filter((g) => g.team_id !== team_id)
          .map((g) => g.id);
        if (otherGroupIds.length) {
          await supabase.from("group_members")
            .delete()
            .eq("user_id", user.id)
            .in("group_id", otherGroupIds);
        }

        const targetGroup = (sysGroups || []).find((g) => g.team_id === team_id);
        if (targetGroup) {
          await supabase.from("group_members").upsert({
            group_id: targetGroup.id,
            user_id: user.id,
            role: "member",
          }, { onConflict: "group_id,user_id" });
        }
      }

      const { data: backedTeam } = await supabase.from("teams").select("name, code").eq("id", team_id).maybeSingle();
      const previousTeamId = user.backed_team_id;
      const isSwitching = previousTeamId && previousTeamId !== team_id;
      pulseTrack(user.email || user.id, "team_backed_server", {
        user_id: user.id,
        email: user.email,
        team_id,
        team_name: backedTeam?.name || null,
        team_code: backedTeam?.code || null,
        previous_team_id: previousTeamId || null,
        is_first_back: !previousTeamId,
        is_switch: !!isSwitching,
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (route === "auto-savings") {
      const { enabled, amount, duration } = body;
      const validAmounts = [1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000];

      if (enabled) {
        const amt = Number(amount);
        const dur = Number(duration);
        if (!validAmounts.includes(amt)) {
          return new Response(
            JSON.stringify({ error: "Please choose a valid savings amount." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        // Lock period rule: amounts below 100,000 are fixed at 30 days;
        // amounts of 100,000 and above choose 3, 6 or 9 months (in days).
        const allowedDurations = amt >= 100000 ? [90, 180, 270] : [30];
        if (!allowedDurations.includes(dur)) {
          return new Response(
            JSON.stringify({ error: "Invalid lock period for the selected amount." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        if (!user.backed_team_id) {
          return new Response(
            JSON.stringify({ error: "You must back a team before enabling auto-savings." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }

      const payload: Record<string, unknown> = {
        auto_savings_enabled: !!enabled,
        updated_at: new Date().toISOString(),
      };
      if (enabled) {
        payload.auto_savings_amount = Number(amount);
        payload.auto_savings_duration = Number(duration);
        payload.auto_savings_consented_at = new Date().toISOString();
      } else {
        payload.auto_savings_amount = null;
        payload.auto_savings_duration = null;
      }

      const { error } = await supabase
        .from("synced_users")
        .update(payload)
        .eq("id", user.id);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Also update campaign_participants
      const activeCampaignForSavings = await getActiveCampaign();
      if (activeCampaignForSavings) {
        await supabase.from("campaign_participants").update(payload)
          .eq("user_id", user.id).eq("campaign_id", activeCampaignForSavings.id);
      }

      let backedTeamName = "";
      if (user.backed_team_id) {
        const { data: bt } = await supabase.from("teams").select("name").eq("id", user.backed_team_id).maybeSingle();
        backedTeamName = bt?.name || "";
      }

      pulseTrack(user.email || user.id, enabled ? "auto_savings_enabled_server" : "auto_savings_disabled_server", {
        user_id: user.id,
        email: user.email,
        auto_savings_enabled: !!enabled,
        auto_savings_amount: enabled ? Number(amount) : null,
        auto_savings_duration: enabled ? Number(duration) : null,
        backed_team_id: user.backed_team_id || null,
        backed_team_name: backedTeamName || null,
        account_number: user.account_number || null,
        has_account: !!user.account_number,
      });

      await logEvent(user.id, enabled ? "auto_savings_enabled" : "auto_savings_disabled", {
        email: user.email,
        name: user.name || "",
        team_name: backedTeamName,
        amount: enabled ? Number(amount) : null,
        duration: enabled ? Number(duration) : null,
        backed_team_id: user.backed_team_id,
      }, enabled ? {
        firstName: deriveFirstName(user.name, user.username, user.email),
        teamName: backedTeamName,
        amount: Number(amount),
        savingsSettingsLink: `${APP_BASE_URL}/team`,
      } : undefined);

      return new Response(JSON.stringify({ success: true, enabled: !!enabled }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (route === "submit-result") {
      if (!(await adminHasPermission(email, "manage_results"))) {
        return new Response(JSON.stringify({ error: "Not authorised." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { match_id, home_score, away_score, first_to_score_team_id } = body;

      const { error } = await supabase
        .from("matches")
        .update({
          home_score: Number(home_score),
          away_score: Number(away_score),
          first_to_score_team_id: first_to_score_team_id || null,
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", match_id);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await rescoreMatch(match_id);

      pulseTrack(email, "result_submitted", {
        admin_email: email,
        match_id,
        home_score: Number(home_score),
        away_score: Number(away_score),
        first_to_score_team_id: first_to_score_team_id || null,
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (route === "set-status") {
      if (!(await adminHasPermission(email, "manage_results"))) {
        return new Response(JSON.stringify({ error: "Not authorised." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { match_id, status, kickoff_at } = body;
      const allowed = ["scheduled", "postponed", "cancelled"];
      if (!allowed.includes(status)) {
        return new Response(JSON.stringify({ error: "Invalid status." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const update: Record<string, unknown> = {
        status,
        home_score: null,
        away_score: null,
        first_to_score_team_id: null,
        updated_at: new Date().toISOString(),
      };
      if (kickoff_at) update.kickoff_at = kickoff_at;

      const { error } = await supabase.from("matches").update(update).eq("id", match_id);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: affectedPreds } = await supabase
        .from("predictions")
        .select("user_id")
        .eq("match_id", match_id);
      const userIds = [...new Set((affectedPreds || []).map((p) => p.user_id))];

      await supabase
        .from("predictions")
        .update({ points_awarded: 0, scored: false, updated_at: new Date().toISOString() })
        .eq("match_id", match_id);

      for (const uid of userIds) {
        await refreshUserCounters(uid);
      }

      pulseTrack(email, "match_status_changed", {
        admin_email: email,
        match_id,
        new_status: status,
        kickoff_at: kickoff_at || null,
        affected_users: userIds.length,
      });

      return new Response(JSON.stringify({ success: true, status, affected_users: userIds.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (route === "admins-list") {
      if (!(await adminHasPermission(email, "manage_admins"))) {
        return new Response(JSON.stringify({ error: "Not authorised." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: admins } = await supabase
        .from("admin_users")
        .select("email, name, role, created_at")
        .order("created_at", { ascending: true });
      return new Response(
        JSON.stringify({
          success: true,
          admins: admins || [],
          available_roles: Object.keys(ROLE_PERMISSIONS),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (route === "admins-upsert") {
      if (!(await adminHasPermission(email, "manage_admins"))) {
        return new Response(JSON.stringify({ error: "Not authorised." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const targetEmail = (body.target_email || "").trim().toLowerCase();
      const targetName = (body.target_name || "").trim();
      const role = (body.role || "").trim();
      if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
        return new Response(JSON.stringify({ error: "Invalid email." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!ROLE_PERMISSIONS[role]) {
        return new Response(JSON.stringify({ error: "Invalid role." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await supabase.from("admin_users").upsert(
        { email: targetEmail, name: targetName, role },
        { onConflict: "email" },
      );
      if (error) throw new Error(error.message);
      return new Response(
        JSON.stringify({ success: true, email: targetEmail, role }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (route === "admins-remove") {
      if (!(await adminHasPermission(email, "manage_admins"))) {
        return new Response(JSON.stringify({ error: "Not authorised." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const targetEmail = (body.target_email || "").trim().toLowerCase();
      if (!targetEmail) {
        return new Response(JSON.stringify({ error: "target_email required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (targetEmail === email) {
        return new Response(JSON.stringify({ error: "You cannot remove yourself." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await supabase.from("admin_users").delete().eq("email", targetEmail);
      if (error) throw new Error(error.message);
      return new Response(
        JSON.stringify({ success: true, email: targetEmail }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (route === "teams-list") {
      if (!(await adminHasPermission(email, "manage_results"))) {
        return new Response(JSON.stringify({ error: "Not authorised." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: teams } = await supabase
        .from("teams")
        .select("id, name, code, flag_emoji, group_name, is_eliminated")
        .order("name");
      return new Response(
        JSON.stringify({ success: true, teams: teams || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (route === "team-eliminate") {
      if (!(await adminHasPermission(email, "manage_results"))) {
        return new Response(JSON.stringify({ error: "Not authorised." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { team_id, eliminated } = body;
      if (!team_id) {
        return new Response(JSON.stringify({ error: "team_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const isEliminated = eliminated !== false;
      const { error } = await supabase
        .from("teams")
        .update({ is_eliminated: isEliminated })
        .eq("id", team_id);
      if (error) throw new Error(error.message);

      const { data: team } = await supabase.from("teams").select("name, code").eq("id", team_id).maybeSingle();

      pulseTrack(email, isEliminated ? "team_eliminated_admin" : "team_reinstated_admin", {
        admin_email: email,
        team_id,
        team_name: team?.name || null,
        team_code: team?.code || null,
        is_eliminated: isEliminated,
      });

      await logEvent(null, isEliminated ? "team_eliminated" : "team_reinstated", {
        team_id,
        team_name: team?.name,
        team_code: team?.code,
        admin_email: email,
      });

      // Notify all users backing this eliminated team
      if (isEliminated && team) {
        const { data: affectedUsers } = await supabase
          .from("synced_users")
          .select("id, email, name, username")
          .eq("backed_team_id", team_id);

        for (const u of affectedUsers || []) {
          await logEvent(u.id, "team_eliminated", {
            email: u.email,
            name: u.name || "",
            team_name: team.name,
            team_code: team.code,
            team_id,
          }, {
            firstName: deriveFirstName(u.name, u.username, u.email),
            teamName: team.name,
            newTeamLink: `${APP_BASE_URL}/team`,
          });
        }
      }

      return new Response(
        JSON.stringify({ success: true, team_id, is_eliminated: isEliminated }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (route === "me-admin") {
      const { data } = await supabase
        .from("admin_users")
        .select("email, name, role")
        .eq("email", email)
        .maybeSingle();
      const role = data?.role || null;
      const permissions = role ? (ROLE_PERMISSIONS[role] || []) : [];
      return new Response(
        JSON.stringify({ success: true, admin: data || null, permissions }),
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
