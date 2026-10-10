/** Onboarding answers for the signed-in owner. The sample hotel saves nothing. */
import type { NextRequest } from "next/server";
import { callApi, jsonError, readJson, relay, sameOrigin, unreachable } from "@/lib/authServer";
import { clientAddress } from "@/lib/ratelimit";
import { SESSION_COOKIE, nowSeconds, readSession } from "@/lib/session";

async function subjectOf(request: NextRequest): Promise<string | null> {
  const session = await readSession(
    process.env.SESSION_SECRET ?? "",
    request.cookies.get(SESSION_COOKIE)?.value,
    nowSeconds(),
  );
  return session?.subject ?? null;
}

export async function GET(request: NextRequest): Promise<Response> {
  const subject = await subjectOf(request);
  if (!subject) return jsonError(401, "login_required", "Your session has ended. Sign in again.");
  try {
    return relay(
      await callApi("onboarding", { method: "GET", subject, client: clientAddress(request.headers) }),
    );
  } catch {
    return unreachable();
  }
}

export async function PATCH(request: NextRequest): Promise<Response> {
  const subject = await subjectOf(request);
  if (!subject) return jsonError(401, "login_required", "Your session has ended. Sign in again.");
  if (!sameOrigin(request.headers, request.url)) {
    return jsonError(403, "cross_site", "This request came from another site.");
  }
  const body = await readJson(request);
  if (!body) return jsonError(422, "invalid_input", "Send the step answers as JSON.");
  try {
    return relay(
      await callApi("onboarding", { method: "PATCH", body, subject, client: clientAddress(request.headers) }),
    );
  } catch {
    return unreachable();
  }
}
