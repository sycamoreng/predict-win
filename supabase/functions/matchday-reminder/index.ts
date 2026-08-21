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
  const { data } = await supabase
    .from("campaigns")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();
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
    const res = await fetch(SEND_EMAIL_URL, {
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
    return await res.json().catch(() => null);
  } catch {
    return null; /* best-effort */
  }
}

const fmtKickoff = (iso: string) =>
  new Date(iso).toLocaleString("en-NG", {
    weekday: "short", day: "numeric", month: "short",
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos",
  });

function buildFixtureList(
  weekFixtures: any[],
  lockWindowMs: number,
): { teamA: string; teamB: string; homeTeam: string; awayTeam: string; kickoff: string; lockTime: string; match_id: string }[] {
  const fmtLock = (iso: string) =>
    new Date(new Date(iso).getTime() - lockWindowMs).toLocaleString("en-NG", {
      weekday: "short", day: "numeric", month: "short",
      hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos",
    });
  return weekFixtures.map((m) => ({
    teamA: (m.home_team as any)?.code || (m.home_team as any)?.name || "TBD",
    teamB: (m.away_team as any)?.code || (m.away_team as any)?.name || "TBD",
    homeTeam: (m.home_team as any)?.name || (m.home_team as any)?.code || "TBD",
    awayTeam: (m.away_team as any)?.name || (m.away_team as any)?.code || "TBD",
    kickoff: fmtKickoff(m.kickoff_at),
    lockTime: fmtLock(m.kickoff_at),
    match_id: m.id,
  }));
}

async function loadMatchweekFixtures(campaignId: string, matchweek: number) {
  const { data } = await supabase
    .from("matches")
    .select("id, kickoff_at, status, home_team:teams!matches_home_team_id_fkey(name, code), away_team:teams!matches_away_team_id_fkey(name, code)")
    .eq("campaign_id", campaignId)
    .eq("matchweek", matchweek)
    .order("kickoff_at", { ascending: true });
  return data || [];
}

// One-off test send: emails a single address for a chosen matchweek, ignoring
// the timing window, enrolment, and the once-per-matchweek guard. Gated behind
// the service-role key so it cannot be triggered publicly.
async function handleTestSend(campaign: any, toEmail: string, matchweek: number, lockWindowMs: number) {
  const weekFixtures = await loadMatchweekFixtures(campaign.id, matchweek);
  if (weekFixtures.length === 0) {
    return { success: false, message: `No fixtures for matchweek ${matchweek}`, matchweek };
  }

  const { data: user } = await supabase
    .from("synced_users")
    .select("id, email, name, username")
    .eq("email", toEmail)
    .maybeSingle();

  const matchIds = weekFixtures.map((m) => m.id);
  let predictedSet = new Set<string>();
  if (user) {
    const { data: preds } = await supabase
      .from("predictions")
      .select("match_id")
      .eq("user_id", user.id)
      .in("match_id", matchIds);
    predictedSet = new Set((preds || []).map((p) => `${p.match_id}`));
  }

  const list = buildFixtureList(weekFixtures, lockWindowMs);
  const fixtures = list.map((f) => ({
    teamA: f.teamA, teamB: f.teamB, homeTeam: f.homeTeam, awayTeam: f.awayTeam,
    kickoff: f.kickoff, lockTime: f.lockTime, predicted: predictedSet.has(f.match_id),
  }));
  const unpredictedCount = fixtures.filter((f) => !f.predicted).length;

  const emailResult = await sendEmail("matchday_reminder", toEmail, user?.name || "", {
    firstName: deriveFirstName(user?.name ?? null, user?.username ?? null, toEmail),
    matchweek,
    fixtures,
    fixtureCount: fixtures.length,
    matchCount: unpredictedCount,
    predictLink: `${APP_BASE_URL}/predict`,
  });

  return { success: true, test: true, matchweek, to_email: toEmail, fixtures_in_matchweek: fixtures.length, emailResult };
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

    const lockWindowMs = (campaign.prediction_lock_minutes ?? 60) * 60 * 1000;

    // One-off test send (service-role only): { test: true, to_email, matchweek }
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    if (body?.test === true) {
      const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
      if (token !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!body.to_email || typeof body.matchweek !== "number") {
        return new Response(JSON.stringify({ error: "to_email and numeric matchweek required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const result = await handleTestSend(campaign, body.to_email, body.matchweek, lockWindowMs);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const lockingSoon = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const lockingLater = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    // Detect the matchweek that is about to lock (a fixture kicking off soon),
    // so the reminder cadence stays tied to imminent games.
    const { data: imminentMatches } = await supabase
      .from("matches")
      .select("matchweek")
      .eq("status", "scheduled")
      .eq("campaign_id", campaign.id)
      .not("matchweek", "is", null)
      .gte("kickoff_at", lockingSoon.toISOString())
      .lte("kickoff_at", lockingLater.toISOString())
      .order("matchweek", { ascending: true })
      .limit(1);

    if (!imminentMatches || imminentMatches.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No matchweek locking in window", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const matchweek = imminentMatches[0].matchweek as number;

    // Pull every fixture in that matchweek — the email lists the whole matchweek.
    const { data: weekFixtures } = await supabase
      .from("matches")
      .select("id, kickoff_at, status, home_team:teams!matches_home_team_id_fkey(name, code), away_team:teams!matches_away_team_id_fkey(name, code)")
      .eq("campaign_id", campaign.id)
      .eq("matchweek", matchweek)
      .order("kickoff_at", { ascending: true });

    if (!weekFixtures || weekFixtures.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No fixtures for matchweek", matchweek, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const matchIds = weekFixtures.map((m) => m.id);

    const fixtureList = buildFixtureList(weekFixtures, lockWindowMs);

    // Query campaign_participants joined with synced_users to get only enrolled users
    const { data: participants } = await supabase
      .from("campaign_participants")
      .select("user_id, user:synced_users!campaign_participants_user_id_fkey(id, email, name, username)")
      .eq("campaign_id", campaign.id);

    if (!participants || participants.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No enrolled users for active campaign", matchweek, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const enrolledUsers = participants
      .map((p) => p.user as unknown as { id: string; email: string; name: string | null; username: string | null })
      .filter((u) => u && u.email);

    const { data: existingPreds } = await supabase
      .from("predictions")
      .select("user_id, match_id")
      .in("match_id", matchIds);

    const predictedSet = new Set(
      (existingPreds || []).map((p) => `${p.user_id}:${p.match_id}`),
    );

    // Once-per-matchweek guard: skip anyone already reminded for this matchweek.
    const { data: priorSends } = await supabase
      .from("matchday_reminder_sends")
      .select("user_id")
      .eq("campaign_id", campaign.id)
      .eq("matchweek", matchweek);

    const alreadyReminded = new Set((priorSends || []).map((r) => r.user_id));

    let sent = 0;
    const remindedUserIds: string[] = [];
    const BATCH_LIMIT = 500;

    for (const user of enrolledUsers) {
      if (sent >= BATCH_LIMIT) break;
      if (alreadyReminded.has(user.id)) continue;

      const unpredictedCount = fixtureList.filter(
        (f) => !predictedSet.has(`${user.id}:${f.match_id}`),
      ).length;

      if (unpredictedCount === 0) continue;

      const fixtures = fixtureList.map((f) => ({
        teamA: f.teamA,
        teamB: f.teamB,
        homeTeam: f.homeTeam,
        awayTeam: f.awayTeam,
        kickoff: f.kickoff,
        lockTime: f.lockTime,
        predicted: predictedSet.has(`${user.id}:${f.match_id}`),
      }));

      await sendEmail("matchday_reminder", user.email, user.name || "", {
        firstName: deriveFirstName(user.name, user.username, user.email),
        matchweek,
        fixtures,
        fixtureCount: fixtures.length,
        matchCount: unpredictedCount,
        predictLink: `${APP_BASE_URL}/predict`,
      });
      remindedUserIds.push(user.id);
      sent++;
    }

    // Record the sends so these users are not reminded again for this matchweek.
    if (remindedUserIds.length > 0) {
      await supabase
        .from("matchday_reminder_sends")
        .upsert(
          remindedUserIds.map((user_id) => ({ user_id, campaign_id: campaign.id, matchweek })),
          { onConflict: "user_id,campaign_id,matchweek", ignoreDuplicates: true },
        );
    }

    return new Response(JSON.stringify({
      success: true,
      campaign_id: campaign.id,
      matchweek,
      fixtures_in_matchweek: weekFixtures.length,
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
