import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { pulseIdentify, pulseTrack } from "../_shared/pulse.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Sync-Secret",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const APP_BASE_URL = Deno.env.get("APP_BASE_URL") || "https://play.sycamore.ng";

function deriveFirstName(name: string | null | undefined, username: string | null | undefined, email: string): string {
  if (name) {
    const first = name.split(" ")[0].trim();
    if (first.length >= 2 && /^[A-Za-z]/.test(first)) return first;
  }
  if (username && username.length >= 2) return username;
  return email.split("@")[0];
}

interface InboundRecord {
  // Fields we persist locally
  customer_id?: string;
  user_id?: string;
  email?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  account_number?: string;
  bank_name?: string;
  active_customer_flag?: boolean;
  // Extended traits from Core (forwarded to Pulse, not stored locally)
  gender?: string;
  state?: string;
  country?: string;
  tier?: string;
  tag?: string;
  registration_type?: string;
  signup_platform?: string;
  user_status?: string;
  email_verified?: boolean;
  phone_verified?: boolean;
  signup_date?: string;
  has_tag?: boolean;
  has_wallet?: boolean;
  total_loans_count?: number;
  qualifying_loans_count?: number;
  is_borrower?: boolean;
  all_loans_rejected?: boolean;
  last_loan_at?: string;
  total_investments_count?: number;
  qualifying_investments_count?: number;
  is_investor?: boolean;
  last_investment_at?: string;
  successful_target_contribution_transactions_count?: number;
  is_contributor?: boolean;
  last_target_contribution_transaction_at?: string;
  total_transactions_count?: number;
  successful_transactions_count?: number;
  first_successful_transaction_at?: string;
  last_successful_transaction_at?: string;
  active_user_no_loan_investment?: boolean;
  qualifying_transactions_count?: number;
}

interface NormalisedRecord {
  email: string;
  name: string;
  phone_number: string;
  account_number: string | null;
  bank_name: string | null;
  active_customer_flag: boolean;
  is_account_valid: boolean;
  qualifying_transactions_count: number;
  core_user_id: string | null;
  core_signup_at: string | null;
  signup_platform: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NUBAN_RE = /^\d{10}$/;

function validate(rec: InboundRecord): { ok: true; row: NormalisedRecord } | { ok: false; reason: string } {
  const email = (rec.email || "").trim().toLowerCase();
  const rawName = (rec.name || "").trim();
  const name = rawName || [rec.first_name, rec.last_name].filter(Boolean).join(" ").trim();
  const phone = (rec.phone_number || "").trim();
  const account = (rec.account_number || "").trim();

  if (!email || !EMAIL_RE.test(email)) return { ok: false, reason: "invalid_email" };

  const flag = rec.active_customer_flag ?? false;
  const txCount = Number.isFinite(rec.qualifying_transactions_count)
    ? Math.max(0, Math.floor(rec.qualifying_transactions_count as number))
    : 0;
  const coreUserId = (rec.user_id || "").trim() || null;
  const bankName = (rec.bank_name || "").trim() || null;

  let coreSignupAt: string | null = null;
  if (rec.signup_date) {
    const parsed = new Date(rec.signup_date);
    if (!Number.isNaN(parsed.getTime())) coreSignupAt = parsed.toISOString();
  }
  const signupPlatform = (rec.signup_platform || "").trim() || null;

  return {
    ok: true,
    row: {
      email,
      name: name || email.split("@")[0],
      phone_number: phone,
      account_number: account || null,
      bank_name: bankName,
      active_customer_flag: !!flag,
      is_account_valid: account ? NUBAN_RE.test(account) : false,
      qualifying_transactions_count: txCount,
      core_user_id: coreUserId,
      core_signup_at: coreSignupAt,
      signup_platform: signupPlatform,
    },
  };
}

function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

function authorise(req: Request): boolean {
  const expected = Deno.env.get("CORE_SYNC_SECRET");
  if (!expected) return false;
  const provided = req.headers.get("X-Sync-Secret") || "";
  return constantTimeEqual(provided, expected);
}

function extractPulseTraits(rec: InboundRecord): Record<string, unknown> {
  const traits: Record<string, unknown> = {};
  if (rec.name) traits.name = rec.name.trim();
  if (rec.first_name) traits.first_name = rec.first_name;
  if (rec.last_name) traits.last_name = rec.last_name;
  if (rec.email) traits.email = rec.email.trim().toLowerCase();
  if (rec.phone_number) traits.phone = rec.phone_number.trim();
  if (rec.account_number) traits.account_number = rec.account_number.trim();
  if (rec.customer_id) traits.customer_id = rec.customer_id;
  if (rec.gender) traits.gender = rec.gender;
  if (rec.state) traits.state = rec.state;
  if (rec.country) traits.country = rec.country;
  if (rec.tier) traits.tier = rec.tier;
  if (rec.tag) traits.tag = rec.tag;
  if (rec.registration_type) traits.registration_type = rec.registration_type;
  if (rec.signup_platform) traits.signup_platform = rec.signup_platform;
  if (rec.user_status) traits.user_status = rec.user_status;
  if (rec.email_verified !== undefined) traits.email_verified = rec.email_verified;
  if (rec.phone_verified !== undefined) traits.phone_verified = rec.phone_verified;
  if (rec.signup_date) traits.signup_date = rec.signup_date;
  if (rec.has_tag !== undefined) traits.has_tag = rec.has_tag;
  if (rec.has_wallet !== undefined) traits.has_wallet = rec.has_wallet;
  if (rec.total_loans_count !== undefined) traits.total_loans_count = rec.total_loans_count;
  if (rec.qualifying_loans_count !== undefined) traits.qualifying_loans_count = rec.qualifying_loans_count;
  if (rec.is_borrower !== undefined) traits.is_borrower = rec.is_borrower;
  if (rec.all_loans_rejected !== undefined) traits.all_loans_rejected = rec.all_loans_rejected;
  if (rec.last_loan_at) traits.last_loan_at = rec.last_loan_at;
  if (rec.total_investments_count !== undefined) traits.total_investments_count = rec.total_investments_count;
  if (rec.qualifying_investments_count !== undefined) traits.qualifying_investments_count = rec.qualifying_investments_count;
  if (rec.is_investor !== undefined) traits.is_investor = rec.is_investor;
  if (rec.last_investment_at) traits.last_investment_at = rec.last_investment_at;
  if (rec.successful_target_contribution_transactions_count !== undefined) traits.successful_target_contribution_transactions_count = rec.successful_target_contribution_transactions_count;
  if (rec.is_contributor !== undefined) traits.is_contributor = rec.is_contributor;
  if (rec.last_target_contribution_transaction_at) traits.last_target_contribution_transaction_at = rec.last_target_contribution_transaction_at;
  if (rec.total_transactions_count !== undefined) traits.total_transactions_count = rec.total_transactions_count;
  if (rec.successful_transactions_count !== undefined) traits.successful_transactions_count = rec.successful_transactions_count;
  if (rec.first_successful_transaction_at) traits.first_successful_transaction_at = rec.first_successful_transaction_at;
  if (rec.last_successful_transaction_at) traits.last_successful_transaction_at = rec.last_successful_transaction_at;
  if (rec.active_user_no_loan_investment !== undefined) traits.active_user_no_loan_investment = rec.active_user_no_loan_investment;
  if (rec.active_customer_flag !== undefined) traits.active_customer = !!rec.active_customer_flag;
  if (rec.qualifying_transactions_count !== undefined) traits.qualifying_transactions_count = rec.qualifying_transactions_count;
  traits.first_encounter = "sycamore_core";
  return traits;
}

async function identifyAndTrackUser(rec: InboundRecord, existingUser: { id: string; core_user_id?: string | null } | null) {
  const email = (rec.email || "").trim().toLowerCase();
  const coreUserId = (rec.user_id || "").trim() || existingUser?.core_user_id || null;
  const externalId = coreUserId || email;
  const traits = extractPulseTraits(rec);

  await pulseIdentify(externalId, traits);

  if (!existingUser) {
    await pulseTrack(externalId, "sycamore_account_created", {
      email,
      country: rec.country || null,
      state: rec.state || null,
      gender: rec.gender || null,
      signup_platform: rec.signup_platform || null,
      source: "core_sync",
    });
  }
}

async function upsertOne(row: NormalisedRecord, isNew: boolean) {
  const payload: Record<string, unknown> = {
    ...row,
    updated_at: new Date().toISOString(),
  };
  // Only write core_user_id if provided (don't overwrite existing with null)
  if (!row.core_user_id) delete payload.core_user_id;
  // Only write bank_name if provided (don't overwrite existing with null)
  if (!row.bank_name) delete payload.bank_name;
  // Only write Sycamore signup metadata if provided (don't null out existing)
  if (!row.core_signup_at) delete payload.core_signup_at;
  if (!row.signup_platform) delete payload.signup_platform;
  // Record signup origin ONLY when creating a brand-new account, so an
  // existing Play guest who later opens a Sycamore account keeps origin "play".
  if (isNew) payload.signup_source = "sycamore";

  const { error } = await supabase
    .from("synced_users")
    .upsert(payload, { onConflict: "email" });
  if (error) throw new Error(error.message);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (!authorise(req)) {
      return new Response(JSON.stringify({ error: "Invalid sync secret." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const route = url.pathname.split("/").pop();
    const body = await req.json().catch(() => ({}));

    if (route === "upsert") {
      const result = validate(body);
      if (!result.ok) {
        return new Response(JSON.stringify({ error: result.reason }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if user already exists (to determine if this is a new account)
      const { data: existing } = await supabase
        .from("synced_users")
        .select("id, core_user_id")
        .eq("email", result.row.email)
        .maybeSingle();

      await upsertOne(result.row, !existing);

      // Fire Pulse identify + events (non-blocking)
      identifyAndTrackUser(body as InboundRecord, existing).catch(() => {});

      return new Response(
        JSON.stringify({ success: true, email: result.row.email, is_account_valid: result.row.is_account_valid }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (route === "bulk") {
      const records: InboundRecord[] = Array.isArray(body.records) ? body.records : [];
      if (records.length === 0) {
        return new Response(JSON.stringify({ error: "records[] required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (records.length > 1000) {
        return new Response(JSON.stringify({ error: "max 1000 records per request" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const accepted: NormalisedRecord[] = [];
      const rejected: { email: string; reason: string }[] = [];
      for (const r of records) {
        const result = validate(r);
        if (result.ok) accepted.push(result.row);
        else rejected.push({ email: r.email || "", reason: result.reason });
      }

      // Lookup existing users to determine new vs existing
      const existingMap = new Map<string, { core_user_id: string | null }>();
      if (accepted.length > 0) {
        const { data: existingRows } = await supabase
          .from("synced_users")
          .select("email, core_user_id")
          .in("email", accepted.map((a) => a.email));
        for (const row of existingRows || []) {
          existingMap.set(row.email, { core_user_id: row.core_user_id });
        }
      }

      if (accepted.length > 0) {
        const { error } = await supabase
          .from("synced_users")
          .upsert(
            accepted.map((row) => {
              const payload: Record<string, unknown> = { ...row, updated_at: new Date().toISOString() };
              if (!row.core_user_id) delete payload.core_user_id;
              if (!row.bank_name) delete payload.bank_name;
              if (!row.core_signup_at) delete payload.core_signup_at;
              if (!row.signup_platform) delete payload.signup_platform;
              // Stamp origin only for brand-new accounts; never overwrite an
              // existing player's recorded signup source.
              if (!existingMap.has(row.email)) payload.signup_source = "sycamore";
              return payload;
            }),
            { onConflict: "email" },
          );
        if (error) throw new Error(error.message);
      }

      // Fire Pulse identify + events for all records (non-blocking)
      for (const rec of records) {
        const email = (rec.email || "").trim().toLowerCase();
        if (!email) continue;
        const existing = existingMap.get(email);
        const isExisting = !!existing;
        identifyAndTrackUser(rec, isExisting ? { id: email, core_user_id: existing?.core_user_id } : null).catch(() => {});
      }

      return new Response(
        JSON.stringify({
          success: true,
          accepted: accepted.length,
          rejected: rejected.length,
          rejected_detail: rejected,
          invalid_accounts: accepted.filter((a) => !a.is_account_valid).map((a) => a.email),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (route === "active-customer-flag") {
      const email = (body.email || "").trim().toLowerCase();
      const flag = !!body.active_customer_flag;
      const txCountRaw = body.qualifying_transactions_count;
      const txCount = Number.isFinite(txCountRaw)
        ? Math.max(0, Math.floor(Number(txCountRaw)))
        : null;
      if (!email || !EMAIL_RE.test(email)) {
        return new Response(JSON.stringify({ error: "invalid_email" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: existing } = await supabase
        .from("synced_users")
        .select("id, active_customer_flag, core_user_id, name, username")
        .eq("email", email)
        .maybeSingle();
      if (!existing) {
        return new Response(JSON.stringify({ error: "user_not_found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const update: Record<string, unknown> = {
        active_customer_flag: flag,
        updated_at: new Date().toISOString(),
      };
      if (txCount !== null) update.qualifying_transactions_count = txCount;
      // Store core_user_id if provided and not yet set
      const inboundCoreId = (body.user_id || "").trim();
      if (inboundCoreId && !existing.core_user_id) update.core_user_id = inboundCoreId;
      const { error } = await supabase
        .from("synced_users")
        .update(update)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);

      // Track activation in Pulse
      const pulseExternalId = existing.core_user_id || email;
      const wasInactive = !existing.active_customer_flag;
      if (flag && wasInactive) {
        pulseIdentify(pulseExternalId, { active_customer: true, qualifying_transactions_count: txCount }).catch(() => {});
        pulseTrack(pulseExternalId, "customer_activated", {
          email,
          qualifying_transactions_count: txCount,
        }).catch(() => {});

        // Newly eligible: leaderboard + power-up chips just unlocked. Send the
        // "you're in" email (best-effort; skips if no template id is set yet).
        const firstName = deriveFirstName(existing.name, existing.username, email);
        const sendEmailUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`;
        fetch(sendEmailUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            event_name: "eligibility_unlocked",
            to_email: email,
            to_name: existing.name || firstName,
            dynamic_template_data: {
              firstName,
              leaderboardLink: `${APP_BASE_URL}/leaderboard`,
              predictLink: `${APP_BASE_URL}/predict`,
            },
          }),
        }).catch(() => {});
      }

      // Forward extended traits to Pulse if provided
      if (body.gender || body.state || body.country || body.tier || body.signup_platform) {
        const traits: Record<string, unknown> = {};
        if (body.gender) traits.gender = body.gender;
        if (body.state) traits.state = body.state;
        if (body.country) traits.country = body.country;
        if (body.tier) traits.tier = body.tier;
        if (body.signup_platform) traits.signup_platform = body.signup_platform;
        pulseIdentify(pulseExternalId, traits).catch(() => {});
      }

      return new Response(
        JSON.stringify({
          success: true,
          email,
          active_customer_flag: flag,
          qualifying_transactions_count: txCount,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (route === "result") {
      const { winning_team_id, winning_team_name, winning_team_code, match_id, triggered_at, opted_in_users, status: batchStatus } = body;

      if (!winning_team_id || !Array.isArray(opted_in_users) || opted_in_users.length === 0) {
        return new Response(JSON.stringify({ error: "winning_team_id and opted_in_users[] required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const processed: { account_number: string; status: string }[] = [];
      const emailQueue: { event_name: string; to_email: string; data: Record<string, unknown> }[] = [];

      for (const u of opted_in_users) {
        const userStatus = u.status || batchStatus || "completed";
        const resolved = userStatus === "completed" || userStatus === "failed";

        const updatePayload: Record<string, unknown> = {
          status: userStatus === "completed" ? "completed" : userStatus === "failed" ? "failed" : "pending",
          updated_at: new Date().toISOString(),
        };
        if (resolved) updatePayload.resolved_at = new Date().toISOString();
        if (u.failure_reason) updatePayload.failure_reason = u.failure_reason;
        if (u.core_reference) updatePayload.core_reference = u.core_reference;

        const { error } = await supabase
          .from("sweep_results")
          .update(updatePayload)
          .eq("idempotency_key", u.idempotency_key);

        if (error) {
          processed.push({ account_number: u.account_number, status: "db_error" });
          continue;
        }

        processed.push({ account_number: u.account_number, status: updatePayload.status as string });

        if (resolved) {
          const { data: sweepRow } = await supabase
            .from("sweep_results")
            .select("user_id")
            .eq("idempotency_key", u.idempotency_key)
            .maybeSingle();

          let userEmail: string | null = null;
          let userName: string | null = null;
          let userUsername: string | null = null;
          let userCoreId: string | null = null;
          if (sweepRow?.user_id) {
            const { data: usr } = await supabase
              .from("synced_users")
              .select("email, name, username, core_user_id")
              .eq("id", sweepRow.user_id)
              .maybeSingle();
            userEmail = usr?.email || null;
            userName = usr?.name || null;
            userUsername = usr?.username || null;
            userCoreId = usr?.core_user_id || null;

            // Track sweep result in Pulse (prefer core_user_id, fallback to email)
            const pulseId = userCoreId || userEmail || sweepRow.user_id;
            pulseTrack(pulseId, "sweep_result_received", {
              status: userStatus,
              team_name: winning_team_name || null,
              amount: u.amount || null,
              match_id: match_id || null,
            }).catch(() => {});
          }

          if (userEmail) {
            const eventName = userStatus === "completed"
              ? "team_win_sweep_completed"
              : "team_win_sweep_skipped";

            const firstName = deriveFirstName(userName, userUsername, userEmail);
            const lastFourDigits = (u.account_number || "").slice(-4) || null;
            emailQueue.push({
              event_name: eventName,
              to_email: userEmail,
              data: userStatus === "completed" ? {
                firstName,
                amount: u.amount,
                teamName: winning_team_name || "",
                lastFourDigits,
                savingsLink: `${APP_BASE_URL}/settings`,
              } : {
                firstName,
                amount: u.amount,
                lastFourDigits,
                fundLink: `${APP_BASE_URL}/settings`,
              },
            });
          }
        }
      }

      // Fire emails via send-email function
      if (emailQueue.length > 0) {
        const sendEmailUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`;
        try {
          await fetch(sendEmailUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify(
              emailQueue.map((e) => ({
                event_name: e.event_name,
                to_email: e.to_email,
                dynamic_template_data: e.data,
              })),
            ),
          });
        } catch { /* best-effort */ }
      }

      return new Response(
        JSON.stringify({
          success: true,
          winning_team_id,
          match_id: match_id || null,
          processed_count: processed.length,
          processed,
        }),
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
