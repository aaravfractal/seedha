/**
 * Sign out (DELETE) clears the owner session cookie. Signing in now happens
 * through /api/auth/* (WhatsApp code or Direct beta login); the passcode
 * login is gone (FRONTEND_MASTER D4).
 */
import type { NextRequest } from "next/server";
import { isSecure } from "@/lib/authServer";
import { clearSessionCookie } from "@/lib/session";

export async function DELETE(request: NextRequest): Promise<Response> {
  const response = Response.json({ ok: true });
  response.headers.append("set-cookie", clearSessionCookie(isSecure(request.url)));
  return response;
}
