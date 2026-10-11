/**
 * Which API paths the browser may reach through /api/*, and with what auth.
 *
 * owner  - needs a valid owner session; the server adds OWNER_API_TOKEN.
 * device - the Desk simulator (owner session) acting as the Desk box; the
 *          server adds DESK_DEVICE_KEY.
 * public - guest pages (consent, Seedha Link, data deletion), no session.
 * Anything else is refused, so the proxy can never be used to reach an
 * unlisted API route.
 */

export type Access = "owner" | "device" | "public";

const RULES: ReadonlyArray<readonly [string, Access]> = [
  ["desk/poll", "device"],
  ["desk/ack", "device"],
  ["public/", "public"],
  ["health", "public"],
  ["property", "owner"],
  ["pipeline", "owner"],
  ["overview", "owner"],
  ["rooms", "owner"],
  ["ledger", "owner"],
  ["statements", "owner"],
  ["repeat", "owner"],
  ["scenario", "owner"],
  ["desk/", "owner"],
  ["messages", "owner"],
  ["savings", "owner"],
  ["proof", "owner"],
  ["ask", "owner"],
  ["inbox", "owner"],
  ["assistant", "owner"],
  ["site", "owner"],
  ["pro", "owner"],
  ["demo", "owner"],
  ["settings", "owner"],
  ["calendar", "owner"],
  ["events", "owner"],
  ["my-place", "owner"],
];

const SAFE_SEGMENT = /^[A-Za-z0-9._~-]+$/;

/** Access level for an API path, or null when the path is not allowed. */
export function accessFor(path: string): Access | null {
  const segments = path.split("/");
  if (segments.length === 0 || !segments.every((s) => SAFE_SEGMENT.test(s) && s !== "..")) {
    return null;
  }
  for (const [prefix, access] of RULES) {
    if (prefix.endsWith("/") ? path.startsWith(prefix) : path === prefix || path.startsWith(`${prefix}/`)) {
      return access;
    }
  }
  return null;
}
