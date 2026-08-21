import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
const SENDGRID_FROM_EMAIL =
  Deno.env.get("SENDGRID_FROM_EMAIL") || "no-reply@sycamore.ng";
const SENDGRID_FROM_NAME =
  Deno.env.get("SENDGRID_FROM_NAME") || "Sycamore Predictor League";

interface SendRequest {
  event_name: string;
  to_email: string;
  to_name?: string;
  dynamic_template_data: Record<string, unknown>;
}

async function getTemplate(
  eventName: string,
): Promise<{ sendgrid_template_id: string | null; enabled: boolean } | null> {
  const { data } = await supabase
    .from("email_templates")
    .select("sendgrid_template_id, enabled")
    .eq("event_name", eventName)
    .maybeSingle();
  return data;
}

async function sendEmail(
  req: SendRequest,
): Promise<{ delivered: boolean; reason?: string; status?: number }> {
  if (!SENDGRID_API_KEY) {
    return { delivered: false, reason: "SENDGRID_API_KEY not configured" };
  }

  const template = await getTemplate(req.event_name);
  if (!template) {
    return { delivered: false, reason: `No template row for event: ${req.event_name}` };
  }
  if (!template.enabled) {
    return { delivered: false, reason: "Template disabled" };
  }
  if (!template.sendgrid_template_id) {
    return {
      delivered: false,
      reason: `No sendgrid_template_id set for event: ${req.event_name}`,
    };
  }

  const payload = {
    from: { email: SENDGRID_FROM_EMAIL, name: SENDGRID_FROM_NAME },
    personalizations: [
      {
        to: [{ email: req.to_email, name: req.to_name || undefined }],
        dynamic_template_data: req.dynamic_template_data,
      },
    ],
    template_id: template.sendgrid_template_id,
  };

  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { delivered: false, reason: text || `SendGrid ${res.status}`, status: res.status };
    }
    return { delivered: true, status: res.status };
  } catch (err) {
    return { delivered: false, reason: (err as Error).message };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authToken = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (authToken !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
      return new Response(JSON.stringify({ error: "Not authorised" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    // Support batch sends: accept a single request or an array
    const requests: SendRequest[] = Array.isArray(body) ? body : [body];
    const results: Array<{ to: string; event: string; delivered: boolean; reason?: string }> = [];

    for (const r of requests) {
      if (!r.event_name || !r.to_email) {
        results.push({
          to: r.to_email || "unknown",
          event: r.event_name || "unknown",
          delivered: false,
          reason: "event_name and to_email required",
        });
        continue;
      }

      const result = await sendEmail(r);

      // Log to analytics_events
      await supabase.from("analytics_events").insert({
        user_id: null,
        event_name: r.event_name,
        properties: {
          to_email: r.to_email,
          to_name: r.to_name,
          template_data: r.dynamic_template_data,
          delivered: result.delivered,
          reason: result.reason,
        },
        delivered_to_netcore: false,
      });

      results.push({
        to: r.to_email,
        event: r.event_name,
        delivered: result.delivered,
        reason: result.reason,
      });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
