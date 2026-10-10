/**
 * Owner session cookie: "<expiresEpochSeconds>.<subject>.<hmacHex>", signed
 * with SESSION_SECRET using HMAC-SHA256 (Web Crypto, so it runs in Proxy and
 * in Route Handlers). The subject is "demo" (Direct beta login) or
 * "a<accountId>" (WhatsApp code sign in). No personal data is stored.
 */

export const SESSION_COOKIE = "seedha_owner";
/** Default lifetime: the signature expires after 12 hours. */
export const SESSION_TTL_SECONDS = 12 * 60 * 60;
/** "Keep me signed in on this device for 30 days". */
export const LONG_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

const SUBJECT = /^(demo|a\d{1,12})$/;
const encoder = new TextEncoder();

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time comparison of two strings of equal expected length. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isSubject(value: string): boolean {
  return SUBJECT.test(value);
}

export type SessionOptions = { subject?: string; ttlSeconds?: number };

/** Create a signed session value that expires after the TTL. */
export async function signSession(
  secret: string,
  nowSeconds: number,
  options: SessionOptions = {},
): Promise<string> {
  const subject = options.subject ?? "demo";
  if (!isSubject(subject)) throw new Error("Bad session subject");
  const expires = nowSeconds + (options.ttlSeconds ?? SESSION_TTL_SECONDS);
  return `${expires}.${subject}.${await hmacHex(secret, `owner.${expires}.${subject}`)}`; // pragma: allowlist secret (not a secret: signature format)
}

export type SessionInfo = { subject: string; expires: number };

/** The subject and expiry when the value is well formed, correctly signed and not expired. */
export async function readSession(
  secret: string,
  value: string | undefined,
  nowSeconds: number,
): Promise<SessionInfo | null> {
  if (!secret || !value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [expiresText = "", subject = "", signature = ""] = parts;
  const expires = Number(expiresText);
  if (!Number.isInteger(expires) || expires <= nowSeconds || !isSubject(subject) || !signature) return null;
  const ok = safeEqual(signature, await hmacHex(secret, `owner.${expires}.${subject}`));
  return ok ? { subject, expires } : null;
}

/** True when the value is well formed, correctly signed and not expired. */
export async function verifySession(
  secret: string,
  value: string | undefined,
  nowSeconds: number,
): Promise<boolean> {
  return (await readSession(secret, value, nowSeconds)) !== null;
}

/**
 * Set-Cookie header for a session. Without `remember` the cookie lasts for
 * the browser session (and the signature for 12 hours); with it, 30 days.
 */
export function sessionCookie(value: string, options: { remember: boolean; secure: boolean }): string {
  const maxAge = options.remember ? `; Max-Age=${LONG_SESSION_TTL_SECONDS}` : "";
  const secure = options.secure ? "; Secure" : "";
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax${maxAge}${secure}`;
}

/** Set-Cookie header that removes the session. */
export function clearSessionCookie(secure: boolean): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
