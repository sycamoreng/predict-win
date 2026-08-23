import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { verifySession, readAdminToken } from "../_shared/session.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-App-Token, X-App-Admin-Token",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Range = { from?: string | null; to?: string | null };

function withDate(query: any, r: Range, col = "created_at") {
  if (r.from) query = query.gte(col, r.from);
  if (r.to) query = query.lte(col, r.to);
  return query;
}

async function countUsers(build: (q: any) => any): Promise<number> {
  const { count } = await build(
    supabase.from("synced_users").select("*", { count: "exact", head: true }),
  );
  return count || 0;
}

type UserFilter =
  | "all" | "with_account" | "no_account" | "active_customers" | "backed_team" | "auto_savings";

function applyUserFilter(query: any, filter: UserFilter) {
  if (filter === "with_account") query = query.not("account_number", "is", null).neq("account_number", "");
  else if (filter === "no_account") query = query.or("account_number.is.null,account_number.eq.");
  else if (filter === "active_customers") query = query.eq("active_customer_flag", true);
  else if (filter === "backed_team") query = query.not("backed_team_id", "is", null);
  else if (filter === "auto_savings") query = query.eq("auto_savings_enabled", true);
  return query;
}

async function predictionCountsFor(userIds: string[]): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  if (!userIds.length) return counts;
  const PAGE = 1000;
  let start = 0;
  while (true) {
    const { data } = await supabase
      .from("predictions")
      .select("user_id")
      .in("user_id", userIds)
      .order("user_id", { ascending: true })
      .range(start, start + PAGE - 1);
    if (!data || data.length === 0) break;
    for (const p of data) counts[p.user_id] = (counts[p.user_id] || 0) + 1;
    if (data.length < PAGE) break;
    start += PAGE;
  }
  return counts;
}

const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ["manage_results", "manage_fixtures", "view_payouts", "manage_admins", "view_users"],
  results: ["manage_results"],
  fixtures: ["manage_fixtures"],
  payouts: ["view_payouts"],
  support: ["view_users"],
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const adminClaims = await verifySession(readAdminToken(req));
    const admin_email = adminClaims?.admin ? adminClaims.email : "";
    if (!admin_email) return json({ error: "Admin sign-in required" }, 401);

    const { data: adminUser } = await supabase
      .from("admin_users")
      .select("role")
      .eq("email", String(admin_email).trim().toLowerCase())
      .maybeSingle();
    if (!adminUser) return json({ error: "Not authorised" }, 403);
    if (!(ROLE_PERMISSIONS[adminUser.role] || []).includes("view_users")) {
      return json({ error: "Not authorised" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const mode = String(body?.mode || "");
    const range: Range = { from: body?.from ?? null, to: body?.to ?? null };
    const cid: string | null = body?.campaign_id ?? null;

    if (mode === "stats") {
      const isTournament = !!body?.is_tournament;

      const totalUsers = await countUsers((q) => withDate(q, range));
      const sycamoreUsers = await countUsers((q) => withDate(q.not("account_number", "is", null), range));
      const guestUsers = await countUsers((q) => withDate(q.is("account_number", null), range));
      const playOriginUsers = await countUsers((q) => withDate(q.eq("signup_source", "play"), range));
      const sycamoreOriginUsers = await countUsers((q) => withDate(q.eq("signup_source", "sycamore"), range));
      const playConvertedToSycamore = await countUsers((q) =>
        withDate(q.eq("signup_source", "play").not("account_number", "is", null), range));
      const activeCustomers = await countUsers((q) => withDate(q.eq("active_customer_flag", true), range));
      const usersWithTeam = await countUsers((q) => withDate(q.not("backed_team_id", "is", null), range));

      let campaignUsers = 0, campaignWithAccount = 0, campaignGuests = 0, campaignActive = 0;
      if (cid) {
        const partBase = () => supabase
          .from("campaign_participants")
          .select("*, synced_users!inner(account_number, active_customer_flag)", { count: "exact", head: true })
          .eq("campaign_id", cid);
        campaignUsers = (await partBase()).count || 0;
        campaignWithAccount = (await partBase().not("synced_users.account_number", "is", null)).count || 0;
        campaignGuests = (await partBase().is("synced_users.account_number", null)).count || 0;
        campaignActive = (await partBase().eq("synced_users.active_customer_flag", true)).count || 0;
      }

      let savingsEnabled = 0, totalSavingsAmount = 0;
      if (isTournament) {
        savingsEnabled = await countUsers((q) => withDate(q.eq("auto_savings_enabled", true), range));
        const PAGE = 1000;
        let start = 0;
        while (true) {
          let q = supabase.from("synced_users")
            .select("auto_savings_amount")
            .eq("auto_savings_enabled", true)
            .not("auto_savings_amount", "is", null);
          q = withDate(q, range);
          const { data } = await q.order("id", { ascending: true }).range(start, start + PAGE - 1);
          if (!data || data.length === 0) break;
          totalSavingsAmount += data.reduce((s: number, r: any) => s + (r.auto_savings_amount || 0), 0);
          if (data.length < PAGE) break;
          start += PAGE;
        }
      }

      return json({
        totalUsers, sycamoreUsers, guestUsers, playOriginUsers, sycamoreOriginUsers,
        playConvertedToSycamore, activeCustomers, usersWithTeam,
        campaignUsers, campaignWithAccount, campaignGuests, campaignActive,
        savingsEnabled, totalSavingsAmount,
      });
    }

    if (mode === "guest-list") {
      const { data: guests } = await supabase
        .from("synced_users")
        .select("id, email, username, social_handles, created_at")
        .is("account_number", null)
        .order("created_at", { ascending: false })
        .limit(100);
      const ids = (guests || []).map((g: any) => g.id);
      const predCounts = await predictionCountsFor(ids);
      return json({
        rows: (guests || []).map((g: any) => ({
          email: g.email,
          username: g.username || "",
          social_handles: g.social_handles || null,
          created_at: g.created_at,
          prediction_count: predCounts[g.id] || 0,
        })),
      });
    }

    if (mode === "guest-export") {
      const all: any[] = [];
      const PAGE = 1000;
      let offset = 0;
      while (true) {
        let q = supabase.from("synced_users")
          .select("id, email, name, username, phone_number, social_handles, created_at, total_points")
          .is("account_number", null)
          .order("created_at", { ascending: false })
          .range(offset, offset + PAGE - 1);
        q = withDate(q, range);
        const { data } = await q;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < PAGE) break;
        offset += PAGE;
      }
      const predCounts = await predictionCountsFor(all.map((g) => g.id));
      return json({
        rows: all.map((g) => ({ ...g, prediction_count: predCounts[g.id] || 0 })),
      });
    }

    if (mode === "acquisition") {
      if (!cid) return json({ totalOrganic: 0, neverTransacted: 0, becameActive: 0, conversionRate: 0 });
      const origin = String(body?.origin || "all");
      const base = () => {
        let q = supabase
          .from("campaign_participants")
          .select("user_id, synced_users!inner(is_staff, qualifying_transactions_count, active_customer_flag, signup_source)", { count: "exact", head: true })
          .eq("campaign_id", cid)
          .eq("synced_users.is_staff", false);
        if (origin === "play" || origin === "sycamore") q = q.eq("synced_users.signup_source", origin);
        q = withDate(q, range, "joined_at");
        return q;
      };
      const totalOrganic = (await base()).count || 0;
      const neverTransacted = (await base()
        .eq("synced_users.qualifying_transactions_count", 0)
        .eq("synced_users.active_customer_flag", false)).count || 0;
      const becameActive = totalOrganic - neverTransacted;
      return json({
        totalOrganic,
        neverTransacted,
        becameActive,
        conversionRate: totalOrganic > 0 ? Math.round((becameActive / totalOrganic) * 100) : 0,
      });
    }

    if (mode === "acquisition-export") {
      if (!cid) return json({ rows: [] });
      const origin = String(body?.origin || "all");
      const all: any[] = [];
      const PAGE = 1000;
      let offset = 0;
      while (true) {
        let q = supabase
          .from("campaign_participants")
          .select("joined_at, synced_users!inner(id, email, name, username, phone_number, social_handles, created_at, total_points, backed_team_id, is_staff, qualifying_transactions_count, active_customer_flag, signup_source)")
          .eq("campaign_id", cid)
          .eq("synced_users.is_staff", false)
          .eq("synced_users.qualifying_transactions_count", 0)
          .eq("synced_users.active_customer_flag", false)
          .order("joined_at", { ascending: false });
        if (origin === "play" || origin === "sycamore") q = q.eq("synced_users.signup_source", origin);
        q = withDate(q, range, "joined_at");
        const { data } = await q.range(offset, offset + PAGE - 1);
        if (!data || data.length === 0) break;
        all.push(...data.map((r: any) => ({ ...r.synced_users, joined_at: r.joined_at })));
        if (data.length < PAGE) break;
        offset += PAGE;
      }
      return json({ rows: all });
    }

    if (mode === "users-list") {
      const filter = (body?.filter || "all") as UserFilter;
      const search = String(body?.search || "").trim();
      const countOnly = !!body?.count_only;
      const limit = Number.isFinite(body?.limit) ? Number(body.limit) : 1000;
      const offset = Number.isFinite(body?.offset) ? Number(body.offset) : 0;

      const buildFilters = (q: any) => {
        q = applyUserFilter(q, filter);
        q = withDate(q, range);
        if (search) {
          const safe = search.replace(/[(),*]/g, "");
          q = q.or(`email.ilike.%${safe}%,username.ilike.%${safe}%`);
        }
        return q;
      };

      if (countOnly) {
        const { count } = await buildFilters(
          supabase.from("synced_users").select("*", { count: "exact", head: true }),
        );
        return json({ count: count || 0 });
      }

      const { data } = await buildFilters(supabase.from("synced_users").select("*"))
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      return json({ rows: data || [] });
    }

    return json({ error: "Unknown mode" }, 404);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
