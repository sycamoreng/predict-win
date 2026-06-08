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

const API_BASE = "https://v3.football.api-sports.io";
const DEFAULT_LEAGUE = 1;
const DEFAULT_SEASON = 2026;
const COMPLETED_STATUSES = new Set(["FT", "AET", "PEN"]);
const SEND_EMAIL_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`;

async function logEvent(userId: string | null, eventName: string, properties: Record<string, unknown>) {
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
          dynamic_template_data: { ...properties, user_id: userId },
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

async function refreshUserCounters(userId: string) {
  const { data: rows } = await supabase
    .from("predictions")
    .select("points_awarded, predicted_home_score, predicted_away_score, match:matches!predictions_match_id_fkey(home_score, away_score, status)")
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
      m && m.status === "completed" &&
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

const FLAG_BY_NAME: Record<string, string> = {
  argentina: "🇦🇷", australia: "🇦🇺", austria: "🇦🇹", belgium: "🇧🇪",
  brazil: "🇧🇷", cameroon: "🇨🇲", canada: "🇨🇦", chile: "🇨🇱",
  colombia: "🇨🇴", "costa rica": "🇨🇷", "cote d'ivoire": "🇨🇮",
  croatia: "🇭🇷", denmark: "🇩🇰", "dr congo": "🇨🇩", ecuador: "🇪🇨",
  egypt: "🇪🇬", england: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", france: "🇫🇷", germany: "🇩🇪",
  ghana: "🇬🇭", greece: "🇬🇷", iceland: "🇮🇸", iran: "🇮🇷", iraq: "🇮🇶",
  italy: "🇮🇹", "ivory coast": "🇨🇮", jamaica: "🇯🇲", japan: "🇯🇵",
  jordan: "🇯🇴", "korea republic": "🇰🇷", "south korea": "🇰🇷",
  mexico: "🇲🇽", morocco: "🇲🇦", netherlands: "🇳🇱", "new zealand": "🇳🇿",
  nigeria: "🇳🇬", norway: "🇳🇴", panama: "🇵🇦", paraguay: "🇵🇾",
  peru: "🇵🇪", poland: "🇵🇱", portugal: "🇵🇹", qatar: "🇶🇦",
  "republic of ireland": "🇮🇪", "saudi arabia": "🇸🇦", scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  senegal: "🇸🇳", serbia: "🇷🇸", slovakia: "🇸🇰", slovenia: "🇸🇮",
  "south africa": "🇿🇦", spain: "🇪🇸", sweden: "🇸🇪", switzerland: "🇨🇭",
  tunisia: "🇹🇳", turkey: "🇹🇷", "türkiye": "🇹🇷", uae: "🇦🇪",
  ukraine: "🇺🇦", uruguay: "🇺🇾", "usa": "🇺🇸", "united states": "🇺🇸",
  venezuela: "🇻🇪", wales: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
  algeria: "🇩🇿", "bosnia & herzegovina": "🇧🇦", "bosnia and herzegovina": "🇧🇦",
  "cape verde islands": "🇨🇻", "cape verde": "🇨🇻", "congo dr": "🇨🇩",
  "curaçao": "🇨🇼", curacao: "🇨🇼", "czech republic": "🇨🇿",
  haiti: "🇭🇹", uzbekistan: "🇺🇿", honduras: "🇭🇳", bolivia: "🇧🇴",
  china: "🇨🇳", "korea dpr": "🇰🇵", indonesia: "🇮🇩", india: "🇮🇳",
  "trinidad and tobago": "🇹🇹", "el salvador": "🇸🇻", guatemala: "🇬🇹",
  "dominican republic": "🇩🇴", bahrain: "🇧🇭", oman: "🇴🇲",
  "burkina faso": "🇧🇫", mali: "🇲🇱", mozambique: "🇲🇿",
  tanzania: "🇹🇿", uganda: "🇺🇬", kenya: "🇰🇪",
};

function flagFor(name: string): string {
  return FLAG_BY_NAME[(name || "").toLowerCase().trim()] || "⚽";
}

function normalize(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z]/g, "");
}

function shortCode(name: string): string {
  const cleaned = (name || "").replace(/[^A-Za-z]/g, "").toUpperCase();
  return cleaned.slice(0, 3) || "TBD";
}

function deriveStage(round: string): string {
  const r = (round || "").toLowerCase();
  if (r.includes("final") && !r.includes("semi") && !r.includes("quarter")) return "final";
  if (r.includes("semi")) return "semi_final";
  if (r.includes("quarter")) return "quarter_final";
  if (r.includes("16") || r.includes("round of 16")) return "round_of_16";
  if (r.includes("32")) return "round_of_32";
  if (r.includes("group")) return "group";
  return "group";
}

function deriveGroup(round: string): string {
  const m = (round || "").match(/group\s+([A-Z])/i);
  return m ? m[1].toUpperCase() : "";
}

interface ApiTeam {
  id: number;
  name: string;
}

interface ApiFixture {
  fixture: { id: number; date: string; status: { short: string } };
  league: { round: string };
  teams: { home: ApiTeam; away: ApiTeam };
  goals: { home: number | null; away: number | null };
}

interface ApiEvent {
  time: { elapsed: number };
  team: { id: number; name: string };
  type: string;
}

async function callApi(path: string): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "x-apisports-key": Deno.env.get("FOOTBALL_API_KEY")! },
  });
  if (!res.ok) {
    throw new Error(`api-football ${path} returned ${res.status}`);
  }
  return await res.json();
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

const ROUTE_PERMISSIONS: Record<string, AdminPermission> = {
  debug: "manage_fixtures",
  leagues: "manage_fixtures",
  import: "manage_fixtures",
  "sync-fixtures": "manage_fixtures",
  simulate: "manage_fixtures",
};

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

  const advancingIds = new Set<string>();
  for (const m of knockoutMatches || []) {
    if (m.home_team_id) advancingIds.add(m.home_team_id);
    if (m.away_team_id) advancingIds.add(m.away_team_id);
  }

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
    .select("*, user:synced_users!predictions_user_id_fkey(email, backed_team_id)")
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
    if (winnerCorrect) pts += 5;

    if (
      match.first_to_score_team_id &&
      p.predicted_first_to_score_team_id === match.first_to_score_team_id
    ) {
      pts += 10;
    }

    if (
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
    await logEvent(p.user_id, pts > 0 ? "prediction_correct" : "prediction_incorrect", {
      email: u?.email,
      match_id: match.id,
      match: `${(match.home_team as any).code}-${(match.away_team as any).code}`,
      predicted_home: p.predicted_home_score,
      predicted_away: p.predicted_away_score,
      predicted_winner_team_id: p.predicted_winner_team_id,
      predicted_first_to_score_team_id: p.predicted_first_to_score_team_id,
      actual_home: match.home_score,
      actual_away: match.away_score,
      points_earned: pts,
      backed_team_id: u?.backed_team_id || null,
    });
  }

  if (winnerId) {
    const { data: backers } = await supabase
      .from("synced_users")
      .select("id, email, backed_team_wins")
      .eq("backed_team_id", winnerId);

    for (const b of backers || []) {
      await supabase
        .from("synced_users")
        .update({ backed_team_wins: (b.backed_team_wins || 0) + 1, updated_at: new Date().toISOString() })
        .eq("id", b.id);

      await logEvent(b.id, "team_won", {
        email: b.email,
        match_id: match.id,
        match: `${(match.home_team as any).code}-${(match.away_team as any).code}`,
        team_id: winnerId,
        score: `${match.home_score}-${match.away_score}`,
        backed_team_wins: (b.backed_team_wins || 0) + 1,
      });
    }

    // Trigger auto-savings sweep for opted-in users
    try {
      const sweepUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/sweep-trigger`;
      await fetch(sweepUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ winning_team_id: winnerId, match_id: match.id }),
      });
    } catch { /* sweep is best-effort */ }
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

async function importFixtures(league: number, season: number) {
  const fx = await callApi(`/fixtures?league=${league}&season=${season}`);
  const apiFixtures: ApiFixture[] = fx.response || [];

  if (apiFixtures.length === 0) {
    throw new Error(
      `api-football returned no fixtures for league=${league} season=${season}.`,
    );
  }

  await supabase.from("predictions").delete().gt("created_at", "1900-01-01");
  await supabase.from("sweep_results").delete().gt("created_at", "1900-01-01");
  await supabase.from("matches").delete().gt("created_at", "1900-01-01");
  await supabase.from("teams").delete().gt("created_at", "1900-01-01");
  await supabase.from("synced_users").update({
    total_points: 0,
    correct_predictions_count: 0,
    exact_scorelines_count: 0,
    backed_team_id: null,
    updated_at: new Date().toISOString(),
  }).gt("created_at", "1900-01-01");

  const uniqueTeams = new Map<number, { name: string; group: string }>();
  for (const f of apiFixtures) {
    const grp = deriveGroup(f.league.round);
    for (const t of [f.teams.home, f.teams.away]) {
      const existing = uniqueTeams.get(t.id);
      if (!existing) {
        uniqueTeams.set(t.id, { name: t.name, group: grp });
      } else if (!existing.group && grp) {
        existing.group = grp;
      }
    }
  }

  const usedCodes = new Set<string>();
  const teamRows = [...uniqueTeams.entries()].map(([id, t]) => {
    let code = shortCode(t.name);
    if (usedCodes.has(code)) {
      const cleaned = (t.name || "").replace(/[^A-Za-z]/g, "").toUpperCase();
      for (let len = 4; len <= cleaned.length; len++) {
        const candidate = cleaned.slice(0, len);
        if (!usedCodes.has(candidate)) { code = candidate; break; }
      }
    }
    usedCodes.add(code);
    return {
      api_football_id: id,
      name: t.name,
      code,
      flag_emoji: flagFor(t.name),
      group_name: t.group,
    };
  });

  const { data: insertedTeams, error: teamErr } = await supabase
    .from("teams")
    .insert(teamRows)
    .select("id, api_football_id");

  if (teamErr) throw new Error(`Team insert failed: ${teamErr.message}`);

  const teamIdByApiId = new Map<number, string>();
  for (const t of insertedTeams || []) {
    teamIdByApiId.set(t.api_football_id, t.id);
  }

  const matchRows = apiFixtures.map((f) => ({
    api_football_id: f.fixture.id,
    home_team_id: teamIdByApiId.get(f.teams.home.id)!,
    away_team_id: teamIdByApiId.get(f.teams.away.id)!,
    kickoff_at: f.fixture.date,
    stage: deriveStage(f.league.round),
    status: COMPLETED_STATUSES.has(f.fixture.status.short) ? "completed" : "scheduled",
    home_score: COMPLETED_STATUSES.has(f.fixture.status.short) ? f.goals.home : null,
    away_score: COMPLETED_STATUSES.has(f.fixture.status.short) ? f.goals.away : null,
  }));

  const { error: matchErr } = await supabase.from("matches").insert(matchRows);
  if (matchErr) throw new Error(`Match insert failed: ${matchErr.message}`);

  return {
    teams_imported: teamRows.length,
    matches_imported: matchRows.length,
  };
}

async function syncResults(league: number, season: number) {
  const { data: dbMatches } = await supabase
    .from("matches")
    .select("*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)");

  if (!dbMatches || dbMatches.length === 0) {
    return { updated: [], skipped: [], finished_fixtures: 0 };
  }

  const fx = await callApi(`/fixtures?league=${league}&season=${season}`);
  const apiFixtures: ApiFixture[] = fx.response || [];
  const finished = apiFixtures.filter((f) => COMPLETED_STATUSES.has(f.fixture.status.short));

  const updated: string[] = [];
  const skipped: string[] = [];

  for (const fixture of finished) {
    let dbMatch = dbMatches.find((m) => m.api_football_id === fixture.fixture.id);
    if (!dbMatch) {
      const home = normalize(fixture.teams.home.name);
      const away = normalize(fixture.teams.away.name);
      const day = fixture.fixture.date.slice(0, 10);
      dbMatch = dbMatches.find(
        (m) =>
          normalize(m.home_team.name) === home &&
          normalize(m.away_team.name) === away &&
          (m.kickoff_at || "").slice(0, 10) === day,
      );
    }

    if (!dbMatch) {
      skipped.push(`${fixture.teams.home.name} vs ${fixture.teams.away.name}`);
      continue;
    }
    if (dbMatch.status === "completed") continue;

    let firstToScore: string | null = null;
    const ev = await callApi(`/fixtures/events?fixture=${fixture.fixture.id}`);
    const events: ApiEvent[] = ev.response || [];
    const goals = events
      .filter((e) => e.type === "Goal")
      .sort((a, b) => a.time.elapsed - b.time.elapsed);
    if (goals.length > 0) {
      const scorerName = normalize(goals[0].team.name);
      if (scorerName === normalize(dbMatch.home_team.name)) firstToScore = dbMatch.home_team_id;
      else if (scorerName === normalize(dbMatch.away_team.name)) firstToScore = dbMatch.away_team_id;
    }

    const { error: updateErr } = await supabase
      .from("matches")
      .update({
        home_score: fixture.goals.home ?? 0,
        away_score: fixture.goals.away ?? 0,
        first_to_score_team_id: firstToScore,
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", dbMatch.id);

    if (updateErr) {
      skipped.push(`${dbMatch.home_team.code}-${dbMatch.away_team.code}: ${updateErr.message}`);
      continue;
    }

    await rescoreMatch(dbMatch.id);
    updated.push(`${dbMatch.home_team.code} ${fixture.goals.home}-${fixture.goals.away} ${dbMatch.away_team.code}`);
  }

  return { updated, skipped, finished_fixtures: finished.length };
}

async function ensureTruthEvents(matchId: string, apiFixtureId: number | null) {
  if (!apiFixtureId) return;

  const { data: truth } = await supabase
    .from("match_truth")
    .select("events_fetched")
    .eq("match_id", matchId)
    .maybeSingle();

  if (!truth || truth.events_fetched) return;

  try {
    const ev = await callApi(`/fixtures/events?fixture=${apiFixtureId}`);
    const events: ApiEvent[] = ev.response || [];
    const goals = events
      .filter((e) => e.type === "Goal")
      .sort((a, b) => a.time.elapsed - b.time.elapsed);

    let firstScorer: string | null = null;
    if (goals.length > 0) {
      const { data: m } = await supabase
        .from("matches")
        .select("home_team_id, away_team_id, home_team:teams!matches_home_team_id_fkey(name), away_team:teams!matches_away_team_id_fkey(name)")
        .eq("id", matchId)
        .maybeSingle();
      if (m) {
        const scorerName = normalize(goals[0].team.name);
        if (scorerName === normalize((m.home_team as any).name)) firstScorer = m.home_team_id;
        else if (scorerName === normalize((m.away_team as any).name)) firstScorer = m.away_team_id;
      }
    }

    await supabase.from("match_truth")
      .update({ first_to_score_team_id: firstScorer, events_fetched: true })
      .eq("match_id", matchId);
  } catch {
    await supabase.from("match_truth")
      .update({ events_fetched: true })
      .eq("match_id", matchId);
  }
}

async function simulateReset() {
  const { data: completed } = await supabase
    .from("matches")
    .select("id, home_score, away_score, first_to_score_team_id")
    .eq("status", "completed");

  let truthSnapshots = 0;
  for (const m of completed || []) {
    if (m.home_score === null || m.away_score === null) continue;
    const { data: existing } = await supabase
      .from("match_truth")
      .select("match_id")
      .eq("match_id", m.id)
      .maybeSingle();
    if (!existing) {
      await supabase.from("match_truth").insert({
        match_id: m.id,
        home_score: m.home_score,
        away_score: m.away_score,
        first_to_score_team_id: m.first_to_score_team_id,
        events_fetched: m.first_to_score_team_id !== null,
      });
      truthSnapshots++;
    }
  }

  await supabase.from("predictions").delete().gt("created_at", "1900-01-01");

  await supabase.from("matches").update({
    status: "scheduled",
    home_score: null,
    away_score: null,
    first_to_score_team_id: null,
    updated_at: new Date().toISOString(),
  }).gt("created_at", "1900-01-01");

  await supabase.from("synced_users").update({
    total_points: 0,
    correct_predictions_count: 0,
    exact_scorelines_count: 0,
    updated_at: new Date().toISOString(),
  }).gt("created_at", "1900-01-01");

  return { truth_snapshots_added: truthSnapshots };
}

const PERSONAS = ["optimist", "realist", "wildcard", "underdog", "draw_lover"] as const;

function makeRng(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function predictForPersona(persona: string, rand: () => number, homeId: string, awayId: string) {
  const dice = rand();
  let winner: string | null;
  if (persona === "optimist") {
    winner = dice < 0.65 ? homeId : dice < 0.85 ? null : awayId;
  } else if (persona === "underdog") {
    winner = dice < 0.65 ? awayId : dice < 0.85 ? null : homeId;
  } else if (persona === "draw_lover") {
    winner = dice < 0.4 ? null : dice < 0.7 ? homeId : awayId;
  } else if (persona === "realist") {
    winner = dice < 0.45 ? homeId : dice < 0.75 ? awayId : null;
  } else {
    winner = dice < 0.4 ? homeId : dice < 0.7 ? awayId : null;
  }
  const firstScorer = rand() < 0.55 ? homeId : awayId;
  const home = Math.floor(rand() * 4);
  const away = Math.floor(rand() * 4);
  return { winner, firstScorer, home, away };
}

async function simulatePredict() {
  const { data: users } = await supabase
    .from("synced_users")
    .select("id, email")
    .order("created_at");

  const { data: matches } = await supabase
    .from("matches")
    .select("id, home_team_id, away_team_id")
    .eq("status", "scheduled");

  if (!users?.length || !matches?.length) {
    return { predictions_created: 0, users: users?.length || 0, matches: matches?.length || 0 };
  }

  await supabase.from("predictions").delete().gt("created_at", "1900-01-01");

  const rows: any[] = [];
  users.forEach((u, idx) => {
    const persona = PERSONAS[idx % PERSONAS.length];
    const seed = [...u.id].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) + idx * 31;
    const rand = makeRng(seed);
    for (const m of matches) {
      const p = predictForPersona(persona, rand, m.home_team_id, m.away_team_id);
      rows.push({
        user_id: u.id,
        match_id: m.id,
        predicted_winner_team_id: p.winner,
        predicted_first_to_score_team_id: p.firstScorer,
        predicted_home_score: p.home,
        predicted_away_score: p.away,
        points_awarded: 0,
        scored: false,
      });
    }
  });

  const batchSize = 200;
  for (let i = 0; i < rows.length; i += batchSize) {
    const { error } = await supabase.from("predictions").insert(rows.slice(i, i + batchSize));
    if (error) throw new Error(`Predict failed: ${error.message}`);
  }

  return { predictions_created: rows.length, users: users.length, matches: matches.length };
}

async function revealOne(matchId: string): Promise<boolean> {
  const { data: m } = await supabase
    .from("matches")
    .select("id, status, api_football_id")
    .eq("id", matchId)
    .maybeSingle();
  if (!m || m.status === "completed") return false;

  await ensureTruthEvents(m.id, m.api_football_id);

  const { data: truth } = await supabase
    .from("match_truth")
    .select("home_score, away_score, first_to_score_team_id")
    .eq("match_id", m.id)
    .maybeSingle();
  if (!truth) return false;

  await supabase.from("matches").update({
    status: "completed",
    home_score: truth.home_score,
    away_score: truth.away_score,
    first_to_score_team_id: truth.first_to_score_team_id,
    updated_at: new Date().toISOString(),
  }).eq("id", m.id);

  await rescoreMatch(m.id);
  return true;
}

async function simulateReveal(opts: { count?: number; stage?: string }) {
  const query = supabase
    .from("matches")
    .select("id")
    .eq("status", "scheduled")
    .order("kickoff_at", { ascending: true });

  if (opts.stage) query.eq("stage", opts.stage);
  if (opts.count) query.limit(opts.count);

  const { data: matches } = await query;
  if (!matches?.length) return { revealed: 0 };

  let revealed = 0;
  for (const m of matches) {
    if (await revealOne(m.id)) revealed++;
  }
  return { revealed };
}

const STAGE_ORDER = ["group", "round_of_16", "quarter_final", "semi_final", "final"];

async function simulateState() {
  const { data: matches } = await supabase
    .from("matches")
    .select("id, stage, status, kickoff_at")
    .order("kickoff_at");

  const { data: leaderboard } = await supabase
    .from("synced_users")
    .select("id, email, name, account_number, total_points")
    .order("total_points", { ascending: false });

  const stageMap: Record<string, { total: number; completed: number }> = {};
  for (const m of matches || []) {
    if (!stageMap[m.stage]) stageMap[m.stage] = { total: 0, completed: 0 };
    stageMap[m.stage].total++;
    if (m.status === "completed") stageMap[m.stage].completed++;
  }

  const stages = STAGE_ORDER
    .filter((s) => stageMap[s])
    .map((s) => ({ stage: s, ...stageMap[s] }));

  const total = matches?.length || 0;
  const done = (matches || []).filter((m) => m.status === "completed").length;
  const nextMatch = (matches || []).find((m) => m.status === "scheduled");

  return {
    stages,
    total_matches: total,
    completed_matches: done,
    next_match_at: nextMatch?.kickoff_at || null,
    leaderboard: leaderboard || [],
  };
}

async function simulateShift(targetIso: string) {
  const target = new Date(targetIso);
  if (isNaN(target.getTime())) throw new Error("Invalid target date");

  const { data: matches } = await supabase
    .from("matches")
    .select("id, kickoff_at")
    .order("kickoff_at", { ascending: true });

  if (!matches?.length) return { shifted: 0, offset_days: 0 };

  const firstMs = new Date(matches[0].kickoff_at).getTime();
  const offsetMs = target.getTime() - firstMs;

  for (const m of matches) {
    const newDate = new Date(new Date(m.kickoff_at).getTime() + offsetMs);
    await supabase
      .from("matches")
      .update({ kickoff_at: newDate.toISOString(), updated_at: new Date().toISOString() })
      .eq("id", m.id);
  }

  return {
    shifted: matches.length,
    offset_days: Math.round((offsetMs / 86400000) * 10) / 10,
    first_kickoff_at: target.toISOString(),
  };
}

async function simulateRevealPast() {
  const now = new Date().toISOString();
  const { data: matches } = await supabase
    .from("matches")
    .select("id")
    .eq("status", "scheduled")
    .lt("kickoff_at", now)
    .order("kickoff_at", { ascending: true });

  if (!matches?.length) return { revealed: 0 };

  let revealed = 0;
  for (const m of matches) {
    if (await revealOne(m.id)) revealed++;
  }
  return { revealed };
}

async function syncFixtures(league: number, season: number) {
  const fx = await callApi(`/fixtures?league=${league}&season=${season}`);
  const apiFixtures: ApiFixture[] = fx.response || [];

  if (apiFixtures.length === 0) {
    return { added_teams: 0, added_matches: 0, skipped_existing: 0 };
  }

  const { data: existingMatches } = await supabase
    .from("matches")
    .select("api_football_id");
  const existingApiIds = new Set((existingMatches || []).map((m) => m.api_football_id));

  const { data: existingTeams } = await supabase
    .from("teams")
    .select("api_football_id, id, code");
  const teamIdByApiId = new Map<number, string>();
  const usedCodes = new Set<string>();
  for (const t of existingTeams || []) {
    teamIdByApiId.set(t.api_football_id, t.id);
    usedCodes.add(t.code);
  }

  const newFixtures = apiFixtures.filter((f) => !existingApiIds.has(f.fixture.id));
  const skippedExisting = apiFixtures.length - newFixtures.length;

  if (newFixtures.length === 0) {
    return { added_teams: 0, added_matches: 0, skipped_existing: skippedExisting };
  }

  const newTeams = new Map<number, { name: string; group: string }>();
  for (const f of newFixtures) {
    const grp = deriveGroup(f.league.round);
    for (const t of [f.teams.home, f.teams.away]) {
      if (!teamIdByApiId.has(t.id) && !newTeams.has(t.id)) {
        newTeams.set(t.id, { name: t.name, group: grp });
      }
    }
  }

  let addedTeams = 0;
  if (newTeams.size > 0) {
    const teamRows = [...newTeams.entries()].map(([id, t]) => {
      let code = shortCode(t.name);
      if (usedCodes.has(code)) {
        const cleaned = (t.name || "").replace(/[^A-Za-z]/g, "").toUpperCase();
        for (let len = 4; len <= cleaned.length; len++) {
          const candidate = cleaned.slice(0, len);
          if (!usedCodes.has(candidate)) { code = candidate; break; }
        }
      }
      usedCodes.add(code);
      return {
        api_football_id: id,
        name: t.name,
        code,
        flag_emoji: flagFor(t.name),
        group_name: t.group,
      };
    });

    const { data: inserted, error: teamErr } = await supabase
      .from("teams")
      .insert(teamRows)
      .select("id, api_football_id");
    if (teamErr) throw new Error(`Team insert failed: ${teamErr.message}`);
    for (const t of inserted || []) {
      teamIdByApiId.set(t.api_football_id, t.id);
    }
    addedTeams = teamRows.length;
  }

  const matchRows = newFixtures.map((f) => ({
    api_football_id: f.fixture.id,
    home_team_id: teamIdByApiId.get(f.teams.home.id)!,
    away_team_id: teamIdByApiId.get(f.teams.away.id)!,
    kickoff_at: f.fixture.date,
    stage: deriveStage(f.league.round),
    status: COMPLETED_STATUSES.has(f.fixture.status.short) ? "completed" : "scheduled",
    home_score: COMPLETED_STATUSES.has(f.fixture.status.short) ? f.goals.home : null,
    away_score: COMPLETED_STATUSES.has(f.fixture.status.short) ? f.goals.away : null,
  }));

  const { error: matchErr } = await supabase.from("matches").insert(matchRows);
  if (matchErr) throw new Error(`Match insert failed: ${matchErr.message}`);

  return { added_teams: addedTeams, added_matches: matchRows.length, skipped_existing: skippedExisting };
}

function isServiceRoleRequest(req: Request): boolean {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  return token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (!Deno.env.get("FOOTBALL_API_KEY")) {
      return new Response(JSON.stringify({ error: "FOOTBALL_API_KEY not configured." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const route = url.pathname.split("/").pop();
    const body = await req.json().catch(() => ({}));
    const email = (body.email || "").trim().toLowerCase();
    const league = Number(body.league) || DEFAULT_LEAGUE;
    const season = Number(body.season) || DEFAULT_SEASON;

    // Allow cron/service-role calls to sync without admin email
    const isCron = isServiceRoleRequest(req) || (body.action === "update-scores" && !email);
    if (isCron) {
      const { updated, skipped, finished_fixtures } = await syncResults(league, season);
      return new Response(
        JSON.stringify({ success: true, cron: true, finished_fixtures, updated_count: updated.length, updated, skipped }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const requiredPermission: AdminPermission = ROUTE_PERMISSIONS[route || ""] || "manage_results";
    if (!email || !(await adminHasPermission(email, requiredPermission))) {
      return new Response(JSON.stringify({ error: "Not authorised." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (route === "debug") {
      const path = (body.path || "").trim();
      if (!path || !path.startsWith("/")) {
        return new Response(JSON.stringify({ error: "path must start with /" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await callApi(path);
      return new Response(JSON.stringify({
        success: true,
        path,
        results: data.results,
        errors: data.errors,
        paging: data.paging,
        sample: Array.isArray(data.response) ? data.response.slice(0, 3) : data.response,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (route === "leagues") {
      const search = (body.search || "").trim();
      if (!search) {
        return new Response(JSON.stringify({ error: "search query required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await callApi(`/leagues?search=${encodeURIComponent(search)}`);
      const leagues = (data.response || []).map((row: any) => ({
        id: row.league.id,
        name: row.league.name,
        type: row.league.type,
        country: row.country?.name,
        seasons: (row.seasons || []).map((s: any) => ({
          year: s.year,
          start: s.start,
          end: s.end,
          current: s.current,
        })),
      }));
      return new Response(JSON.stringify({ success: true, leagues }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (route === "simulate") {
      const action = (body.action || "").trim();
      if (action === "reset") {
        const r = await simulateReset();
        return new Response(JSON.stringify({ success: true, action, ...r }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (action === "predict") {
        const r = await simulatePredict();
        return new Response(JSON.stringify({ success: true, action, ...r }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (action === "reveal-next") {
        const r = await simulateReveal({ count: Number(body.count) || 1 });
        return new Response(JSON.stringify({ success: true, action, ...r }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (action === "reveal-stage") {
        const r = await simulateReveal({ stage: String(body.stage || "group") });
        return new Response(JSON.stringify({ success: true, action, ...r }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (action === "reveal-past") {
        const r = await simulateRevealPast();
        return new Response(JSON.stringify({ success: true, action, ...r }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (action === "shift") {
        const r = await simulateShift(String(body.target || ""));
        return new Response(JSON.stringify({ success: true, action, ...r }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (action === "state") {
        const r = await simulateState();
        return new Response(JSON.stringify({ success: true, action, ...r }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: `Unknown simulate action: ${action}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (route === "import") {
      const result = await importFixtures(league, season);
      return new Response(
        JSON.stringify({ success: true, league, season, ...result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (route === "sync-fixtures") {
      const result = await syncFixtures(league, season);
      return new Response(
        JSON.stringify({ success: true, league, season, ...result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { updated, skipped, finished_fixtures } = await syncResults(league, season);
    return new Response(
      JSON.stringify({
        success: true,
        league,
        season,
        finished_fixtures,
        updated_count: updated.length,
        updated,
        skipped,
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
