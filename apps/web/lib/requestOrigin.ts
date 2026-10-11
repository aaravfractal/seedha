/**
 * Pure helpers about where a request came from: whether the session cookie
 * may carry `Secure`, and whether a request is from the machine running
 * Seedha (make demo-live keeps "Reset demo data" local).
 */

/** The host name without a port, lower case ("[::1]:3000" becomes "::1"). */
export function hostName(host: string): string {
  const h = host.trim().toLowerCase();
  if (h.startsWith("[")) return h.slice(1, h.indexOf("]") > 0 ? h.indexOf("]") : undefined);
  return h.split(":")[0] ?? "";
}

/** True for names only this machine or this Wi-Fi network can reach. */
export function isLocalNetworkHost(name: string): boolean {
  if (name === "localhost" || name === "::1" || name.endsWith(".local")) return true;
  const parts = name.split(".");
  if (parts.length !== 4 || !parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255)) return false;
  const [a, b] = parts.map(Number) as [number, number, number, number];
  return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

/** True for this machine only (the browser on the laptop running the demo). */
export function isLoopbackHost(name: string): boolean {
  return name === "localhost" || name === "::1" || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(name);
}

/**
 * Whether the session cookie gets `Secure`. Always on https (directly or
 * behind a TLS proxy such as the Cloudflare tunnel). On plain http it is never
 * set for localhost or a private Wi-Fi address (make demo-lan: phones would
 * drop a Secure cookie and sign in would fail). Production on any other host
 * keeps `Secure` (security review S12).
 */
export function cookieSecure(input: { proto: string | null; host: string; production: boolean }): boolean {
  const proto = input.proto?.split(",")[0]?.trim().toLowerCase().replace(/:$/, "");
  if (proto === "https") return true;
  return input.production && !isLocalNetworkHost(hostName(input.host));
}

/** The only Host headers a browser on the demo laptop sends (make demo-live uses port 3000). */
export const LOCAL_HOSTS = ["localhost:3000", "127.0.0.1:3000"];

/**
 * Whether a request reached the web server directly from this machine, not
 * through the Cloudflare tunnel. Cloudflare always adds cf-connecting-ip and
 * cf-ray (a client cannot remove them) and keeps the public Host, so a tunnel
 * request fails at least one test here.
 */
export function isLocalRequest(headers: Headers, allowed: readonly string[] = LOCAL_HOSTS): boolean {
  const host = headers.get("host");
  if (host === null || !allowed.includes(host.toLowerCase())) return false;
  if (headers.has("cf-connecting-ip") || headers.has("cf-ray")) return false;
  const forwarded = headers.get("x-forwarded-host");
  return forwarded === null || forwarded.toLowerCase() === host.toLowerCase();
}

/** In public mode (SEEDHA_PUBLIC=1), refuse demo/reset unless it comes from this machine. */
export function refuseRemoteReset(path: readonly string[], headers: Headers, publicMode: boolean): boolean {
  if (!publicMode) return false;
  const isReset = path.filter(Boolean).join("/").toLowerCase().startsWith("demo/reset");
  return isReset && !isLocalRequest(headers);
}
