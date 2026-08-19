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
  const { data, error } = await supabase
    .from("campaigns")
    .select("id, name")
    .eq("is_active", true)
    .limit(1)
    .single();

  if (error || !data) return null;
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

interface MatchWithTeams {
  id: string;
  kickoff_at: string;
  home_team: { name: string; code: string };
  away_team: { name: string; code: string };
}

interface UserPrediction {
  user_id: string;
  predicted_home_score: number;
  predicted_away_score: number;
  predicted_winner_team_id: string | null;
  predicted_first_to_score_team_id: string | null;
  wants_winner_pick: boolean;
  wants_first_to_score_pick: boolean;
  wants_exact_score_pick: boolean;
  match_id: string;
  user: {
    id: string;
    email: string;
    name: string;
    username: string | null;
  };
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

function formatPredictionSummary(
  pred: UserPrediction,
  match: MatchWithTeams,
): Record<string, string> {
  const homeName = match.home_team.code;
  const awayName = match.away_team.code;
  return {
    match: `${homeName} vs ${awayName}`,
    predictedScore: `${pred.predicted_home_score}-${pred.predicted_away_score}`,
    predictedWinner: pred.predicted_winner_team_id === match.id
      ? "Draw"
      : pred.predicted_winner_team_id
        ? (pred.predicted_winner_team_id === match.home_team.code ? homeName : awayName)
        : "N/A",
  };
}

async function processReminderEmails() {
  const campaign = await getActiveCampaign();
  if (!campaign) return { reminder_matches: 0, reminder_emails: 0 };

  const now = Date.now();
  const fourHoursMs = 4 * 60 * 60 * 1000;
  const windowStart = new Date(now + fourHoursMs - 10 * 60 * 1000).toISOString();
  const windowEnd = new Date(now + fourHoursMs + 10 * 60 * 1000).toISOString();

  const { data: matches } = await supabase
    .from("matches")
    .select("id, kickoff_at, home_team:teams!matches_home_team_id_fkey(name, code), away_team:teams!matches_away_team_id_fkey(name, code)")
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

  const emailBatch: { event_name: string; to_email: string; dynamic_template_data: Record<string, unknown> }[] = [];

  for (const match of matches) {
    const m = match as unknown as MatchWithTeams;
    const kickoff = new Date(m.kickoff_at);
    const lockDate = new Date(kickoff.getTime() - 3 * 60 * 60 * 1000);
    const lockTime = lockDate.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" });

    for (const user of allUsers) {
      if (predictedSet.has(`${user.id}:${m.id}`)) continue;

      emailBatch.push({
        event_name: "prediction_lock_1h",
        to_email: user.email,
        dynamic_template_data: {
          firstName: deriveFirstName(user.name, user.username, user.email),
          teamA: (match.home_team as any).code,
          teamB: (match.away_team as any).code,
          lockTime,
          predictLink: `${APP_BASE_URL}/predict`,
        },
      });
    }
  }

  for (let i = 0; i < emailBatch.length; i += 20) {
    await sendBatchEmails(emailBatch.slice(i, i + 20));
  }

  await supabase.from("matches").update({ reminder_email_sent: true }).in("id", matchIds);

  return { reminder_matches: matches.length, reminder_emails: emailBatch.length };
}

async function processLockEmails() {
  const campaign = await getActiveCampaign();
  if (!campaign) return { lock_matches: 0, lock_emails: 0 };

  const now = Date.now();
  const threeHoursMs = 3 * 60 * 60 * 1000;
  const windowStart = new Date(now + threeHoursMs - 10 * 60 * 1000).toISOString();
  const windowEnd = new Date(now + threeHoursMs + 10 * 60 * 1000).toISOString();

  const { data: matches } = await supabase
    .from("matches")
    .select("id, kickoff_at, home_team:teams!matches_home_team_id_fkey(name, code), away_team:teams!matches_away_team_id_fkey(name, code)")
    .eq("status", "scheduled")
    .eq("lock_email_sent", false)
    .eq("campaign_id", campaign.id)
    .gte("kickoff_at", windowStart)
    .lte("kickoff_at", windowEnd);

  if (!matches || matches.length === 0) return { lock_matches: 0, lock_emails: 0 };

  const matchIds = matches.map((m) => m.id);

  const { data: predictions } = await supabase
    .from("predictions")
    .select("*, user:synced_users!predictions_user_id_fkey(id, email, name, username)")
    .in("match_id", matchIds);

  if (!predictions || predictions.length === 0) {
    await supabase.from("matches").update({ lock_email_sent: true }).in("id", matchIds);
    return { lock_matches: matches.length, lock_emails: 0 };
  }

  const matchMap = new Map<string, MatchWithTeams>();
  for (const m of matches) {
    matchMap.set(m.id, m as unknown as MatchWithTeams);
  }

  const userPredictions = new Map<string, { user: { email: string; name: string; username: string | null }; preds: { match: MatchWithTeams; pred: UserPrediction }[] }>();

  for (const p of predictions) {
    const u = p.user as any;
    if (!u?.email) continue;
    if (!userPredictions.has(u.id)) {
      userPredictions.set(u.id, { user: u, preds: [] });
    }
    const match = matchMap.get(p.match_id);
    if (match) {
      userPredictions.get(u.id)!.preds.push({ match, pred: p as UserPrediction });
    }
  }

  const emailBatch: { event_name: string; to_email: string; dynamic_template_data: Record<string, unknown> }[] = [];

  for (const [, { user, preds }] of userPredictions) {
    const matchSummaries = preds.map(({ match, pred }) => ({
      teamA: match.home_team.code,
      teamB: match.away_team.code,
      predictedScore: `${pred.predicted_home_score}-${pred.predicted_away_score}`,
    }));

    emailBatch.push({
      event_name: "prediction_locked",
      to_email: user.email,
      dynamic_template_data: {
        firstName: deriveFirstName(user.name, user.username, user.email),
        matches: matchSummaries,
        matchCount: matchSummaries.length,
        historyLink: `${APP_BASE_URL}/history`,
      },
    });
  }

  await sendBatchEmails(emailBatch);
  await supabase.from("matches").update({ lock_email_sent: true }).in("id", matchIds);

  return { lock_matches: matches.length, lock_emails: emailBatch.length };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const reminderResult = await processReminderEmails();
    const lockResult = await processLockEmails();

    return new Response(
      JSON.stringify({
        success: true,
        ...reminderResult,
        ...lockResult,
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
