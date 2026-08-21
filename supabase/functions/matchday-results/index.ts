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

const SEND_EMAIL_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`;
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") || "https://play.sycamore.ng";

async function getActiveCampaign() {
  const { data } = await supabase
    .from("campaigns")
    .select("id, name")
    .eq("is_active", true)
    .maybeSingle();
  return data;
}

function deriveFirstName(name: string | null | undefined, username: string | null | undefined, email: string): string {
  if (name) {
    const first = name.split(" ")[0].trim();
    if (first.length >= 2 && /^[A-Za-z]/.test(first)) return first;
  }
  if (username && username.length >= 2) return username;
  return email.split("@")[0];
}

// Calendar day in Africa/Lagos (YYYY-MM-DD) that a kickoff falls on.
const lagosDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });

// Friendly label for the day, e.g. "Sat, 23 Aug".
const fmtDayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-NG", {
    weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Lagos",
  });

interface MatchRow {
  id: string;
  matchweek: number | null;
  kickoff_at: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  home_team: { name: string; code: string };
  away_team: { name: string; code: string };
}

async function sendBatchEmails(emails: { event_name: string; to_email: string; to_name: string; dynamic_template_data: Record<string, unknown> }[]) {
  if (emails.length === 0) return;
  try {
    await fetch(SEND_EMAIL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify(emails),
    });
  } catch { /* best-effort */ }
}

// Build one recap email per user for a single settled matchday.
async function buildDayEmails(
  campaignId: string,
  dayMatches: MatchRow[],
  resultDate: string,
  skipUserIds: Set<string>,
) {
  const matchIds = dayMatches.map((m) => m.id);
  const matchMap = new Map<string, MatchRow>();
  for (const m of dayMatches) matchMap.set(m.id, m);

  const dayLabel = fmtDayLabel(dayMatches[0].kickoff_at);
  const matchweeks = [...new Set(dayMatches.map((m) => m.matchweek).filter((w) => w != null))];
  const matchweek = matchweeks.length === 1 ? matchweeks[0] : null;

  const { data: predictions } = await supabase
    .from("predictions")
    .select("user_id, match_id, points_awarded, predicted_home_score, predicted_away_score, user:synced_users!predictions_user_id_fkey(id, email, name, username)")
    .in("match_id", matchIds);

  if (!predictions || predictions.length === 0) return [];

  const groups = new Map<string, {
    userId: string;
    user: { email: string; name: string | null; username: string | null };
    lines: Record<string, unknown>[];
    dayPoints: number;
    correct: number;
  }>();

  for (const p of predictions) {
    const u = p.user as any;
    if (!u?.email || skipUserIds.has(u.id)) continue;
    const match = matchMap.get(p.match_id);
    if (!match) continue;
    if (!groups.has(u.id)) {
      groups.set(u.id, { userId: u.id, user: u, lines: [], dayPoints: 0, correct: 0 });
    }
    const g = groups.get(u.id)!;
    const pts = p.points_awarded || 0;
    g.dayPoints += pts;
    if (pts > 0) g.correct++;
    g.lines.push({
      teamA: match.home_team.code,
      teamB: match.away_team.code,
      homeTeam: match.home_team.name,
      awayTeam: match.away_team.name,
      actualScore: `${match.home_score}-${match.away_score}`,
      predictedScore: `${p.predicted_home_score}-${p.predicted_away_score}`,
      pointsEarned: pts,
      hit: pts > 0,
    });
  }

  return [...groups.values()].map((g) => ({
    userId: g.userId,
    resultDate,
    payload: {
      // Players who predicted but scored nothing all day get the
      // "better luck next time" design instead of the "you scored" one.
      event_name: g.dayPoints > 0 ? "matchday_results" : "matchday_no_points",
      to_email: g.user.email,
      to_name: g.user.name || "",
      dynamic_template_data: {
        firstName: deriveFirstName(g.user.name, g.user.username, g.user.email),
        dayLabel,
        matchweek,
        matches: g.lines,
        matchCount: g.lines.length,
        correctCount: g.correct,
        dayPoints: g.dayPoints,
        leaderboardLink: `${APP_BASE_URL}/leaderboard`,
      },
    },
  }));
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
    const campaign = await getActiveCampaign();
    if (!campaign) {
      return new Response(JSON.stringify({ success: true, message: "No active campaign", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const isServiceRole = (req.headers.get("Authorization") || "").replace("Bearer ", "") === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    // Sample test send (service-role only): { test: true, sample: true, to_email }.
    // Placed before any data-dependent early returns so a template can always be
    // previewed even when there are no recent matches.
    if (body?.test === true && isServiceRole && (body?.sample === true || (!body.date && body?.to_email))) {
      await sendBatchEmails([{
        event_name: "matchday_results",
        to_email: String(body.to_email || ""),
        to_name: "",
        dynamic_template_data: {
          firstName: "there",
          dayLabel: "Sat, 23 Aug",
          matchweek: 3,
          matches: [
            { teamA: "ARS", teamB: "CHE", homeTeam: "Arsenal", awayTeam: "Chelsea", actualScore: "2-1", predictedScore: "2-1", pointsEarned: 5, hit: true },
            { teamA: "LIV", teamB: "MUN", homeTeam: "Liverpool", awayTeam: "Man United", actualScore: "3-0", predictedScore: "1-0", pointsEarned: 2, hit: true },
            { teamA: "TOT", teamB: "MCI", homeTeam: "Tottenham", awayTeam: "Man City", actualScore: "0-2", predictedScore: "1-1", pointsEarned: 0, hit: false },
          ],
          matchCount: 3,
          correctCount: 2,
          dayPoints: 7,
          leaderboardLink: `${APP_BASE_URL}/leaderboard`,
        },
      }]);
      return new Response(JSON.stringify({ success: true, test: true, sample: true, to: body.to_email }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look back a few days so a late-settled match still gets a recap.
    const lookbackStart = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from("matches")
      .select("id, matchweek, kickoff_at, status, home_score, away_score, home_team:teams!matches_home_team_id_fkey(name, code), away_team:teams!matches_away_team_id_fkey(name, code)")
      .eq("campaign_id", campaign.id)
      .gte("kickoff_at", lookbackStart)
      .order("kickoff_at", { ascending: true });

    const matches = (recent || []) as unknown as MatchRow[];
    if (matches.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No recent matches", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by Lagos calendar day.
    const byDay = new Map<string, MatchRow[]>();
    for (const m of matches) {
      const day = lagosDate(m.kickoff_at);
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day)!.push(m);
    }

    // Optional test send (service-role only): { test: true, date: "YYYY-MM-DD", to_email }
    // Ignores the "fully settled" and dedup guards so a template can be previewed.
    if (body?.test === true && isServiceRole) {
      const day = String(body.date || "");
      const dayMatches = byDay.get(day);
      if (!dayMatches) {
        return new Response(JSON.stringify({ success: false, message: `No matches on ${day}` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const built = await buildDayEmails(campaign.id, dayMatches, day, new Set());
      const filtered = body.to_email ? built.filter((b) => b.payload.to_email === body.to_email) : built.slice(0, 1);
      await sendBatchEmails(filtered.map((b) => b.payload));
      return new Response(JSON.stringify({ success: true, test: true, date: day, emails: filtered.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nowLagos = lagosDate(new Date().toISOString());

    // The final settled day of a fully-completed matchweek is covered by the
    // weekly digest instead, so we skip it here to avoid sending two emails.
    const { data: mwMatches } = await supabase
      .from("matches")
      .select("matchweek, kickoff_at, status")
      .eq("campaign_id", campaign.id)
      .not("matchweek", "is", null);
    const mwInfo = new Map<number, { days: Set<string>; allDone: boolean }>();
    for (const m of mwMatches || []) {
      const w = m.matchweek as number;
      if (!mwInfo.has(w)) mwInfo.set(w, { days: new Set(), allDone: true });
      const e = mwInfo.get(w)!;
      e.days.add(lagosDate(m.kickoff_at));
      if (m.status !== "completed") e.allDone = false;
    }
    const digestCoveredDays = new Set<string>();
    for (const [, e] of mwInfo) {
      if (e.allDone && e.days.size > 0) {
        digestCoveredDays.add([...e.days].sort().pop()!);
      }
    }

    let totalSent = 0;
    const daysProcessed: string[] = [];

    for (const [day, dayMatches] of byDay) {
      // Never recap the current in-progress day; wait until it has rolled over.
      if (day >= nowLagos) continue;
      // Only recap once every match that day is settled.
      if (!dayMatches.every((m) => m.status === "completed")) continue;
      // The weekly digest recaps the closing day of a finished matchweek.
      if (digestCoveredDays.has(day)) continue;

      const { data: priorSends } = await supabase
        .from("matchday_result_sends")
        .select("user_id")
        .eq("campaign_id", campaign.id)
        .eq("result_date", day);
      const alreadySent = new Set((priorSends || []).map((r) => r.user_id));

      const built = await buildDayEmails(campaign.id, dayMatches, day, alreadySent);
      if (built.length === 0) continue;

      for (let i = 0; i < built.length; i += 20) {
        await sendBatchEmails(built.slice(i, i + 20).map((b) => b.payload));
      }

      await supabase.from("matchday_result_sends").upsert(
        built.map((b) => ({ user_id: b.userId, campaign_id: campaign.id, result_date: day })),
        { onConflict: "user_id,campaign_id,result_date", ignoreDuplicates: true },
      );

      totalSent += built.length;
      daysProcessed.push(day);
    }

    return new Response(JSON.stringify({ success: true, campaign_id: campaign.id, days_processed: daysProcessed, emails_sent: totalSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
