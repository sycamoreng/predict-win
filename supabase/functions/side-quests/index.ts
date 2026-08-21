import { createClient } from "npm:@supabase/supabase-js@2.45.4";
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

function isServiceRoleRequest(req: Request): boolean {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  return token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
}

// Admins sign in with a custom session (no Supabase auth), so client-side
// writes to side_quests would run as `anon` and be blocked by RLS. Admin
// mutations therefore go through this function and are gated on admin_users.
async function isAdminEmail(email: unknown): Promise<boolean> {
  const clean = String(email || "").trim().toLowerCase();
  if (!clean) return false;
  const { data } = await supabase
    .from("admin_users")
    .select("email")
    .eq("email", clean)
    .maybeSingle();
  return !!data;
}

function forbidden() {
  return new Response(JSON.stringify({ error: "Not authorised" }), {
    status: 403,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getActiveCampaign() {
  const { data } = await supabase.from("campaigns").select("*").eq("is_active", true).maybeSingle();
  return data;
}

// Returns the earliest kickoff for a matchweek, or null if none scheduled.
async function firstKickoffForMatchweek(campaignId: string, matchweek: number): Promise<string | null> {
  const { data } = await supabase
    .from("matches")
    .select("kickoff_at")
    .eq("campaign_id", campaignId)
    .eq("matchweek", matchweek)
    .order("kickoff_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.kickoff_at ?? null;
}

// Works out when a custom quest should lock. Priority:
//   1. An explicit lock time chosen by the admin.
//   2. The matchweek's first kickoff, minus a pre-kickoff buffer (used to close
//      lineup/substitute quests before official team sheets drop ~1h before KO).
async function resolveCustomLock(
  campaignId: string,
  matchweek: number | null,
  explicit: unknown,
  bufferMinutes: unknown,
): Promise<string | null> {
  if (explicit) {
    const t = new Date(String(explicit)).getTime();
    if (!Number.isNaN(t)) return new Date(t).toISOString();
  }
  if (!matchweek) return null;
  const kickoff = await firstKickoffForMatchweek(campaignId, matchweek);
  if (!kickoff) return null;
  const buffer = Math.max(0, Number(bufferMinutes) || 0);
  return new Date(new Date(kickoff).getTime() - buffer * 60_000).toISOString();
}

type QuestDraft = {
  campaign_id: string;
  matchweek: number;
  quest_type: string;
  title: string;
  description: string;
  options: string[];
  options_meta: Record<string, unknown>;
  point_value: number;
  is_auto_generated: boolean;
  locks_at: string;
  status: string;
};

// Builds the candidate quest list for a matchweek WITHOUT inserting. Used by
// both the preview endpoint (admin review) and the generate/cron path.
async function buildMatchweekQuests(campaignId: string, matchweek: number): Promise<QuestDraft[]> {
  // Figure out which quest types already exist so we only top up missing ones.
  // This lets us backfill newly-added quest types (e.g. player quests) onto a
  // matchweek that was generated before that type existed, without duplicating.
  const { data: existing } = await supabase
    .from("side_quests")
    .select("quest_type")
    .eq("campaign_id", campaignId)
    .eq("matchweek", matchweek)
    .eq("is_auto_generated", true);

  const existingTypes = new Set((existing || []).map((q: any) => q.quest_type));

  // Get matches for this matchweek to calculate thresholds
  const { data: matches } = await supabase
    .from("matches")
    .select("id, home_team_id, away_team_id, kickoff_at")
    .eq("campaign_id", campaignId)
    .eq("matchweek", matchweek)
    .order("kickoff_at", { ascending: true });

  if (!matches || matches.length === 0) {
    return [];
  }

  const matchCount = matches.length;
  const firstKickoff = matches[0].kickoff_at;

  // Calculate over/under threshold (avg ~2.5 goals per match)
  const totalGoalsLine = Math.round(matchCount * 2.5 * 2) / 2; // round to nearest 0.5

  const quests: QuestDraft[] = [];

  // 1. Total goals over/under
  if (!existingTypes.has("total_goals_over_under")) quests.push({
    campaign_id: campaignId,
    matchweek,
    quest_type: "total_goals_over_under",
    title: `Total goals: Over or Under ${totalGoalsLine}?`,
    description: `Will there be more or fewer than ${totalGoalsLine} goals across all ${matchCount} matches this matchweek?`,
    options: ["over", "under"],
    options_meta: { line: totalGoalsLine, match_count: matchCount },
    point_value: 10,
    is_auto_generated: true,
    locks_at: firstKickoff,
    status: "open",
  });

  // 2. Clean sheet count
  if (!existingTypes.has("clean_sheet_count")) quests.push({
    campaign_id: campaignId,
    matchweek,
    quest_type: "clean_sheet_count",
    title: "How many clean sheets?",
    description: `Predict how many teams will keep a clean sheet (concede 0 goals) across all ${matchCount} matches.`,
    options: ["0", "1", "2", "3", "4", "5+"],
    options_meta: { match_count: matchCount },
    point_value: 15,
    is_auto_generated: true,
    locks_at: firstKickoff,
    status: "open",
  });

  // 3. Both teams score count
  if (!existingTypes.has("both_teams_score_count")) quests.push({
    campaign_id: campaignId,
    matchweek,
    quest_type: "both_teams_score_count",
    title: "Both teams score — how many matches?",
    description: `In how many of the ${matchCount} matches will both teams find the net?`,
    options: Array.from({ length: Math.min(matchCount + 1, 8) }, (_, i) => i >= 7 ? "7+" : String(i)),
    options_meta: { match_count: matchCount },
    point_value: 15,
    is_auto_generated: true,
    locks_at: firstKickoff,
    status: "open",
  });

  // 4. Highest scoring match
  const { data: matchesWithTeams } = await supabase
    .from("matches")
    .select("id, home_team:teams!matches_home_team_id_fkey(name, code), away_team:teams!matches_away_team_id_fkey(name, code)")
    .eq("campaign_id", campaignId)
    .eq("matchweek", matchweek);

  if (!existingTypes.has("highest_scoring_match") && matchesWithTeams && matchesWithTeams.length > 1) {
    const matchOptions = matchesWithTeams.map((m: any) => m.id);
    const matchLabels: Record<string, string> = {};
    for (const m of matchesWithTeams) {
      matchLabels[m.id] = `${(m.home_team as any).code} vs ${(m.away_team as any).code}`;
    }

    quests.push({
      campaign_id: campaignId,
      matchweek,
      quest_type: "highest_scoring_match",
      title: "Which match has the most goals?",
      description: "Pick the fixture that will produce the highest total goals this matchweek.",
      options: matchOptions,
      options_meta: { labels: matchLabels },
      point_value: 20,
      is_auto_generated: true,
      locks_at: firstKickoff,
      status: "open",
    });
  }

  // 5. Player "anytime scorer" quests — pick a few forwards from teams playing
  //    this matchweek. Auto-resolvable from recorded goalscorers.
  const teamIds = Array.from(
    new Set(matches.flatMap((m: any) => [m.home_team_id, m.away_team_id]).filter(Boolean)),
  );
  if (!existingTypes.has("player_to_score") && teamIds.length > 0) {
    const { data: forwards } = await supabase
      .from("players")
      .select("api_football_id, name, photo_url, team_id")
      .eq("campaign_id", campaignId)
      .in("team_id", teamIds)
      .eq("active", true)
      .ilike("position", "%attack%")
      .not("photo_url", "is", null)
      .not("name", "is", null);

    // One forward per team, then randomly take up to 3
    const seenTeams = new Set<string>();
    const pool = (forwards || []).filter((p: any) => {
      if (!p.name || seenTeams.has(p.team_id)) return false;
      seenTeams.add(p.team_id);
      return true;
    });
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    for (const player of pool.slice(0, 3)) {
      quests.push({
        campaign_id: campaignId,
        matchweek,
        quest_type: "player_to_score",
        title: `Will ${player.name} score in MW${matchweek}?`,
        description: `Predict whether ${player.name} finds the net in any Matchweek ${matchweek} fixture. Own goals don't count.`,
        options: ["yes", "no"],
        options_meta: {
          labels: { yes: "Yes", no: "No" },
          player: {
            api_id: player.api_football_id ?? null,
            name: player.name,
            photo_url: player.photo_url,
            team_id: player.team_id,
          },
        },
        point_value: 15,
        is_auto_generated: true,
        locks_at: firstKickoff,
        status: "open",
      });
    }
  }

  // 6. Reusable template pool — admins curate these once and they feed every
  //    week's suggestions. {MW} in the title/description becomes the matchweek.
  const { data: templates } = await supabase
    .from("quest_templates")
    .select("*")
    .eq("active", true)
    .or(`campaign_id.is.null,campaign_id.eq.${campaignId}`)
    .order("sort_order", { ascending: true });

  if (templates && templates.length > 0) {
    // De-dupe against titles already present for this week (any source).
    const { data: existingTitles } = await supabase
      .from("side_quests")
      .select("title")
      .eq("campaign_id", campaignId)
      .eq("matchweek", matchweek);
    const takenTitles = new Set((existingTitles || []).map((q: any) => q.title));
    const fill = (s: string) => (s || "").replaceAll("{MW}", String(matchweek));

    for (const t of templates) {
      const title = fill(t.title);
      if (takenTitles.has(title)) continue;
      takenTitles.add(title);
      quests.push({
        campaign_id: campaignId,
        matchweek,
        quest_type: t.quest_type || "custom",
        title,
        description: fill(t.description),
        options: t.options || [],
        options_meta: t.options_meta || {},
        point_value: Math.max(1, Number(t.point_value) || 10),
        is_auto_generated: true,
        locks_at: firstKickoff,
        status: "open",
      });
    }
  }

  return quests;
}

async function generateMatchweekQuests(campaignId: string, matchweek: number) {
  const quests = await buildMatchweekQuests(campaignId, matchweek);
  if (quests.length === 0) {
    return { generated: 0, message: "No new quests to generate for this matchweek" };
  }
  const { error } = await supabase.from("side_quests").insert(quests);
  if (error) throw new Error(`Failed to generate quests: ${error.message}`);
  return { generated: quests.length, matchweek };
}

async function submitEntry(userId: string, questId: string, answer: string) {
  // Verify quest is open
  const { data: quest } = await supabase
    .from("side_quests")
    .select("id, campaign_id, status, locks_at")
    .eq("id", questId)
    .maybeSingle();

  if (!quest) throw new Error("Quest not found");
  if (quest.status !== "open") throw new Error("Quest is no longer accepting entries");

  // Check lock time
  if (quest.locks_at && new Date(quest.locks_at).getTime() <= Date.now()) {
    throw new Error("Quest has locked — entries are closed");
  }

  // Upsert entry
  const { error } = await supabase
    .from("side_quest_entries")
    .upsert({
      user_id: userId,
      quest_id: questId,
      campaign_id: quest.campaign_id,
      answer,
    }, { onConflict: "user_id,quest_id" });

  if (error) throw new Error(`Failed to submit entry: ${error.message}`);
  return { success: true };
}

async function resolveMatchweekQuests(campaignId: string, matchweek: number) {
  // Get all open/locked quests for this matchweek
  const { data: quests } = await supabase
    .from("side_quests")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("matchweek", matchweek)
    .in("status", ["open", "locked"]);

  if (!quests || quests.length === 0) return { resolved: 0 };

  // Get all completed matches for this matchweek
  const { data: matches } = await supabase
    .from("matches")
    .select("id, home_score, away_score, status")
    .eq("campaign_id", campaignId)
    .eq("matchweek", matchweek);

  if (!matches) return { resolved: 0 };

  // Check if all matches are completed
  const allCompleted = matches.every((m) => m.status === "completed");
  if (!allCompleted) return { resolved: 0, message: "Not all matches completed yet" };

  let resolved = 0;
  const affectedUsers = new Set<string>();

  for (const quest of quests) {
    let correctAnswer: string | null = null;

    switch (quest.quest_type) {
      case "total_goals_over_under": {
        const totalGoals = matches.reduce((sum, m) => sum + (m.home_score || 0) + (m.away_score || 0), 0);
        const line = (quest.options_meta as any)?.line || 0;
        correctAnswer = totalGoals > line ? "over" : "under";
        break;
      }
      case "clean_sheet_count": {
        let cleanSheets = 0;
        for (const m of matches) {
          if (m.away_score === 0) cleanSheets++;
          if (m.home_score === 0) cleanSheets++;
        }
        if (cleanSheets >= 5) correctAnswer = "5+";
        else correctAnswer = String(cleanSheets);
        break;
      }
      case "both_teams_score_count": {
        const btsCount = matches.filter((m) => (m.home_score || 0) > 0 && (m.away_score || 0) > 0).length;
        if (btsCount >= 7) correctAnswer = "7+";
        else correctAnswer = String(btsCount);
        break;
      }
      case "player_to_score": {
        const player = (quest.options_meta as any)?.player;
        if (!player) break;
        const matchIds = matches.map((m: any) => m.id);
        let qb = supabase.from("match_goalscorers").select("id").in("match_id", matchIds);
        qb = player.api_id ? qb.eq("player_api_id", player.api_id) : qb.ilike("player_name", player.name);
        const { data: scored } = await qb.limit(1);
        correctAnswer = scored && scored.length > 0 ? "yes" : "no";
        break;
      }
      case "highest_scoring_match": {
        let maxGoals = -1;
        let maxMatchId = "";
        for (const m of matches) {
          const total = (m.home_score || 0) + (m.away_score || 0);
          if (total > maxGoals) {
            maxGoals = total;
            maxMatchId = m.id;
          }
        }
        correctAnswer = maxMatchId;
        break;
      }
    }

    if (correctAnswer === null) continue;

    // Update quest with correct answer
    await supabase
      .from("side_quests")
      .update({ correct_answer: correctAnswer, status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", quest.id);

    // Score all entries for this quest (paginate to avoid the 1000-row cap)
    const entries: Array<{ id: string; user_id: string; answer: string }> = [];
    {
      const PAGE = 1000;
      let from = 0;
      while (true) {
        const { data: page } = await supabase
          .from("side_quest_entries")
          .select("id, user_id, answer")
          .eq("quest_id", quest.id)
          .order("id", { ascending: true })
          .range(from, from + PAGE - 1);
        if (!page || page.length === 0) break;
        entries.push(...page);
        if (page.length < PAGE) break;
        from += PAGE;
      }
    }

    for (const entry of entries) {
      const isCorrect = entry.answer === correctAnswer;
      const points = isCorrect ? quest.point_value : 0;

      await supabase
        .from("side_quest_entries")
        .update({ is_correct: isCorrect, points_awarded: points })
        .eq("id", entry.id);

      if (isCorrect && points > 0) {
        // The bonus lands in the player's total via recomputeUserTotal below,
        // which sums all side-quest entries — no manual increment here.
        affectedUsers.add(entry.user_id);

        // Notify user
        await supabase.from("notifications").insert({
          user_id: entry.user_id,
          type: "side_quest_won",
          title: `Side Quest: +${points} pts!`,
          body: `You got "${quest.title}" right and earned ${points} bonus points!`,
          metadata: { quest_id: quest.id, quest_type: quest.quest_type, points },
        });
      }
    }

    resolved++;
  }

  for (const uid of affectedUsers) {
    await recomputeUserTotal(uid, campaignId);
  }

  return { resolved };
}

// Recompute a player's authoritative total the same way the results scorer does:
// base prediction points + streak-milestone bonuses + side-quest bonuses. Writes
// campaign_participants (what the app reads) and synced_users (legacy mirror).
async function recomputeUserTotal(userId: string, campaignId: string) {
  const { data: rows } = await supabase
    .from("predictions")
    .select("points_awarded, predicted_home_score, predicted_away_score, wants_exact_score_pick, match:matches!predictions_match_id_fkey(home_score, away_score, status)")
    .eq("user_id", userId)
    .eq("campaign_id", campaignId);
  let base = 0;
  let correct = 0;
  let exact = 0;
  for (const r of rows || []) {
    const pts = r.points_awarded || 0;
    base += pts;
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

  let bonus = 0;
  const { data: claims } = await supabase
    .from("streak_milestone_claims")
    .select("milestone:streak_milestones!streak_milestone_claims_milestone_id_fkey(bonus_points)")
    .eq("user_id", userId)
    .eq("campaign_id", campaignId);
  for (const c of claims || []) bonus += (c.milestone as any)?.bonus_points || 0;

  const { data: questEntries } = await supabase
    .from("side_quest_entries")
    .select("points_awarded")
    .eq("user_id", userId)
    .eq("campaign_id", campaignId);
  for (const e of questEntries || []) bonus += e.points_awarded || 0;

  const total = base + bonus;
  await supabase.from("campaign_participants").update({
    total_points: total,
    correct_predictions_count: correct,
    exact_scorelines_count: exact,
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId).eq("campaign_id", campaignId);
  await supabase.from("synced_users").update({
    total_points: total,
    correct_predictions_count: correct,
    exact_scorelines_count: exact,
    updated_at: new Date().toISOString(),
  }).eq("id", userId);
}

async function getUserForEmail(email: string): Promise<string | null> {
  const { data } = await supabase
    .from("synced_users")
    .select("id")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  return data?.id || null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const route = url.pathname.split("/").pop();
    const body = await req.json().catch(() => ({}));

    // Identity comes from signed tokens, never the request body.
    const adminClaims = await verifySession(readAdminToken(req));
    const userClaims = await verifySession(readSessionToken(req));
    const adminEmail = adminClaims?.admin ? adminClaims.email : "";
    const isCron = isServiceRoleRequest(req);

    // Preview quests for a matchweek (admin review — builds but does NOT save)
    if (route === "preview") {
      if (!adminEmail && !isCron) return forbidden();
      const campaign = await getActiveCampaign();
      if (!campaign) {
        return new Response(JSON.stringify({ error: "No active campaign" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const matchweek = Number(body.matchweek);
      if (!matchweek) {
        return new Response(JSON.stringify({ error: "matchweek required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const quests = await buildMatchweekQuests(campaign.id, matchweek);
      return new Response(JSON.stringify({ success: true, matchweek, quests }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create a single custom quest (admin)
    if (route === "create") {
      if (!(await isAdminEmail(adminEmail))) return forbidden();
      const campaign = await getActiveCampaign();
      if (!campaign) return badRequest("No active campaign");
      const q = body.quest || {};
      if (!q.title || !Array.isArray(q.options) || q.options.length < 2) {
        return badRequest("A title and at least two options are required");
      }
      const matchweek = q.matchweek ?? null;
      const locksAt = await resolveCustomLock(
        campaign.id,
        matchweek,
        q.locks_at,
        q.lock_buffer_minutes,
      );
      const { error } = await supabase.from("side_quests").insert({
        campaign_id: campaign.id,
        matchweek,
        quest_type: q.quest_type || "custom",
        title: String(q.title),
        description: q.description || "",
        options: q.options,
        options_meta: q.options_meta || {},
        point_value: Math.max(1, Number(q.point_value) || 10),
        is_auto_generated: false,
        locks_at: locksAt,
        status: "open",
      });
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Publish a reviewed list of suggested quests (admin)
    if (route === "publish") {
      if (!(await isAdminEmail(adminEmail))) return forbidden();
      const campaign = await getActiveCampaign();
      if (!campaign) return badRequest("No active campaign");
      const incoming = Array.isArray(body.quests) ? body.quests : [];
      if (!incoming.length) return badRequest("No quests to publish");
      const rows = incoming.map((q: any) => ({
        campaign_id: campaign.id,
        matchweek: q.matchweek ?? null,
        quest_type: q.quest_type || "custom",
        title: String(q.title),
        description: q.description || "",
        options: q.options,
        options_meta: q.options_meta || {},
        point_value: Math.max(1, Number(q.point_value) || 10),
        is_auto_generated: true,
        locks_at: q.locks_at ?? null,
        status: "open",
      }));
      const { error } = await supabase.from("side_quests").insert(rows);
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ success: true, published: rows.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete a quest and its entries (admin)
    if (route === "delete") {
      if (!(await isAdminEmail(adminEmail))) return forbidden();
      const questId = body.quest_id;
      if (!questId) return badRequest("quest_id required");
      await supabase.from("side_quest_entries").delete().eq("quest_id", questId);
      const { error } = await supabase.from("side_quests").delete().eq("id", questId);
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Manually resolve a quest and score entries (admin)
    if (route === "resolve-manual") {
      if (!(await isAdminEmail(adminEmail))) return forbidden();
      const questId = body.quest_id;
      const answer = body.answer;
      if (!questId || !answer) return badRequest("quest_id and answer required");

      const { data: quest } = await supabase
        .from("side_quests")
        .select("point_value")
        .eq("id", questId)
        .maybeSingle();
      const pointValue = quest?.point_value || 10;

      await supabase.from("side_quests").update({
        correct_answer: answer,
        status: "resolved",
        resolved_at: new Date().toISOString(),
      }).eq("id", questId);

      const entries: Array<{ id: string; user_id: string; answer: string }> = [];
      const PAGE = 1000;
      let start = 0;
      while (true) {
        const { data: page } = await supabase
          .from("side_quest_entries")
          .select("id, user_id, answer")
          .eq("quest_id", questId)
          .order("id", { ascending: true })
          .range(start, start + PAGE - 1);
        if (!page || page.length === 0) break;
        entries.push(...page);
        if (page.length < PAGE) break;
        start += PAGE;
      }

      let scored = 0;
      for (const entry of entries) {
        const isCorrect = entry.answer === answer;
        const points = isCorrect ? pointValue : 0;
        await supabase.from("side_quest_entries")
          .update({ is_correct: isCorrect, points_awarded: points })
          .eq("id", entry.id);
        if (isCorrect && points > 0) {
          const { data: userData } = await supabase
            .from("synced_users").select("total_points").eq("id", entry.user_id).maybeSingle();
          await supabase.from("synced_users").update({
            total_points: (userData?.total_points || 0) + points,
            updated_at: new Date().toISOString(),
          }).eq("id", entry.user_id);
          scored++;
        }
      }

      return new Response(JSON.stringify({ success: true, scored }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // List reusable quest templates (admin)
    if (route === "templates-list") {
      if (!(await isAdminEmail(adminEmail))) return forbidden();
      const campaign = await getActiveCampaign();
      const { data, error } = await supabase
        .from("quest_templates")
        .select("*")
        .or(campaign ? `campaign_id.is.null,campaign_id.eq.${campaign.id}` : "campaign_id.is.null")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ success: true, templates: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create or update a reusable quest template (admin)
    if (route === "template-save") {
      if (!(await isAdminEmail(adminEmail))) return forbidden();
      const campaign = await getActiveCampaign();
      const t = body.template || {};
      if (!t.title || !Array.isArray(t.options) || t.options.length < 2) {
        return badRequest("A title and at least two options are required");
      }
      const payload: Record<string, unknown> = {
        campaign_id: t.global ? null : (campaign?.id ?? null),
        quest_type: t.quest_type || "custom",
        title: String(t.title),
        description: t.description || "",
        options: t.options,
        options_meta: t.options_meta || {},
        point_value: Math.max(1, Number(t.point_value) || 10),
        active: t.active !== false,
        sort_order: Number(t.sort_order) || 0,
        updated_at: new Date().toISOString(),
      };
      if (t.id) {
        const { error } = await supabase.from("quest_templates").update(payload).eq("id", t.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("quest_templates").insert(payload);
        if (error) throw new Error(error.message);
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete a reusable quest template (admin)
    if (route === "template-delete") {
      if (!(await isAdminEmail(adminEmail))) return forbidden();
      if (!body.template_id) return badRequest("template_id required");
      const { error } = await supabase.from("quest_templates").delete().eq("id", body.template_id);
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate quests (admin/cron only)
    if (route === "generate") {
      if (!adminEmail && !isCron) return forbidden();
      const campaign = await getActiveCampaign();
      if (!campaign) {
        return new Response(JSON.stringify({ error: "No active campaign" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const matchweek = Number(body.matchweek);
      if (!matchweek) {
        return new Response(JSON.stringify({ error: "matchweek required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const result = await generateMatchweekQuests(campaign.id, matchweek);
      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Submit entry (user)
    if (route === "submit") {
      if (!userClaims) {
        return new Response(JSON.stringify({ error: "Sign-in required" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const email = (userClaims.email || "").trim().toLowerCase();
      const userId = await getUserForEmail(email);
      if (!userId) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const result = await submitEntry(userId, body.quest_id, body.answer);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve quests for a matchweek (admin/cron)
    if (route === "resolve") {
      if (!adminEmail && !isCron) return forbidden();
      const campaign = await getActiveCampaign();
      if (!campaign) {
        return new Response(JSON.stringify({ error: "No active campaign" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const matchweek = Number(body.matchweek);
      if (!matchweek) {
        return new Response(JSON.stringify({ error: "matchweek required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const result = await resolveMatchweekQuests(campaign.id, matchweek);
      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auto-generate (cron): determine next matchweek and generate quests
    if (route === "side-quests" && body.action === "auto-generate") {
      if (!adminEmail && !isCron) return forbidden();
      const campaign = await getActiveCampaign();
      if (!campaign) {
        return new Response(JSON.stringify({ skipped: true, reason: "No active campaign" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Find the earliest matchweek with unplayed matches
      const { data: nextMatch } = await supabase
        .from("matches")
        .select("matchweek")
        .eq("campaign_id", campaign.id)
        .is("home_score", null)
        .order("kickoff_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!nextMatch?.matchweek) {
        return new Response(JSON.stringify({ skipped: true, reason: "No upcoming matchweek found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const result = await generateMatchweekQuests(campaign.id, nextMatch.matchweek);
      return new Response(JSON.stringify({ success: true, matchweek: nextMatch.matchweek, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown route. Use /generate, /submit, or /resolve" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
