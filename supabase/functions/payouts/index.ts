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

type AdminPermission = "manage_results" | "manage_fixtures" | "view_payouts" | "manage_admins";

const ROLE_PERMISSIONS: Record<string, AdminPermission[]> = {
  super_admin: ["manage_results", "manage_fixtures", "view_payouts", "manage_admins"],
  results: ["manage_results"],
  fixtures: ["manage_fixtures"],
  payouts: ["view_payouts"],
};

const APP_BASE_URL = Deno.env.get("APP_BASE_URL") || "https://play.sycamore.ng";

function deriveFirstName(name: string | null | undefined, username: string | null | undefined, email: string): string {
  if (name) {
    const first = name.split(" ")[0].trim();
    if (first.length >= 2 && /^[A-Za-z]/.test(first)) return first;
  }
  if (username && username.length >= 2) return username;
  return email.split("@")[0];
}

async function adminHasPermission(email: string, permission: AdminPermission): Promise<boolean> {
  const { data } = await supabase
    .from("admin_users")
    .select("role")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (!data) return false;
  return (ROLE_PERMISSIONS[data.role] || []).includes(permission);
}

function weekBounds(refIso?: string): { start: string; end: string } {
  const ref = refIso ? new Date(refIso) : new Date();
  const start = new Date(Date.UTC(
    ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate() - ref.getUTCDay(),
    0, 0, 0, 0,
  ));
  const end = new Date(start.getTime() + 7 * 86_400_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

interface Aggregate {
  user_id: string;
  username: string;
  name: string;
  email: string;
  account_number: string;
  phone_number: string;
  social_handles: Record<string, string> | null;
  week_points: number;
  exact_scorelines: number;
  correct_predictions: number;
  matches_scored: number;
}

async function buildWeeklyWinners(weekStart: string, weekEnd: string, topN: number) {
  const { data: completed } = await supabase
    .from("matches")
    .select("id, home_score, away_score")
    .eq("status", "completed")
    .gte("kickoff_at", weekStart)
    .lt("kickoff_at", weekEnd);

  const matches = completed || [];
  if (matches.length === 0) {
    return { winners: [], match_count: 0 };
  }

  const matchById = new Map<string, { home_score: number; away_score: number }>();
  for (const m of matches) matchById.set(m.id, { home_score: m.home_score, away_score: m.away_score });

  const matchIds = matches.map((m) => m.id);
  const { data: preds } = await supabase
    .from("predictions")
    .select("user_id, match_id, points_awarded, predicted_home_score, predicted_away_score, user:synced_users!predictions_user_id_fkey(id, name, username, email, account_number, phone_number, social_handles, active_customer_flag, is_account_valid)")
    .in("match_id", matchIds);

  const agg = new Map<string, Aggregate>();
  for (const p of preds || []) {
    const u = p.user as any;
    if (!u || !u.active_customer_flag || !u.is_account_valid) continue;
    const pts = p.points_awarded || 0;

    let row = agg.get(u.id);
    if (!row) {
      row = {
        user_id: u.id,
        username: u.username || '',
        name: u.name,
        email: u.email,
        account_number: u.account_number,
        phone_number: u.phone_number,
        social_handles: u.social_handles || null,
        week_points: 0,
        exact_scorelines: 0,
        correct_predictions: 0,
        matches_scored: 0,
      };
      agg.set(u.id, row);
    }
    row.week_points += pts;
    if (pts > 0) row.correct_predictions++;
    const m = matchById.get(p.match_id);
    if (m && m.home_score === p.predicted_home_score && m.away_score === p.predicted_away_score) {
      row.exact_scorelines++;
    }
    row.matches_scored++;
  }

  const winners = [...agg.values()]
    .filter((r) => r.week_points > 0)
    .sort((a, b) => {
      if (b.week_points !== a.week_points) return b.week_points - a.week_points;
      if (b.exact_scorelines !== a.exact_scorelines) return b.exact_scorelines - a.exact_scorelines;
      if (b.correct_predictions !== a.correct_predictions) return b.correct_predictions - a.correct_predictions;
      return a.name.localeCompare(b.name);
    })
    .slice(0, topN)
    .map((r, i) => ({ rank: i + 1, ...r }));

  return { winners, match_count: matches.length };
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

    if (!email || !(await adminHasPermission(email, "view_payouts"))) {
      return new Response(JSON.stringify({ error: "Not authorised." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (route === "weekly") {
      const topN = Math.min(200, Math.max(1, Number(body.top_n) || 25));
      const { start, end } = weekBounds(body.week_of);
      const { winners, match_count } = await buildWeeklyWinners(start, end, topN);
      return new Response(
        JSON.stringify({
          success: true,
          week_start: start,
          week_end: end,
          match_count,
          top_n: topN,
          winners,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (route === "all-weeks") {
      const topN = Math.min(50, Math.max(1, Number(body.top_n) || 10));
      const { data: bounds } = await supabase
        .from("matches")
        .select("kickoff_at")
        .order("kickoff_at", { ascending: true });
      if (!bounds || bounds.length === 0) {
        return new Response(JSON.stringify({ success: true, weeks: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const first = new Date(bounds[0].kickoff_at);
      const last = new Date(bounds[bounds.length - 1].kickoff_at);
      const weeks = [];
      let cursor = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), first.getUTCDate() - first.getUTCDay()));
      const lastEnd = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate() - last.getUTCDay() + 7));
      while (cursor < lastEnd) {
        const wStart = new Date(cursor);
        const wEnd = new Date(cursor.getTime() + 7 * 86_400_000);
        const { winners, match_count } = await buildWeeklyWinners(
          wStart.toISOString(), wEnd.toISOString(), topN,
        );
        weeks.push({
          week_start: wStart.toISOString(),
          week_end: wEnd.toISOString(),
          match_count,
          winners,
        });
        cursor = wEnd;
      }
      return new Response(JSON.stringify({ success: true, weeks }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (route === "mark-paid") {
      const targetEmail = (body.target_email || "").trim().toLowerCase();
      const amount = Number(body.amount);
      const rewardType = (body.reward_type || "").trim();

      if (!targetEmail || !amount || !rewardType) {
        return new Response(
          JSON.stringify({ error: "target_email, amount, and reward_type required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const validTypes = ["Weekly Winner", "Weekly Runner-Up", "Matchday Random Draw", "Grand Prize"];
      if (!validTypes.includes(rewardType)) {
        return new Response(
          JSON.stringify({ error: `reward_type must be one of: ${validTypes.join(", ")}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: targetUser } = await supabase
        .from("synced_users")
        .select("id, email, name, username, account_number")
        .eq("email", targetEmail)
        .maybeSingle();

      if (!targetUser) {
        return new Response(
          JSON.stringify({ error: "User not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const acctNum = targetUser.account_number || "";
      const last4 = acctNum.length >= 4 ? acctNum.slice(-4) : acctNum;

      // Send payout notification email
      const SEND_EMAIL_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`;
      try {
        await fetch(SEND_EMAIL_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            event_name: "payout_notification",
            to_email: targetUser.email,
            to_name: targetUser.name || "",
            dynamic_template_data: {
              firstName: deriveFirstName(targetUser.name, targetUser.username, targetUser.email),
              rewardType: rewardType,
              amount,
              lastFourDigits: last4,
              walletLink: `${APP_BASE_URL}/settings`,
            },
          }),
        });
      } catch { /* best-effort */ }

      // Log the event
      await supabase.from("analytics_events").insert({
        user_id: targetUser.id,
        event_name: "payout_notification",
        properties: {
          admin_email: email,
          reward_type: rewardType,
          amount,
          account_number: acctNum,
        },
        delivered_to_netcore: false,
      });

      return new Response(
        JSON.stringify({
          success: true,
          user: targetEmail,
          amount,
          reward_type: rewardType,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (route === "mark-paid-bulk") {
      const recipients: { email: string; amount: number; reward_type: string }[] = Array.isArray(body.recipients) ? body.recipients : [];
      if (recipients.length === 0) {
        return new Response(
          JSON.stringify({ error: "recipients[] required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (recipients.length > 200) {
        return new Response(
          JSON.stringify({ error: "max 200 recipients per request" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const emails = recipients.map((r) => r.email.trim().toLowerCase());
      const { data: users } = await supabase
        .from("synced_users")
        .select("id, email, name, username, account_number")
        .in("email", emails);

      const userMap = new Map((users || []).map((u) => [u.email, u]));
      const results: { email: string; sent: boolean; error?: string }[] = [];
      const SEND_EMAIL_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`;

      for (const r of recipients) {
        const rEmail = r.email.trim().toLowerCase();
        const u = userMap.get(rEmail);
        if (!u) {
          results.push({ email: rEmail, sent: false, error: "user_not_found" });
          continue;
        }

        const acctNum = u.account_number || "";
        const last4 = acctNum.length >= 4 ? acctNum.slice(-4) : acctNum;

        try {
          await fetch(SEND_EMAIL_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              event_name: "payout_notification",
              to_email: u.email,
              to_name: u.name || "",
              dynamic_template_data: {
                firstName: deriveFirstName(u.name, u.username, u.email),
                rewardType: r.reward_type,
                amount: r.amount,
                lastFourDigits: last4,
                walletLink: `${APP_BASE_URL}/settings`,
              },
            }),
          });
          results.push({ email: rEmail, sent: true });
        } catch {
          results.push({ email: rEmail, sent: false, error: "send_failed" });
        }

        await supabase.from("analytics_events").insert({
          user_id: u.id,
          event_name: "payout_notification",
          properties: {
            admin_email: email,
            reward_type: r.reward_type,
            amount: r.amount,
            account_number: acctNum,
          },
          delivered_to_netcore: false,
        });
      }

      return new Response(
        JSON.stringify({ success: true, processed: results.length, results }),
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
