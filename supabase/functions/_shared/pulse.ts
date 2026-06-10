/**
 * Server-side Pulse helper for edge functions.
 * Uses the Pulse HTTP API directly (no SDK state needed).
 * Reuses the same env vars as the Nuxt frontend:
 *   NUXT_PUBLIC_PULSE_API_KEY and NUXT_PUBLIC_PULSE_API_URL
 */

const PULSE_API_URL = () => Deno.env.get("NUXT_PUBLIC_PULSE_API_URL") || "";
const PULSE_API_KEY = () => Deno.env.get("NUXT_PUBLIC_PULSE_API_KEY") || "";

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${PULSE_API_KEY()}`,
    "X-Api-Key": PULSE_API_KEY(),
  };
}

export async function pulseIdentify(
  externalId: string,
  traits: Record<string, unknown>,
): Promise<void> {
  const key = PULSE_API_KEY();
  if (!key) return;
  try {
    await fetch(`${PULSE_API_URL()}/identify`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ external_id: externalId, traits }),
    });
  } catch { /* best-effort, never block the main flow */ }
}

export async function pulseTrack(
  externalId: string,
  event: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  const key = PULSE_API_KEY();
  if (!key) return;
  try {
    await fetch(`${PULSE_API_URL()}/batch`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        events: [{
          external_id: externalId,
          name: event,
          properties: properties || {},
          occurred_at: new Date().toISOString(),
        }],
      }),
    });
  } catch { /* best-effort */ }
}
