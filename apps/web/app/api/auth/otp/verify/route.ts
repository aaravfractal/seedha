/** Check a sign-in code; on success set the signed session cookie. */
import type { NextRequest } from "next/server";
import { OTP_DIGITS, normalisePhone } from "@/lib/auth";
import { callApi, guard, isSecure, jsonError, readJson, relay, unreachable } from "@/lib/authServer";
import { clientAddress } from "@/lib/ratelimit";
import {
  LONG_SESSION_TTL_SECONDS,
  SESSION_TTL_SECONDS,
  nowSeconds,
  sessionCookie,
  signSession,
} from "@/lib/session";

type Verified = { verified: boolean; account: { subject: string; onboarded: boolean } | null };

export async function POST(request: NextRequest): Promise<Response> {
  const refused = guard(request, "verify");
  if (refused) return refused;
  const body = await readJson(request);
  const phone = typeof body?.phone === "string" ? body.phone : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const remember = body?.remember === true;
  if (!normalisePhone(phone)) {
    return jsonError(422, "invalid_phone", "Enter a 10-digit mobile number starting with 6, 7, 8 or 9.");
  }
  if (!new RegExp(`^\\d{${OTP_DIGITS}}$`).test(code)) {
    return jsonError(422, "invalid_code", "Enter the 6-digit code.");
  }
  let result;
  try {
    result = await callApi("auth/otp/verify", {
      method: "POST",
      body: { phone, code },
      client: clientAddress(request.headers),
    });
  } catch {
    return unreachable();
  }
  if (result.status !== 200) return relay(result);
  const account = (result.body as Verified | null)?.account;
  if (!account) {
    return jsonError(404, "no_account", "There is no account for this number yet. Create one to continue.");
  }
  const value = await signSession(process.env.SESSION_SECRET ?? "", nowSeconds(), {
    subject: account.subject,
    ttlSeconds: remember ? LONG_SESSION_TTL_SECONDS : SESSION_TTL_SECONDS,
  });
  const response = Response.json({ ok: true, onboarded: account.onboarded });
  response.headers.append("set-cookie", sessionCookie(value, { remember, secure: isSecure(request) }));
  return response;
}
