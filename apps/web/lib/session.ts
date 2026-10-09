/**
 * Owner session cookie: "<expiresEpochSeconds>.<hmacHex>", signed with
 * SESSION_SECRET using HMAC-SHA256 (Web Crypto, so it runs in Proxy and in
 * Route Handlers). Holds no personal data.
 */

export const SESSION_COOKIE = "seedha_owner";
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

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

/** Create a signed session value that expires after the TTL. */
export async function signSession(secret: string, nowSeconds: number): Promise<string> {
  const expires = nowSeconds + SESSION_TTL_SECONDS;
  return `${expires}.${await hmacHex(secret, `owner.${expires}`)}`; // pragma: allowlist secret (not a secret: signature format)
}

/** True when the value is well formed, correctly signed and not expired. */
export async function verifySession(
  secret: string,
  value: string | undefined,
  nowSeconds: number,
): Promise<boolean> {
  if (!secret || !value) return false;
  const [expiresText, signature] = value.split(".");
  const expires = Number(expiresText);
  if (!Number.isInteger(expires) || !signature || expires <= nowSeconds) return false;
  return safeEqual(signature, await hmacHex(secret, `owner.${expires}`));
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
