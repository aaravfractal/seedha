/**
 * Optimistic page guard: owner screens (and onboarding) redirect to /login
 * without a valid session. The real check happens again in /api/* for every
 * data request. /login, /signup, /otp and /demo stay public.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, nowSeconds, verifySession } from "@/lib/session";

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const ok = await verifySession(
    process.env.SESSION_SECRET ?? "",
    request.cookies.get(SESSION_COOKIE)?.value,
    nowSeconds(),
  );
  if (ok) return NextResponse.next();
  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/",
    "/home",
    "/upload",
    "/flip",
    "/repeat",
    "/scenario",
    "/approvals",
    "/savings",
    "/ask",
    "/site",
    "/proof",
    "/pro",
    "/settings",
    "/desk",
    "/rate-card",
    "/onboard",
  ],
};
