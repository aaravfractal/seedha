/**
 * Which deploy this web server is, for the signed-in owner's screens. Only
 * booleans, never an address or a secret. Settings uses `hosted` to show
 * "Reset demo data" on the hosted site to a real owner account only: the API
 * refuses the Direct beta login (subject "demo") there, so the button is
 * hidden for it rather than shown and refused.
 */
import type { NextRequest } from "next/server";
import { jsonError } from "@/lib/authServer";
import { SESSION_COOKIE, nowSeconds, readSession } from "@/lib/session";
import { isHosted } from "@/lib/webEnv";

export type WebMode = { hosted: boolean };

export async function GET(request: NextRequest): Promise<Response> {
  const session = await readSession(
    process.env.SESSION_SECRET ?? "",
    request.cookies.get(SESSION_COOKIE)?.value,
    nowSeconds(),
  );
  if (!session) return jsonError(401, "login_required", "Your session has ended. Sign in again.");
  const body: WebMode = { hosted: isHosted() && session.subject !== "demo" };
  return Response.json(body, { headers: { "cache-control": "no-store" } });
}
