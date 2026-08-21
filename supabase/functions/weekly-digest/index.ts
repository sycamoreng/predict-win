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

async function getActiveCampaign() {
  const { data } = await supabase.from("campaigns").select("*").eq("is_active", true).maybeSingle();
  return data;
}

const SEND_EMAIL_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`;
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") || "https://play.sycamore.ng";

function deriveFirstName(name: string | null, username: string | null, email: string): string {
  if (name) {
    const first = name.split(" ")[0].trim();
    if (first.length >= 2 && /^[A-Za-z]/.test(first)) return first;
  }
  if (username && username.length >= 2) return username;
  return email.split("@")[0];
}

async function sendEmail(eventName: string, toEmail: string, toName: string, data: Record<string, unknown>) {
  try {
    await fetch(SEND_EMAIL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        event_name: eventName,
        to_email: toEmail,
        to_name: toName,
        dynamic_template_data: data,
      }),
    });
  } catch { /* best-effort */ }
}

// The current gameweek (matchweek) of the campaign: the matchweek of the most
// recent fixture that has already kicked off; before any fixture kicks off,
// the lowest matchweek number.
async function getCurrentMatchweek(campaignId: string): Promise<number | null> {
  const { data: kicked } = await supabase
    .from("matches")
    .select("matchweek")
    .eq("campaign_id", campaignId)
    .not("matchweek", "is", null)
    .lte("kickoff_at", new Date().toISOString())
    .order("kickoff_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (kicked?.matchweek != null) return kicked.matchweek;

  const { data: first } = await supabase
    .from("matches")
    .select("matchweek")
    .eq("campaign_id", campaignId)
    .not("matchweek", "is", null)
    .order("matchweek", { ascending: true })
    .limit(1)
    .maybeSingle();
  return first?.matchweek ?? null;
}

async function computeMatchweekPoints(matchweek: number, campaignId: string): Promise<Map<string, number>> {
  const { data: matches } = await supabase
    .from("matches")
    .select("id")
    .eq("status", "completed")
    .eq("campaign_id", campaignId)
    .eq("matchweek", matchweek);

  if (!matches || matches.length === 0) return new Map();

  const matchIds = matches.map((m) => m.id);
  const { data: preds } = await supabase
    .from("predictions")
    .select("user_id, points_awarded")
    .eq("campaign_id", campaignId)
    .in("match_id", matchIds);

  const points = new Map<string, number>();
  for (const p of preds || []) {
    points.set(p.user_id, (points.get(p.user_id) || 0) + (p.points_awarded || 0));
  }
  return points;
}

// Per-user match-by-match recap for a matchweek: what they predicted, the real
// score, and points earned — the same detail the daily recap email carried.
async function computeMatchweekRecap(matchweek: number, campaignId: string): Promise<Map<string, { lines: Record<string, unknown>[]; correct: number }>> {
  const recap = new Map<string, { lines: Record<string, unknown>[]; correct: number }>();
  const { data: matches } = await supabase
    .from("matches")
    .select("id, home_score, away_score, home_team:teams!matches_home_team_id_fkey(name, code), away_team:teams!matches_away_team_id_fkey(name, code)")
    .eq("status", "completed")
    .eq("campaign_id", campaignId)
    .eq("matchweek", matchweek);
  if (!matches || matches.length === 0) return recap;

  const matchMap = new Map<string, any>();
  for (const m of matches) matchMap.set(m.id, m);

  const { data: preds } = await supabase
    .from("predictions")
    .select("user_id, match_id, points_awarded, predicted_home_score, predicted_away_score")
    .eq("campaign_id", campaignId)
    .in("match_id", matches.map((m) => m.id));

  for (const p of preds || []) {
    const m = matchMap.get(p.match_id);
    if (!m) continue;
    if (!recap.has(p.user_id)) recap.set(p.user_id, { lines: [], correct: 0 });
    const g = recap.get(p.user_id)!;
    const pts = p.points_awarded || 0;
    if (pts > 0) g.correct++;
    g.lines.push({
      teamA: m.home_team.code,
      teamB: m.away_team.code,
      homeTeam: m.home_team.name,
      awayTeam: m.away_team.name,
      actualScore: `${m.home_score}-${m.away_score}`,
      predictedScore: `${p.predicted_home_score}-${p.predicted_away_score}`,
      pointsEarned: pts,
      hit: pts > 0,
    });
  }
  return recap;
}

// Side-quest bonus points a user earned on this matchweek's quests.
async function computeWeekQuestBonus(matchweek: number, campaignId: string): Promise<Map<string, number>> {
  const bonus = new Map<string, number>();
  const { data: quests } = await supabase
    .from("side_quests")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("matchweek", matchweek);
  if (!quests || quests.length === 0) return bonus;

  const { data: entries } = await supabase
    .from("side_quest_entries")
    .select("user_id, points_awarded")
    .in("quest_id", quests.map((q) => q.id));
  for (const e of entries || []) bonus.set(e.user_id, (bonus.get(e.user_id) || 0) + (e.points_awarded || 0));
  return bonus;
}

// Lagos (UTC+1, no DST) month window, matching the monthly rewards report.
function lagosMonthBounds(): { start: string; end: string } {
  const now = new Date();
  const lagos = new Date(now.getTime() + 3_600_000);
  const y = lagos.getUTCFullYear();
  const mo = lagos.getUTCMonth();
  const start = new Date(Date.UTC(y, mo, 1) - 3_600_000);
  const end = new Date(Date.UTC(y, mo + 1, 1) - 3_600_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

// Monthly "form table" rank: points earned on fixtures that kicked off this
// calendar month, ranked highest first.
async function computeMonthlyRanks(campaignId: string): Promise<{ rankMap: Map<string, number>; ranked: number }> {
  const { start, end } = lagosMonthBounds();
  const { data: matches } = await supabase
    .from("matches")
    .select("id")
    .eq("status", "completed")
    .eq("campaign_id", campaignId)
    .gte("kickoff_at", start)
    .lt("kickoff_at", end);

  const points = new Map<string, number>();
  if (matches && matches.length > 0) {
    const matchIds = matches.map((m) => m.id);
    const { data: preds } = await supabase
      .from("predictions")
      .select("user_id, points_awarded")
      .eq("campaign_id", campaignId)
      .in("match_id", matchIds);
    for (const p of preds || []) {
      points.set(p.user_id, (points.get(p.user_id) || 0) + (p.points_awarded || 0));
    }
  }

  const sorted = [...points.entries()]
    .filter(([, pts]) => pts > 0)
    .sort((a, b) => b[1] - a[1]);
  const rankMap = new Map<string, number>();
  sorted.forEach(([uid], i) => rankMap.set(uid, i + 1));
  return { rankMap, ranked: sorted.length };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const authToken = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  if (authToken !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const isServiceRole = (req.headers.get("Authorization") || "").replace("Bearer ", "") === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const testEmail = body?.test === true && isServiceRole ? String(body.to_email || "").trim() : "";

    const campaign = await getActiveCampaign();
    if (!campaign) {
      return new Response(JSON.stringify({ success: true, message: "No active campaign", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currentMatchweek = await getCurrentMatchweek(campaign.id);
    if (currentMatchweek == null) {
      return new Response(JSON.stringify({ success: true, message: "No matchweek to report", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: participants } = await supabase
      .from("campaign_participants")
      .select("user_id, total_points, user:synced_users!campaign_participants_user_id_fkey(id, email, name, username)")
      .eq("campaign_id", campaign.id)
      .gt("total_points", 0)
      .order("total_points", { ascending: false });

    if ((!participants || participants.length === 0) && !testEmail) {
      return new Response(JSON.stringify({ success: true, message: "No users with points", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allUsers = (participants || []).map((p) => ({
      id: p.user_id,
      email: (p.user as any).email as string,
      name: (p.user as any).name as string | null,
      username: (p.user as any).username as string | null,
      total_points: p.total_points,
    }));

    const thisWeekPoints = await computeMatchweekPoints(currentMatchweek, campaign.id);
    const weekRecap = await computeMatchweekRecap(currentMatchweek, campaign.id);
    const weekQuestBonus = await computeWeekQuestBonus(currentMatchweek, campaign.id);
    const { rankMap: monthlyRankMap, ranked: monthlyRanked } = await computeMonthlyRanks(campaign.id);

    const ranked = allUsers.map((u, i) => ({
      ...u,
      rank: i + 1,
    }));

    const prevRanked = [...allUsers]
      .map((u) => ({
        id: u.id,
        prev_total: (u.total_points || 0) - (thisWeekPoints.get(u.id) || 0),
      }))
      .sort((a, b) => b.prev_total - a.prev_total);

    const prevRankMap = new Map<string, number>();
    prevRanked.forEach((u, i) => prevRankMap.set(u.id, i + 1));

    const totalPlayers = allUsers.length;
    const monthlyOutOf = monthlyRanked || totalPlayers;

    const buildData = (user: typeof ranked[number]) => {
      const weekPts = thisWeekPoints.get(user.id) || 0;
      const prevRank = prevRankMap.get(user.id) || totalPlayers;
      const movement = prevRank - user.rank;
      const monthlyRank = monthlyRankMap.get(user.id) || (monthlyOutOf + 1);
      const recap = weekRecap.get(user.id) || { lines: [], correct: 0 };
      const questBonus = weekQuestBonus.get(user.id) || 0;
      return {
        firstName: deriveFirstName(user.name, user.username, user.email),
        gameweek: currentMatchweek,
        weekPoints: weekPts,
        rank: user.rank,
        totalPlayers: totalPlayers,
        totalPoints: user.total_points,
        monthlyRank: monthlyRank,
        monthlyRankOutOf: monthlyOutOf,
        movement: movement,
        movedUp: movement > 0,
        movedDown: movement < 0,
        movementAbs: Math.abs(movement),
        matches: recap.lines,
        matchCount: recap.lines.length,
        correctCount: recap.correct,
        basePoints: weekPts,
        questBonus: questBonus,
        weekTotal: weekPts + questBonus,
        leaderboardLink: `${APP_BASE_URL}/leaderboard`,
      };
    };

    // Single-recipient test send (service-role only): { test: true, to_email }.
    // Uses the recipient's real data if they are a ranked participant, otherwise
    // sends representative sample data so the template can be previewed.
    if (testEmail) {
      const target = body?.sample === true ? undefined : ranked.find((u) => u.email?.toLowerCase() === testEmail.toLowerCase());
      const data = target ? buildData(target) : {
        firstName: "there",
        gameweek: currentMatchweek,
        weekPoints: 12,
        rank: 5,
        totalPlayers: totalPlayers || 100,
        totalPoints: 148,
        monthlyRank: 3,
        monthlyRankOutOf: monthlyOutOf || 100,
        movement: 2,
        movedUp: true,
        movedDown: false,
        movementAbs: 2,
        matches: [
          { teamA: "ARS", teamB: "CHE", homeTeam: "Arsenal", awayTeam: "Chelsea", actualScore: "2-1", predictedScore: "2-1", pointsEarned: 5, hit: true },
          { teamA: "LIV", teamB: "MUN", homeTeam: "Liverpool", awayTeam: "Man United", actualScore: "3-0", predictedScore: "1-0", pointsEarned: 2, hit: true },
          { teamA: "TOT", teamB: "MCI", homeTeam: "Tottenham", awayTeam: "Man City", actualScore: "0-2", predictedScore: "1-1", pointsEarned: 0, hit: false },
        ],
        matchCount: 3,
        correctCount: 2,
        basePoints: 7,
        questBonus: 5,
        weekTotal: 12,
        leaderboardLink: `${APP_BASE_URL}/leaderboard`,
      };
      await sendEmail("weekly_leaderboard", testEmail, target?.name || "", data);
      return new Response(JSON.stringify({ success: true, test: true, to: testEmail, used_real_data: !!target }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    const BATCH_LIMIT = 1000;

    for (const user of ranked) {
      if (sent >= BATCH_LIMIT) break;

      const weekPts = thisWeekPoints.get(user.id) || 0;
      if (weekPts === 0 && user.rank > 100) continue;

      await sendEmail("weekly_leaderboard", user.email, user.name || "", buildData(user));
      sent++;
    }

    return new Response(JSON.stringify({
      success: true,
      campaign_id: campaign.id,
      gameweek: currentMatchweek,
      total_players: totalPlayers,
      users_emailed: sent,
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
