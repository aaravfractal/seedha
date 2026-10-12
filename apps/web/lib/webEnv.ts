/**
 * Server-side environment for the web app, read in one place so local demos,
 * make demo-live and the hosted deploy (Vercel web + hosted API) agree.
 * None of these names start with NEXT_PUBLIC_: the API address and the
 * secrets stay on the server and never reach the browser bundle.
 */

export type Env = Record<string, string | undefined>;

const LOCAL_API = "http://localhost:8000";
const LOCAL_WEB = "http://localhost:3000";

function clean(value: string | undefined): string {
  return (value ?? "").trim();
}

/**
 * Where the BFF proxy sends API calls. API_BASE_URL is the hosting name;
 * API_URL (the .env.example name) still works; both empty means the local API.
 * A trailing slash is dropped so `${base}/${path}` never doubles it.
 */
export function apiBaseUrl(env: Env = process.env): string {
  const raw = clean(env.API_BASE_URL) || clean(env.API_URL) || LOCAL_API;
  return raw.replace(/\/+$/, "");
}

/** The full API URL for a path relative to the API root ("ledger/channels"). */
export function apiUrl(path: string, env: Env = process.env): URL {
  return new URL(`${apiBaseUrl(env)}/${path.replace(/^\/+/, "")}`);
}

/**
 * Absolute public origin of the web app (Open Graph metadataBase). Order:
 * WEB_ORIGIN, PUBLIC_BASE_URL, Vercel's production domain (set by Vercel at
 * build time, without a scheme), then localhost. Bad values fall through.
 */
export function siteOrigin(env: Env = process.env): URL {
  const vercel = clean(env.VERCEL_PROJECT_PRODUCTION_URL);
  const candidates = [clean(env.WEB_ORIGIN), clean(env.PUBLIC_BASE_URL), vercel ? `https://${vercel}` : ""];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      if (url.protocol === "https:" || url.protocol === "http:") return new URL(url.origin);
    } catch {
      // try the next one
    }
  }
  return new URL(LOCAL_WEB);
}

/** SEEDHA_HOSTED=1: the hosted deploy, where a signed-in owner may reset the sample hotel. */
export function isHosted(env: Env = process.env): boolean {
  return clean(env.SEEDHA_HOSTED) === "1";
}

/** SEEDHA_PUBLIC=1: make demo-live (Cloudflare tunnel from the demo laptop). */
export function isPublicMode(env: Env = process.env): boolean {
  return clean(env.SEEDHA_PUBLIC) === "1";
}

/** The values published in .env.example; nobody may run a real site with them. */
export const DEMO_SECRETS: ReadonlySet<string> = new Set([
  "demo-session-secret-change-me-32chars",
  "demo-owner-token-change-me",
  "demo-desk-key-change-me",
]);

/** A production build outside the local demo (SEEDHA_DEMO empty). */
function strictProduction(env: Env): boolean {
  return env.NODE_ENV === "production" && clean(env.SEEDHA_DEMO) !== "1";
}

/**
 * Why the web server must not sign anyone in, or null when it may. Empty
 * secrets always fail; in a production build without SEEDHA_DEMO=1 the
 * published demo values and a short session secret fail too (S14).
 */
export function loginSecretsProblem(env: Env = process.env): string | null {
  const token = env.OWNER_API_TOKEN ?? "";
  const secret = env.SESSION_SECRET ?? "";
  if (!token || !secret) return "OWNER_API_TOKEN or SESSION_SECRET is not set";
  const weak = DEMO_SECRETS.has(token) || DEMO_SECRETS.has(secret) || secret.length < 32;
  if (weak && strictProduction(env)) return "Set your own OWNER_API_TOKEN and SESSION_SECRET";
  return null;
}

/** Whether the BFF may act as the Desk box: a key is set and, in strict production, not the demo one. */
export function deviceKeyUsable(env: Env = process.env): boolean {
  const key = env.DESK_DEVICE_KEY ?? "";
  if (!key) return false;
  return !(strictProduction(env) && DEMO_SECRETS.has(key));
}

/**
 * Proof that a request to the API came through this web server (hosting
 * security review S-H1). The API trusts the client address in
 * X-Forwarded-For only when this header matches; a direct caller of the
 * API's public URL is limited by the address its proxy saw instead.
 * HMAC-SHA256 of a fixed label keyed by OWNER_API_TOKEN, so no new secret.
 */
export async function proxyProof(token: string | undefined = process.env.OWNER_API_TOKEN): Promise<string> {
  if (!token) return "";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(token),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("seedha-proxy"));
  return Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, "0")).join("");
}
