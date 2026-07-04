import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { pulseTrack } from "../_shared/pulse.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const SEND_EMAIL_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`;
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") || "https://play.sycamore.ng";

async function getLockBeforeKickoffMs(): Promise<number> {
  const { data } = await supabase
    .from("campaign_config")
    .select("prediction_lock_minutes")
    .eq("id", 1)
    .maybeSingle();
  const minutes = data?.prediction_lock_minutes ?? 60;
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

async function refreshUserCounters(userId: string) {
  const { data: rows } = await supabase
    .from("predictions")
    .select("points_awarded, predicted_home_score, predicted_away_score, wants_exact_score_pick, match:matches!predictions_match_id_fkey(home_score, away_score, status)")
    .eq("user_id", userId);

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

async function rescoreMatch(matchId: string) {
  const { data: match } = await supabase
    .from("matches")
    .select("*, home_team:teams!matches_home_team_id_fkey(name, code), away_team:teams!matches_away_team_id_fkey(name, code)")
    .eq("id", matchId)
    .maybeSingle();

  if (!match || match.status !== "completed") return;

  const { data: preds } = await supabase
    .from("predictions")
    .select("*, user:synced_users!predictions_user_id_fkey(email, name, username, backed_team_id)")
    .eq("match_id", matchId);

  if (!preds) return;

  const winnerId =
    match.home_score > match.away_score
      ? match.home_team_id
      : match.away_score > match.home_score
        ? match.away_team_id
        : null;

  for (const p of preds) {
    let pts = 0;

    const winnerCorrect =
      (winnerId === null && p.predicted_winner_team_id === null) ||
      (winnerId !== null && p.predicted_winner_team_id === winnerId);
    if (p.wants_winner_pick && winnerCorrect) pts += 5;

    if (
      p.wants_first_to_score_pick &&
      match.first_to_score_team_id &&
      p.predicted_first_to_score_team_id === match.first_to_score_team_id
    ) {
      pts += 10;
    }

    if (
      p.wants_exact_score_pick &&
      p.predicted_home_score === match.home_score &&
      p.predicted_away_score === match.away_score
    ) {
      pts += 15;
    }

    await supabase
      .from("predictions")
      .update({ points_awarded: pts, scored: true })
      .eq("id", p.id);

    const u = p.user as any;
    const homeTeam = (match.home_team as any).name || (match.home_team as any).code;
    const awayTeam = (match.away_team as any).name || (match.away_team as any).code;

    const winnerCorrectPts = (p.wants_winner_pick && ((winnerId === null && p.predicted_winner_team_id === null) || (winnerId !== null && p.predicted_winner_team_id === winnerId))) ? 5 : 0;
    const firstToScorePts = (p.wants_first_to_score_pick && match.first_to_score_team_id && p.predicted_first_to_score_team_id === match.first_to_score_team_id) ? 10 : 0;
    const exactScorePts = (p.wants_exact_score_pick && p.predicted_home_score === match.home_score && p.predicted_away_score === match.away_score) ? 15 : 0;

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

    // Fire sweep-trigger immediately (fire-and-forget) before the heavy backer loop
    const sweepUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/sweep-trigger`;
    fetch(sweepUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ winning_team_id: winnerId, match_id: match.id }),
    }).catch(() => {});

    const { data: backers } = await supabase
      .from("synced_users")
      .select("id, email, name, username, backed_team_wins, auto_savings_enabled, auto_savings_amount")
      .eq("backed_team_id", winnerId);

    for (const b of backers || []) {
      await supabase
        .from("synced_users")
        .update({ backed_team_wins: (b.backed_team_wins || 0) + 1, updated_at: new Date().toISOString() })
        .eq("id", b.id);

      await logEvent(b.id, "team_won", {
        email: b.email,
        name: b.name || "",
        match_id: match.id,
        match: `${(match.home_team as any).code}-${(match.away_team as any).code}`,
        team_id: winnerId,
        team_name: winnerName,
        score: `${match.home_score}-${match.away_score}`,
        backed_team_wins: (b.backed_team_wins || 0) + 1,
        amount: b.auto_savings_enabled ? b.auto_savings_amount : null,
        auto_savings_enabled: b.auto_savings_enabled || false,
      }, {
        firstName: deriveFirstName(b.name, b.username, b.email),
        teamName: winnerName,
        amount: b.auto_savings_enabled ? b.auto_savings_amount : null,
        savingsLink: `${APP_BASE_URL}/settings`,
      });
    }
  }

  const userIds = [...new Set(preds.map((p) => p.user_id))];
  for (const uid of userIds) {
    await refreshUserCounters(uid);
  }

  // Auto-eliminate the loser in knockout stages
  const KNOCKOUT_STAGES = new Set(["round_of_16", "round_of_32", "quarter_final", "semi_final", "final"]);
  if (KNOCKOUT_STAGES.has(match.stage) && winnerId) {
    const loserId = winnerId === match.home_team_id ? match.away_team_id : match.home_team_id;
    await supabase
      .from("teams")
      .update({ is_eliminated: true })
      .eq("id", loserId);
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
    const email = (body.email || "").trim().toLowerCase();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ADMIN_ONLY_ROUTES = new Set([
      "submit-result", "set-status", "admins-list", "admins-upsert",
      "admins-remove", "teams-list", "team-eliminate", "me-admin",
    ]);

    let user: any = null;
    if (!ADMIN_ONLY_ROUTES.has(route || "")) {
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
      }
      user = data;
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
        .select("kickoff_at, status, home_team_id, away_team_id, home_team:teams!matches_home_team_id_fkey(code), away_team:teams!matches_away_team_id_fkey(code)")
        .eq("id", match_id)
        .maybeSingle();

      if (!match) {
        return new Response(JSON.stringify({ error: "Match not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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

      const payload = {
        user_id: user.id,
        match_id,
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
      const validAmounts = [1000, 2000, 3000, 5000, 10000, 15000, 20000, 50000, 100000];
      const validDurations = [30, 60, 90];

      if (enabled) {
        if (!validAmounts.includes(Number(amount))) {
          return new Response(
            JSON.stringify({ error: "Amount must be 2000, 5000, or 10000." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        if (!validDurations.includes(Number(duration))) {
          return new Response(
            JSON.stringify({ error: "Duration must be 30, 60, or 90 days." }),
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
        savingsSettingsLink: `${APP_BASE_URL}/settings`,
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
