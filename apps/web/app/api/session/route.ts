/** Owner login (POST) and logout (DELETE). Sets an httpOnly signed cookie. */
import type { NextRequest } from "next/server";
import { LOGIN_LIMIT, RateLimiter, clientAddress } from "@/lib/ratelimit";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, nowSeconds, safeEqual, signSession } from "@/lib/session";

const loginAttempts = new RateLimiter();

function error(status: number, code: string, message: string, headers?: HeadersInit): Response {
  return Response.json({ error: { code, message } }, { status, headers });
}

export async function POST(request: NextRequest): Promise<Response> {
  const passcode = process.env.OWNER_PASSCODE ?? "";
  const secret = process.env.SESSION_SECRET ?? "";
  if (!passcode || !secret) {
    return error(503, "login_not_configured", "OWNER_PASSCODE or SESSION_SECRET is not set");
  }
  const wait = loginAttempts.check(clientAddress(request.headers), LOGIN_LIMIT);
  if (wait > 0) {
    const minutes = Math.ceil(wait / 60);
    return error(
      429,
      "too_many_requests",
      `Too many tries. Wait ${minutes} minute${minutes === 1 ? "" : "s"} and try again.`,
      { "retry-after": String(wait) },
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(422, "invalid_input", "Send JSON with a passcode");
  }
  const given =
    typeof body === "object" && body !== null && "passcode" in body && typeof body.passcode === "string"
      ? body.passcode
      : "";
  if (!given || given.length > 200) return error(422, "invalid_input", "Enter the passcode");
  if (!safeEqual(given, passcode)) return error(401, "wrong_passcode", "That passcode is not right");

  const response = Response.json({ ok: true });
  const value = await signSession(secret, nowSeconds());
  const secure = request.nextUrl.protocol === "https:" ? "; Secure" : "";
  response.headers.append(
    "set-cookie",
    `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure}`,
  );
  return response;
}

export async function DELETE(): Promise<Response> {
  const response = Response.json({ ok: true });
  response.headers.append("set-cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return response;
}
