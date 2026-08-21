// Signed session tokens ("wristbands").
//
// A caller proves who they are with an HMAC-signed token issued at login,
// instead of putting a plain email in the request body. The signing key is
// the service-role key, which is present in every function's environment and
// never reaches the browser, so a client cannot forge a token.

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function b64urlFromBytes(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlFromString(s: string): string {
  return b64urlFromBytes(encoder.encode(s));
}

function bytesFromB64url(s: string): Uint8Array {
  let t = s.replace(/-/g, "+").replace(/_/g, "/");
  while (t.length % 4) t += "=";
  const bin = atob(t);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

let keyPromise: Promise<CryptoKey> | null = null;
function getKey(): Promise<CryptoKey> {
  if (!keyPromise) {
    const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!secret) throw new Error("Session signing secret unavailable");
    keyPromise = crypto.subtle.importKey(
      "raw",
      encoder.encode("app-session-v1:" + secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
  }
  return keyPromise;
}

export interface SessionClaims {
  uid: string;
  email: string;
  admin?: boolean;
  role?: string;
  perms?: string[];
  iat?: number;
  exp?: number;
}

const DEFAULT_TTL_SEC = 60 * 60 * 24 * 30; // 30 days

export async function issueSession(
  claims: Omit<SessionClaims, "iat" | "exp">,
  ttlSec = DEFAULT_TTL_SEC,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionClaims = { ...claims, iat: now, exp: now + ttlSec };
  const body = b64urlFromString(JSON.stringify(payload));
  const key = await getKey();
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(body)));
  return `${body}.${b64urlFromBytes(sig)}`;
}

// Returns the claims when the token is present, correctly signed, and unexpired;
// otherwise null. crypto.subtle.verify performs a constant-time comparison.
export async function verifySession(token: string | null | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const key = await getKey();
  let ok = false;
  try {
    ok = await crypto.subtle.verify("HMAC", key, bytesFromB64url(sig), encoder.encode(body));
  } catch {
    return null;
  }
  if (!ok) return null;
  let payload: SessionClaims;
  try {
    payload = JSON.parse(decoder.decode(bytesFromB64url(body)));
  } catch {
    return null;
  }
  if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) return null;
  if (!payload.uid || !payload.email) return null;
  return payload;
}

// Reads the caller's session token from the standard app header.
export function readSessionToken(req: Request): string | null {
  return req.headers.get("x-app-token");
}

export function readAdminToken(req: Request): string | null {
  return req.headers.get("x-app-admin-token");
}
