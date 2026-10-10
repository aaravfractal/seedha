/** Direct beta login: one tap into the fictional sample hotel, no code. */
import type { NextRequest } from "next/server";
import { callApi, guard, isSecure, readJson, relay, unreachable } from "@/lib/authServer";
import { clientAddress } from "@/lib/ratelimit";
import {
  LONG_SESSION_TTL_SECONDS,
  SESSION_TTL_SECONDS,
  nowSeconds,
  sessionCookie,
  signSession,
} from "@/lib/session";

export async function POST(request: NextRequest): Promise<Response> {
  const refused = guard(request, "demo");
  if (refused) return refused;
  const remember = (await readJson(request))?.remember === true;
  let result;
  try {
    result = await callApi("auth/demo", { method: "POST", client: clientAddress(request.headers) });
  } catch {
    return unreachable();
  }
  if (result.status !== 200) return relay(result);
  const value = await signSession(process.env.SESSION_SECRET ?? "", nowSeconds(), {
    subject: "demo",
    ttlSeconds: remember ? LONG_SESSION_TTL_SECONDS : SESSION_TTL_SECONDS,
  });
  const response = Response.json({ ok: true, onboarded: true });
  response.headers.append("set-cookie", sessionCookie(value, { remember, secure: isSecure(request.url) }));
  return response;
}
