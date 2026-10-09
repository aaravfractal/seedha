/**
 * Backend-for-frontend proxy. The browser calls /api/<path>; this handler
 * checks the owner session where needed and forwards to the FastAPI service
 * with the server-only OWNER_API_TOKEN or DESK_DEVICE_KEY attached.
 */
import type { NextRequest } from "next/server";
import { accessFor } from "@/lib/bff";
import { clientAddress } from "@/lib/ratelimit";
import { SESSION_COOKIE, nowSeconds, verifySession } from "@/lib/session";

const FORWARD_REQUEST_HEADERS = ["content-type", "accept"];
const FORWARD_RESPONSE_HEADERS = ["content-type", "content-disposition"];
// The largest statement upload the API takes is 10 MB; leave room for the form.
const MAX_BODY_BYTES = 11 * 1024 * 1024;

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

async function forward(request: NextRequest, path: string[]): Promise<Response> {
  const joined = path.join("/");
  const access = accessFor(joined);
  if (access === null) return errorResponse(404, "not_found", "No such API route");

  const headers = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  // The API rate-limits public routes per guest; uvicorn trusts this header
  // from the loopback BFF and resolves it into the client address.
  headers.set("x-forwarded-for", clientAddress(request.headers));
  if (access !== "public") {
    const ok = await verifySession(
      process.env.SESSION_SECRET ?? "",
      request.cookies.get(SESSION_COOKIE)?.value,
      nowSeconds(),
    );
    if (!ok) return errorResponse(401, "login_required", "Please log in again");
  }
  if (access === "owner") headers.set("authorization", `Bearer ${process.env.OWNER_API_TOKEN ?? ""}`);
  if (access === "device") headers.set("x-device-key", process.env.DESK_DEVICE_KEY ?? "");

  const target = new URL(`${process.env.API_URL ?? "http://localhost:8000"}/${joined}`);
  target.search = request.nextUrl.search;
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return errorResponse(413, "body_too_large", "That file is too large. The limit is 10 MB.");
  }
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: "no-store",
    });
    const responseHeaders = new Headers();
    for (const name of FORWARD_RESPONSE_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
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
