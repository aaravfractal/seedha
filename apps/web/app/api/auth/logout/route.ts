/** Sign out: clear the session cookie on this device. */
import type { NextRequest } from "next/server";
import { callApi, isSecure, jsonError, sameOrigin } from "@/lib/authServer";
import { clientAddress } from "@/lib/ratelimit";
import { clearSessionCookie } from "@/lib/session";

export async function POST(request: NextRequest): Promise<Response> {
  if (!sameOrigin(request.headers, request.url)) {
    return jsonError(403, "cross_site", "This request came from another site.");
  }
  // Sessions are signed cookies; clearing the cookie ends this one. Tell the
  // API for its records, but never block sign out on it.
  await callApi("auth/logout", { method: "POST", client: clientAddress(request.headers) }).catch(() => null);
  const response = Response.json({ ok: true });
  response.headers.append("set-cookie", clearSessionCookie(isSecure(request.url)));
  return response;
}
