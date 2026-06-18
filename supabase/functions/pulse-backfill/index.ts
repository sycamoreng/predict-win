import "jsr:@supabase/functions-js/edge-runtime.d.ts";
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

const PULSE_API_URL = Deno.env.get("NUXT_PUBLIC_PULSE_API_URL") || "";
const PULSE_API_KEY = Deno.env.get("NUXT_PUBLIC_PULSE_API_KEY") || "";

function pulseHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${PULSE_API_KEY}`,
    "X-Api-Key": PULSE_API_KEY,
  };
}

async function sendBatch(events: Array<Record<string, unknown>>): Promise<boolean> {
  if (!PULSE_API_KEY || !PULSE_API_URL || events.length === 0) return false;
  try {
    const res = await fetch(`${PULSE_API_URL}/batch`, {
      method: "POST",
      headers: pulseHeaders(),
      body: JSON.stringify({ events }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (!PULSE_API_KEY || !PULSE_API_URL) {
    return new Response(JSON.stringify({ error: "Pulse not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const batchSize = Number(body.batch_size) || 50;
    const offset = Number(body.offset) || 0;
    const limit = Number(body.limit) || 500;
    const dryRun = body.dry_run === true;

    // Load user email lookup
    const { data: users } = await supabase
      .from("synced_users")
      .select("id, email");
    const emailById = new Map<string, string>();
    for (const u of users || []) {
      emailById.set(u.id, u.email);
    }

    // Load analytics events in chunks
    const { data: events, error: fetchErr } = await supabase
      .from("analytics_events")
      .select("id, user_id, event_name, properties, created_at")
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);

    if (fetchErr) {
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!events || events.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: "No more events to backfill",
        offset,
        processed: 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map to Pulse events with original timestamps
    const pulseEvents = events.map((evt) => {
      const email = evt.user_id ? emailById.get(evt.user_id) : null;
      const externalId = email || evt.user_id || "system";
      const props = evt.properties || {};

      return {
        external_id: externalId,
        name: evt.event_name,
        properties: {
          ...props,
          user_id: evt.user_id,
          backfilled: true,
          original_event_id: evt.id,
        },
        occurred_at: evt.created_at,
      };
    });

    if (dryRun) {
      return new Response(JSON.stringify({
        success: true,
        dry_run: true,
        events_count: pulseEvents.length,
        sample: pulseEvents.slice(0, 3),
        next_offset: offset + events.length,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send in batches
    let sent = 0;
    let failed = 0;
    for (let i = 0; i < pulseEvents.length; i += batchSize) {
      const batch = pulseEvents.slice(i, i + batchSize);
      const ok = await sendBatch(batch);
      if (ok) {
        sent += batch.length;
      } else {
        failed += batch.length;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      offset,
      processed: events.length,
      sent,
      failed,
      next_offset: offset + events.length,
      has_more: events.length === limit,
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
