/** Who is signed in (owner account or the Direct beta login demo). */
import type { NextRequest } from "next/server";
import { callApi, jsonError, relay, unreachable } from "@/lib/authServer";
import { clientAddress } from "@/lib/ratelimit";
import { SESSION_COOKIE, nowSeconds, readSession } from "@/lib/session";

export async function GET(request: NextRequest): Promise<Response> {
  const session = await readSession(
    process.env.SESSION_SECRET ?? "",
    request.cookies.get(SESSION_COOKIE)?.value,
    nowSeconds(),
  );
  if (!session) return jsonError(401, "login_required", "Your session has ended. Sign in again.");
  try {
    return relay(
      await callApi("me", {
        method: "GET",
        subject: session.subject,
        client: clientAddress(request.headers),
      }),
    );
  } catch {
    return unreachable();
  }
}
