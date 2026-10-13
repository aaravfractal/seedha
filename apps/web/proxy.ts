/**
 * Runs before every page and API request (Next 16 "proxy", formerly middleware).
 *
 * 1. Hotel hosts (<slug>.<SITE_ROOT_DOMAIN>, and <slug>.localhost in
 *    development; lib/siteHost.ts): "/" shows the hotel's public page
 *    (rewritten to /h/<slug>, with the strict hotel page headers), the page's
 *    own public API GETs, its offline service worker and its one card-scan
 *    POST pass, and every other path is a 404, so a hotel address never
 *    serves an owner screen, a sign-in route or any other API write. A
 *    renamed hotel 308s to its new host.
 * 2. App host /h/<slug>: a renamed slug 308s to /h/<new> (for 30 days), an
 *    unknown or unpublished one is a 404 "This hotel site isn't live yet".
 *    The old /hotel/<slug> address 308s to /h/<slug>.
 * 3. Optimistic page guard (unchanged): owner screens (and onboarding)
 *    redirect to /login without a valid session. The real check happens again
 *    in /api/* for every data request. /login, /signup, /otp and /demo stay public.
 *
 * Owner cookies are host-only (lib/session.ts sets no Domain attribute), so a
 * browser never sends them to a hotel host.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { hotelPageHeaders } from "@/lib/hotelSiteV2";
import { clientAddress } from "@/lib/ratelimit";
import { SESSION_COOKIE, nowSeconds, verifySession } from "@/lib/session";
import {
  hotelHost,
  hotelPathAllowed,
  hotelPathSlug,
  legacyHotelPath,
  movedHostUrl,
  rootDomain,
  slugProblem,
} from "@/lib/siteHost";
import { apiUrl, proxyProof } from "@/lib/webEnv";

const OWNER_PATHS: ReadonlySet<string> = new Set([
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
  "/desk/device",
  "/rate-card",
  "/agent-deck",
  "/onboard",
  "/my-place",
  "/inbox",
  "/assistant",
  "/calendar",
  "/billing",
]);

const NOT_LIVE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>This hotel site isn't live yet</title>
<style>body{margin:0;min-height:100svh;display:grid;place-items:center;font:17px/1.5 system-ui,sans-serif;
background:#fbfbfd;color:#1d1d1f;padding:16px;text-align:center}h1{font-size:24px;margin:0 0 8px}
p{color:#6e6e73;margin:0}@media (prefers-color-scheme:dark){body{background:#000;color:#f5f5f7}p{color:#a1a1a6}}</style>
</head><body><main><h1>This hotel site isn't live yet</h1><p>Check the link the hotel sent you.</p></main></body></html>`;

type Resolved = { state: "live" | "moved" | "none"; slug: string };

/** Where a slug leads, from the API. null when the API cannot answer (the page then shows its own error). */
async function resolveSlug(slug: string, request: NextRequest): Promise<Resolved | null> {
  try {
    const res = await fetch(apiUrl(`public/site/${encodeURIComponent(slug)}/resolve`), {
      cache: "no-store",
      headers: {
        // Rate limits apply per guest, as for every other public call (lib/bff.ts).
        "x-forwarded-for": clientAddress(request.headers),
        "x-seedha-proxy": await proxyProof(),
      },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as Partial<Resolved>;
    return body.state && typeof body.slug === "string" ? (body as Resolved) : null;
  } catch {
    return null;
  }
}

function notLive(): NextResponse {
  return new NextResponse(NOT_LIVE_HTML, {
    status: 404,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-robots-tag": "noindex",
      "cache-control": "no-store",
    },
  });
}

function notFound(): NextResponse {
  return new NextResponse(null, { status: 404, headers: { "x-robots-tag": "noindex" } });
}

/** A request to <slug>.<root>: the hotel's page and its public reads only. */
async function hotelHostResponse(request: NextRequest, slug: string, root: string): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;
  if (!hotelPathAllowed(pathname, request.method, slug)) return notFound();
  if (pathname !== "/") return NextResponse.next();
  const found = await resolveSlug(slug, request);
  if (found?.state === "none") return notLive();
  if (found?.state === "moved") {
    const host = request.headers.get("host") ?? "";
    return NextResponse.redirect(movedHostUrl(request.nextUrl, host, found.slug, root), 308);
  }
  const page = NextResponse.rewrite(new URL(`/h/${slug}${search}`, request.url));
  // The strict hotel page headers (next.config.ts matches /h/<slug>, but here the page is at "/").
  for (const { key, value } of hotelPageHeaders(process.env.NODE_ENV !== "production"))
    page.headers.set(key, value);
  return page;
}

/** /h/<slug> on the app host: live passes, renamed redirects, anything else is not live. */
async function hotelPathResponse(request: NextRequest, slug: string): Promise<NextResponse> {
  if (slugProblem(slug) === "slug_invalid") return notLive();
  const found = await resolveSlug(slug, request);
  if (found?.state === "none") return notLive();
  if (found?.state === "moved") {
    const url = request.nextUrl.clone();
    url.pathname = `/h/${found.slug}`;
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

/** Owner screens without a valid session go to /login (same as before hotel addresses). */
async function ownerGuard(request: NextRequest): Promise<NextResponse> {
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

export async function proxy(request: NextRequest): Promise<NextResponse> {
  // Read at request time on the server (never NEXT_PUBLIC_, never in the browser bundle).
  const hotel = hotelHost(request.headers.get("host") ?? "", rootDomain(process.env.SITE_ROOT_DOMAIN));
  if (hotel) return hotelHostResponse(request, hotel.slug, hotel.root);

  const { pathname } = request.nextUrl;
  const legacy = legacyHotelPath(pathname);
  if (legacy) {
    const url = request.nextUrl.clone();
    url.pathname = legacy;
    return NextResponse.redirect(url, 308);
  }
  const slug = hotelPathSlug(pathname);
  if (slug !== null) return hotelPathResponse(request, slug);
  if (OWNER_PATHS.has(pathname)) return ownerGuard(request);
  return NextResponse.next();
}

export const config = {
  // Every path except Next's static files: a hotel host must be checked on all of them.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
