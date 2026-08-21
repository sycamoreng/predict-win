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
    .select("id, name, prediction_lock_minutes")
    .eq("is_active", true)
    .maybeSingle();
  return data;
}

const SEND_EMAIL_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`;
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") || "https://play.sycamore.ng";

function deriveFirstName(name: string | null | undefined, username: string | null | undefined, email: string): string {
  if (name) {
    const first = name.split(" ")[0].trim();
    if (first.length >= 2 && /^[A-Za-z]/.test(first)) return first;
  }
  if (username && username.length >= 2) return username;
  return email.split("@")[0];
}

const CHIP_NAMES: Record<string, string> = {
  double_down: "Double Down",
  triple_captain: "Triple Captain",
  first_blood: "First Blood",
  streak_shield: "Streak Shield",
  last_stand: "Last Stand",
  perfect_week: "Perfect Week",
};
const chipLabel = (t: string) => CHIP_NAMES[t] || t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const fmtKickoff = (iso: string) =>
  new Date(iso).toLocaleString("en-NG", {
    weekday: "short", day: "numeric", month: "short",
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos",
  });

const fmtLock = (kickoffIso: string, lockLeadMs: number) =>
  new Date(new Date(kickoffIso).getTime() - lockLeadMs).toLocaleString("en-NG", {
    weekday: "short", day: "numeric", month: "short",
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos",
  });

interface MatchRow {
  id: string;
  matchweek: number | null;
  kickoff_at: string;
  home_team: { name: string; code: string };
  away_team: { name: string; code: string };
}

async function sendBatchEmails(emails: { event_name: string; to_email: string; dynamic_template_data: Record<string, unknown> }[]) {
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

// "Locking soon" nudge: fires ~1 hour before predictions lock for the fixtures.
async function processReminderEmails(campaign: { id: string }, lockLeadMs: number) {
  const now = Date.now();
  // 1 hour before lock == lockLeadMs + 1h before kickoff.
  const leadMs = lockLeadMs + 60 * 60 * 1000;
  const windowStart = new Date(now + leadMs - 10 * 60 * 1000).toISOString();
  const windowEnd = new Date(now + leadMs + 10 * 60 * 1000).toISOString();

  const { data: matches } = await supabase
    .from("matches")
    .select("id, matchweek, kickoff_at, home_team:teams!matches_home_team_id_fkey(name, code), away_team:teams!matches_away_team_id_fkey(name, code)")
    .eq("status", "scheduled")
    .eq("reminder_email_sent", false)
    .eq("campaign_id", campaign.id)
    .gte("kickoff_at", windowStart)
    .lte("kickoff_at", windowEnd);

  if (!matches || matches.length === 0) return { reminder_matches: 0, reminder_emails: 0 };

  const matchIds = matches.map((m) => m.id);

  const { data: allUsers } = await supabase
    .from("synced_users")
    .select("id, email, name, username")
    .eq("predictions_opted_in", true);

  if (!allUsers || allUsers.length === 0) {
    await supabase.from("matches").update({ reminder_email_sent: true }).in("id", matchIds);
    return { reminder_matches: matches.length, reminder_emails: 0 };
  }

  const { data: existingPreds } = await supabase
    .from("predictions")
    .select("user_id, match_id")
    .in("match_id", matchIds);

  const predictedSet = new Set((existingPreds || []).map((p) => `${p.user_id}:${p.match_id}`));

  // Group by (user, matchweek): one email per user per matchweek listing the
  // fixtures that are about to lock and that they still have not predicted.
  const groups = new Map<string, { user: { id: string; email: string; name: string | null; username: string | null }; matchweek: number; fixtures: Record<string, unknown>[] }>();

  for (const match of matches) {
    const m = match as unknown as MatchRow;
    const mw = m.matchweek ?? 0;
    const fixture = {
      teamA: m.home_team.code,
      teamB: m.away_team.code,
      homeTeam: m.home_team.name,
      awayTeam: m.away_team.name,
      kickoff: fmtKickoff(m.kickoff_at),
      lockTime: fmtLock(m.kickoff_at, lockLeadMs),
    };
    for (const user of allUsers) {
      if (predictedSet.has(`${user.id}:${m.id}`)) continue;
      const key = `${user.id}:${mw}`;
      if (!groups.has(key)) groups.set(key, { user, matchweek: mw, fixtures: [] });
      groups.get(key)!.fixtures.push(fixture);
    }
  }

  const emailBatch = [...groups.values()].map(({ user, matchweek, fixtures }) => ({
    event_name: "prediction_lock_1h",
    to_email: user.email,
    dynamic_template_data: {
      firstName: deriveFirstName(user.name, user.username, user.email),
      matchweek,
      fixtures,
      fixtureCount: fixtures.length,
      matchCount: fixtures.length,
      predictLink: `${APP_BASE_URL}/predict`,
    },
  }));

  for (let i = 0; i < emailBatch.length; i += 20) {
    await sendBatchEmails(emailBatch.slice(i, i + 20));
  }

  await supabase.from("matches").update({ reminder_email_sent: true }).in("id", matchIds);

  return { reminder_matches: matches.length, reminder_emails: emailBatch.length };
}

// "Locked" confirmation: fires at the moment predictions lock for the fixtures.
async function processLockEmails(campaign: { id: string }, lockLeadMs: number) {
  const now = Date.now();
  const windowStart = new Date(now + lockLeadMs - 10 * 60 * 1000).toISOString();
  const windowEnd = new Date(now + lockLeadMs + 10 * 60 * 1000).toISOString();

  const { data: matches } = await supabase
    .from("matches")
    .select("id, matchweek, kickoff_at, home_team:teams!matches_home_team_id_fkey(name, code), away_team:teams!matches_away_team_id_fkey(name, code)")
    .eq("status", "scheduled")
    .eq("lock_email_sent", false)
    .eq("campaign_id", campaign.id)
    .gte("kickoff_at", windowStart)
    .lte("kickoff_at", windowEnd);

  if (!matches || matches.length === 0) return { lock_matches: 0, lock_emails: 0 };

  const matchIds = matches.map((m) => m.id);

  const { data: predictions } = await supabase
    .from("predictions")
    .select("user_id, match_id, predicted_home_score, predicted_away_score, user:synced_users!predictions_user_id_fkey(id, email, name, username)")
    .in("match_id", matchIds);

  if (!predictions || predictions.length === 0) {
    await supabase.from("matches").update({ lock_email_sent: true }).in("id", matchIds);
    return { lock_matches: matches.length, lock_emails: 0 };
  }

  const matchMap = new Map<string, MatchRow>();
  for (const m of matches) matchMap.set(m.id, m as unknown as MatchRow);

  // Group by (user, matchweek): one confirmation per user per matchweek.
  const groups = new Map<string, { userId: string; user: { email: string; name: string | null; username: string | null }; matchweek: number; matches: Record<string, string>[] }>();

  for (const p of predictions) {
    const u = p.user as any;
    if (!u?.email) continue;
    const match = matchMap.get(p.match_id);
    if (!match) continue;
    const mw = match.matchweek ?? 0;
    const key = `${u.id}:${mw}`;
    if (!groups.has(key)) groups.set(key, { userId: u.id, user: u, matchweek: mw, matches: [] });
    groups.get(key)!.matches.push({
      teamA: match.home_team.code,
      teamB: match.away_team.code,
      predictedScore: `${p.predicted_home_score}-${p.predicted_away_score}`,
    });
  }

  // One chip is allowed per user per matchweek. Look up which chip (if any)
  // each user has active for the matchweeks in this batch so the confirmation
  // can tell them whether they played one.
  const userIds = [...new Set([...groups.values()].map((g) => g.userId))];
  const matchweeks = [...new Set([...groups.values()].map((g) => g.matchweek))];
  const chipByUserWeek = new Map<string, string>();
  if (userIds.length > 0 && matchweeks.length > 0) {
    const { data: chips } = await supabase
      .from("chip_activations")
      .select("user_id, chip_type, week_number")
      .eq("campaign_id", campaign.id)
      .in("user_id", userIds)
      .in("week_number", matchweeks);
    for (const c of chips || []) {
      chipByUserWeek.set(`${c.user_id}:${c.week_number}`, c.chip_type);
    }
  }

  const emailBatch = [...groups.values()].map(({ userId, user, matchweek, matches: matchSummaries }) => {
    const chipType = chipByUserWeek.get(`${userId}:${matchweek}`) || null;
    return {
      event_name: "prediction_locked",
      to_email: user.email,
      dynamic_template_data: {
        firstName: deriveFirstName(user.name, user.username, user.email),
        matchweek,
        matches: matchSummaries,
        matchCount: matchSummaries.length,
        chipUsed: chipType !== null,
        chipName: chipType ? chipLabel(chipType) : "",
        historyLink: `${APP_BASE_URL}/history`,
      },
    };
  });

  await sendBatchEmails(emailBatch);
  await supabase.from("matches").update({ lock_email_sent: true }).in("id", matchIds);

  return { lock_matches: matches.length, lock_emails: emailBatch.length };
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
      return new Response(JSON.stringify({ success: true, message: "No active campaign" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lockLeadMs = (campaign.prediction_lock_minutes ?? 60) * 60 * 1000;
    const reminderResult = await processReminderEmails(campaign, lockLeadMs);
    const lockResult = await processLockEmails(campaign, lockLeadMs);

    return new Response(
      JSON.stringify({ success: true, ...reminderResult, ...lockResult }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
