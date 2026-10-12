/**
 * Backend-for-frontend proxy. The browser calls /api/<path>; this handler
 * checks the owner session where needed and forwards to the FastAPI service
 * with the server-only OWNER_API_TOKEN or DESK_DEVICE_KEY attached.
 */
import type { NextRequest } from "next/server";
import { accessFor } from "@/lib/bff";
import { sameOrigin } from "@/lib/authServer";
import { API_BODY_BYTES, readCapped } from "@/lib/body";
import {
  FORWARD_REQUEST_HEADERS,
  FORWARD_RESPONSE_HEADERS,
  hasNoBody,
  pickHeaders,
} from "@/lib/proxyHeaders";
import { clientAddress } from "@/lib/ratelimit";
import { refuseRemoteReset } from "@/lib/requestOrigin";
import { SESSION_COOKIE, nowSeconds, readSession } from "@/lib/session";
import { apiUrl, deviceKeyUsable, isHosted, isPublicMode, proxyProof } from "@/lib/webEnv";

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

async function forward(request: NextRequest, path: string[]): Promise<Response> {
  const joined = path.join("/");
  const access = accessFor(joined);
  if (access === null) return errorResponse(404, "not_found", "No such API route");
  // make demo-live: only the laptop running the demo may reset it, never a tunnel visitor.
  // Hosted (SEEDHA_HOSTED=1): the owner session below and the API decide.
  if (refuseRemoteReset(path, request.headers, isPublicMode(), isHosted())) {
    return errorResponse(403, "reset_local_only", "Reset works only on the computer running the demo");
  }

  const headers = pickHeaders(request.headers, FORWARD_REQUEST_HEADERS);
  // The API rate-limits public routes per guest; uvicorn trusts this header
  // from the loopback BFF and resolves it into the client address. On Vercel
  // the edge overwrites X-Forwarded-For with the real client IP, so its last
  // entry is the visitor, not a value the browser chose.
  headers.set("x-forwarded-for", clientAddress(request.headers));
  headers.set("x-seedha-proxy", await proxyProof());
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  // Writes must come from this site (security review S4; cookies are SameSite=Lax too).
  if (hasBody && !sameOrigin(request.headers, request.url)) {
    return errorResponse(403, "cross_site", "This request came from another site.");
  }
  if (access !== "public") {
    const session = await readSession(
      process.env.SESSION_SECRET ?? "",
      request.cookies.get(SESSION_COOKIE)?.value,
      nowSeconds(),
    );
    if (!session) return errorResponse(401, "login_required", "Please log in again");
    // The API decides what this session may run (security review S1).
    headers.set("x-seedha-subject", session.subject);
  }
  if (access === "owner") headers.set("authorization", `Bearer ${process.env.OWNER_API_TOKEN ?? ""}`);
  if (access === "device") {
    // A production site must not act as the Desk with the published demo key.
    if (!deviceKeyUsable()) {
      return errorResponse(503, "desk_not_configured", "Set your own DESK_DEVICE_KEY for the Desk");
    }
    headers.set("x-device-key", process.env.DESK_DEVICE_KEY ?? "");
  }

  const target = apiUrl(joined);
  target.search = request.nextUrl.search;
  const body = hasBody ? await readCapped(request, API_BODY_BYTES) : undefined;
  if (body === null) {
    return errorResponse(413, "body_too_large", "That file is too large. The limit is 10 MB.");
  }
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: body ? Buffer.from(body) : undefined,
      cache: "no-store",
    });
    const responseHeaders = pickHeaders(upstream.headers, FORWARD_RESPONSE_HEADERS);
    // A 304 (the browser's cached photo is current) has no body.
    const out = hasNoBody(upstream.status) ? null : upstream.body;
    return new Response(out, { status: upstream.status, headers: responseHeaders });
  } catch {
    return errorResponse(502, "api_unreachable", "Seedha API is not reachable. Is it running?");
  }
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, ctx: Ctx): Promise<Response> {
  return forward(request, (await ctx.params).path);
}
export async function POST(request: NextRequest, ctx: Ctx): Promise<Response> {
  return forward(request, (await ctx.params).path);
}
export async function PATCH(request: NextRequest, ctx: Ctx): Promise<Response> {
  return forward(request, (await ctx.params).path);
}
export async function DELETE(request: NextRequest, ctx: Ctx): Promise<Response> {
  return forward(request, (await ctx.params).path);
}
