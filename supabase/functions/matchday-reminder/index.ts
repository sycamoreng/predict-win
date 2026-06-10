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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const now = new Date();
    const lockWindowMs = 3 * 60 * 60 * 1000;
    // Find matches kicking off in 3-6 hours (i.e. locking in 0-3 hours)
    const lockingSoon = new Date(now.getTime() + lockWindowMs);
    const lockingLater = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    const { data: upcomingMatches } = await supabase
      .from("matches")
      .select("id, kickoff_at, home_team:teams!matches_home_team_id_fkey(name, code), away_team:teams!matches_away_team_id_fkey(name, code)")
      .eq("status", "scheduled")
      .gte("kickoff_at", lockingSoon.toISOString())
      .lte("kickoff_at", lockingLater.toISOString())
      .order("kickoff_at", { ascending: true });

    if (!upcomingMatches || upcomingMatches.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No upcoming matches in window", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const matchIds = upcomingMatches.map((m) => m.id);

    // Get all active users
    const { data: allUsers } = await supabase
      .from("synced_users")
      .select("id, email, name, username")
      .eq("active_customer_flag", true);

    if (!allUsers || allUsers.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No active users", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get existing predictions for these matches
    const { data: existingPreds } = await supabase
      .from("predictions")
      .select("user_id, match_id")
      .in("match_id", matchIds);

    const predictedSet = new Set(
      (existingPreds || []).map((p) => `${p.user_id}:${p.match_id}`),
    );

    // Build match info for template
    const matchList = upcomingMatches.map((m) => {
      const kickoff = new Date(m.kickoff_at);
      const lockTime = new Date(kickoff.getTime() - lockWindowMs);
      return {
        teamA: (m.home_team as any)?.code || (m.home_team as any)?.name || "TBD",
        teamB: (m.away_team as any)?.code || (m.away_team as any)?.name || "TBD",
        lockTime: lockTime.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" }).replace(":00", "").toLowerCase(),
        match_id: m.id,
      };
    });

    let sent = 0;
    const BATCH_LIMIT = 500;

    for (const user of allUsers) {
      if (sent >= BATCH_LIMIT) break;

      // Check if user has unpredicted matches in this batch
      const unpredicted = matchIds.filter(
        (mid) => !predictedSet.has(`${user.id}:${mid}`),
      );

      if (unpredicted.length === 0) continue;

      const userMatches = matchList.filter((m) => unpredicted.includes(m.match_id));

      await sendEmail("matchday_reminder", user.email, user.name || "", {
        firstName: deriveFirstName(user.name, user.username, user.email),
        matchA: `${userMatches[0]?.teamA} vs ${userMatches[0]?.teamB}`,
        matchATime: userMatches[0]?.lockTime || "",
        matchB: userMatches[1] ? `${userMatches[1].teamA} vs ${userMatches[1].teamB}` : "",
        matchBTime: userMatches[1]?.lockTime || "",
        predictLink: `${APP_BASE_URL}/predict`,
        matches: userMatches.map((m) => ({ teamA: m.teamA, teamB: m.teamB, lockTime: m.lockTime })),
        matchCount: unpredicted.length,
      });
      sent++;
    }

    return new Response(JSON.stringify({
      success: true,
      matches_in_window: upcomingMatches.length,
      users_notified: sent,
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
