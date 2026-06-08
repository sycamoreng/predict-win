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

const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
const SENDGRID_FROM_EMAIL = Deno.env.get("SENDGRID_FROM_EMAIL") || "no-reply@sycamore.ng";
const SENDGRID_FROM_NAME = Deno.env.get("SENDGRID_FROM_NAME") || "Sycamore Predictor League";

async function getTemplateId(eventName: string): Promise<string | null> {
  const { data } = await supabase
    .from("email_templates")
    .select("sendgrid_template_id, enabled")
    .eq("event_name", eventName)
    .maybeSingle();
  if (!data || !data.enabled) return null;
  return data.sendgrid_template_id;
}

type AdminPermission = "manage_results" | "manage_fixtures" | "view_payouts" | "manage_admins";

const ROLE_PERMISSIONS: Record<string, AdminPermission[]> = {
  super_admin: ["manage_results", "manage_fixtures", "view_payouts", "manage_admins"],
  results: ["manage_results"],
  fixtures: ["manage_fixtures"],
  payouts: ["view_payouts"],
};

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function otpEmailHtml(name: string, code: string): string {
  const safeName = escapeHtml(name || "there");
  return `<!doctype html>
<html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f7f9;padding:32px;color:#1f2937;margin:0;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:18px;padding:32px;box-shadow:0 6px 24px rgba(15,23,42,0.06);">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px;">
      <strong style="font-size:16px;">Sycamore Predictor League</strong>
    </div>
    <h1 style="font-size:22px;margin:0 0 8px 0;">Hello ${safeName},</h1>
    <p style="margin:0 0 24px 0;color:#475569;line-height:1.55;">Use this 6-digit code to sign in. The code expires in 10 minutes.</p>
    <div style="background:#f1f5f9;border-radius:14px;padding:20px;text-align:center;font-size:32px;letter-spacing:10px;font-weight:800;color:#0f172a;">${code}</div>
    <p style="margin:24px 0 0 0;font-size:13px;color:#94a3b8;line-height:1.55;">If you did not request this code you can safely ignore this email.</p>
  </div>
</body></html>`;
}

async function sendOtpEmail(toEmail: string, toName: string, code: string, eventName = "otp_login"): Promise<{ delivered: boolean; provider_status: number | null; error?: string }> {
  if (!SENDGRID_API_KEY) {
    return { delivered: false, provider_status: null, error: "SENDGRID_API_KEY not configured" };
  }

  const templateId = await getTemplateId(eventName);

  const personalizations: Record<string, unknown> = {
    to: [{ email: toEmail, name: toName || undefined }],
  };
  const payload: Record<string, unknown> = {
    from: { email: SENDGRID_FROM_EMAIL, name: SENDGRID_FROM_NAME },
  };

  if (templateId) {
    (personalizations as any).dynamic_template_data = {
      code,
      name: toName || "",
      expires_in_minutes: 10,
    };
    payload.template_id = templateId;
    payload.personalizations = [personalizations];
  } else {
    (personalizations as any).subject = `Your Predictor League code: ${code}`;
    payload.personalizations = [personalizations];
    payload.subject = `Your Predictor League code: ${code}`;
    payload.content = [
      { type: "text/plain", value: `Your code is ${code}. It expires in 10 minutes.` },
      { type: "text/html", value: otpEmailHtml(toName, code) },
    ];
  }

  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { delivered: false, provider_status: res.status, error: text || `SendGrid status ${res.status}` };
    }
    return { delivered: true, provider_status: res.status };
  } catch (err) {
    return { delivered: false, provider_status: null, error: (err as Error).message };
  }
}

async function loadAdmin(email: string) {
  const { data } = await supabase
    .from("admin_users")
    .select("email, name, role")
    .eq("email", email)
    .maybeSingle();
  if (!data) return null;
  return {
    ...data,
    permissions: ROLE_PERMISSIONS[data.role] || [],
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();
    const body = await req.json();
    const email = (body.email || "").trim().toLowerCase();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === "request") {
      const { data: user } = await supabase
        .from("synced_users")
        .select("id, email, name")
        .eq("email", email)
        .maybeSingle();

      const code = generateCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const { error: upsertError } = await supabase
        .from("otp_codes")
        .upsert({ email, code, expires_at: expiresAt }, { onConflict: "email" });

      if (upsertError) {
        return new Response(JSON.stringify({ error: upsertError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const displayName = user?.name || email.split("@")[0];
      const sendResult = await sendOtpEmail(email, displayName, code);

      const responseBody: Record<string, unknown> = {
        success: true,
        message: sendResult.delivered
          ? "OTP sent. Check your email."
          : "OTP generated.",
        delivered: sendResult.delivered,
        isNewUser: !user,
      };

      if (!sendResult.delivered && !SENDGRID_API_KEY) {
        responseBody.devCode = code;
        responseBody.message = "OTP generated (email delivery not configured).";
      } else if (!sendResult.delivered) {
        responseBody.error_detail = sendResult.error;
      }

      return new Response(JSON.stringify(responseBody), {
        status: sendResult.delivered || !SENDGRID_API_KEY ? 200 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === "verify") {
      const code = (body.code || "").trim();

      const { data: entry } = await supabase
        .from("otp_codes")
        .select("code, expires_at")
        .eq("email", email)
        .maybeSingle();

      if (!entry || entry.code !== code || new Date(entry.expires_at).getTime() < Date.now()) {
        return new Response(JSON.stringify({ error: "Invalid or expired code." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("otp_codes").delete().eq("email", email);

      const { data: user } = await supabase
        .from("synced_users")
        .select("*, backed_team:teams!synced_users_backed_team_id_fkey(*)")
        .eq("email", email)
        .maybeSingle();

      if (user) {
        return new Response(JSON.stringify({ success: true, user }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const guestUser = {
        id: `guest_${email}`,
        email,
        name: email.split("@")[0],
        username: null,
        account_number: null,
        active_customer_flag: false,
        qualifying_transactions_count: 0,
        is_account_valid: false,
        total_points: 0,
        backed_team_id: null,
        backed_team: null,
        is_guest: true,
      };

      return new Response(JSON.stringify({ success: true, user: guestUser }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === "admin-request") {
      const { data: adminUser } = await supabase
        .from("admin_users")
        .select("email, name, role")
        .eq("email", email)
        .maybeSingle();

      if (!adminUser) {
        return new Response(
          JSON.stringify({ error: "No admin account found for that email." }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const code = generateCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const { error: upsertError } = await supabase
        .from("otp_codes")
        .upsert({ email, code, expires_at: expiresAt }, { onConflict: "email" });

      if (upsertError) {
        return new Response(JSON.stringify({ error: upsertError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const sendResult = await sendOtpEmail(adminUser.email, adminUser.name, code, "otp_admin_login");

      const responseBody: Record<string, unknown> = {
        success: true,
        message: sendResult.delivered
          ? "OTP sent. Check your email."
          : "OTP generated.",
        delivered: sendResult.delivered,
      };

      if (!sendResult.delivered && !SENDGRID_API_KEY) {
        responseBody.devCode = code;
        responseBody.message = "OTP generated (email delivery not configured).";
      } else if (!sendResult.delivered) {
        responseBody.error_detail = sendResult.error;
      }

      return new Response(JSON.stringify(responseBody), {
        status: sendResult.delivered || !SENDGRID_API_KEY ? 200 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === "admin-verify") {
      const code = (body.code || "").trim();

      const { data: entry } = await supabase
        .from("otp_codes")
        .select("code, expires_at")
        .eq("email", email)
        .maybeSingle();

      if (!entry || entry.code !== code || new Date(entry.expires_at).getTime() < Date.now()) {
        return new Response(JSON.stringify({ error: "Invalid or expired code." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("otp_codes").delete().eq("email", email);

      const adminInfo = await loadAdmin(email);
      if (!adminInfo) {
        return new Response(JSON.stringify({ error: "Admin account not found." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, admin: adminInfo }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown route" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
