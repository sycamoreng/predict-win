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

function weekBounds(): { start: Date; end: Date; prevStart: Date; prevEnd: Date } {
  const now = new Date();
  // Current week: Sunday 00:00 UTC to Saturday 23:59
  const dayOfWeek = now.getUTCDay();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dayOfWeek));
  const end = new Date(start.getTime() + 7 * 86_400_000);
  const prevStart = new Date(start.getTime() - 7 * 86_400_000);
  const prevEnd = new Date(start);
  return { start, end, prevStart, prevEnd };
}

async function computeWeeklyPoints(weekStart: string, weekEnd: string): Promise<Map<string, number>> {
  const { data: matches } = await supabase
    .from("matches")
    .select("id")
    .eq("status", "completed")
    .gte("kickoff_at", weekStart)
    .lt("kickoff_at", weekEnd);

  if (!matches || matches.length === 0) return new Map();

  const matchIds = matches.map((m) => m.id);
  const { data: preds } = await supabase
    .from("predictions")
    .select("user_id, points_awarded")
    .in("match_id", matchIds);

  const points = new Map<string, number>();
  for (const p of preds || []) {
    points.set(p.user_id, (points.get(p.user_id) || 0) + (p.points_awarded || 0));
  }
  return points;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { start, end, prevStart, prevEnd } = weekBounds();

    // Get all users with predictions, ordered by total points
    const { data: allUsers } = await supabase
      .from("synced_users")
      .select("id, email, name, username, total_points")
      .gt("total_points", 0)
      .order("total_points", { ascending: false });

    if (!allUsers || allUsers.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No users with points", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Compute this week's points and last week's points for movement
    const thisWeekPoints = await computeWeeklyPoints(start.toISOString(), end.toISOString());
    const lastWeekPoints = await computeWeeklyPoints(prevStart.toISOString(), prevEnd.toISOString());

    // Build ranked list (current overall ranking)
    const ranked = allUsers.map((u, i) => ({
      ...u,
      rank: i + 1,
    }));

    // Compute previous week's ranking by subtracting this week's gains
    const prevRanked = [...allUsers]
      .map((u) => ({
        id: u.id,
        prev_total: (u.total_points || 0) - (thisWeekPoints.get(u.id) || 0),
      }))
      .sort((a, b) => b.prev_total - a.prev_total);

    const prevRankMap = new Map<string, number>();
    prevRanked.forEach((u, i) => prevRankMap.set(u.id, i + 1));

    const totalPlayers = allUsers.length;
    let sent = 0;
    const BATCH_LIMIT = 1000;

    for (const user of ranked) {
      if (sent >= BATCH_LIMIT) break;

      const weekPts = thisWeekPoints.get(user.id) || 0;
      if (weekPts === 0 && user.rank > 100) continue; // Only email top 100 or those who scored this week

      const prevRank = prevRankMap.get(user.id) || totalPlayers;
      const movement = prevRank - user.rank; // positive = moved up

      await sendEmail("weekly_leaderboard", user.email, user.name || "", {
        firstName: deriveFirstName(user.name, user.username, user.email),
        rank: user.rank,
        totalPlayers: totalPlayers,
        totalPoints: user.total_points,
        movement: movement,
        movedUp: movement > 0,
        movedDown: movement < 0,
        movementAbs: Math.abs(movement),
        weekPoints: weekPts,
        leaderboardLink: `${APP_BASE_URL}/leaderboard`,
      });
      sent++;
    }

    return new Response(JSON.stringify({
      success: true,
      total_players: totalPlayers,
      users_emailed: sent,
      week_start: start.toISOString(),
      week_end: end.toISOString(),
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
