/**
 * Server-side helpers for the /api/auth/* route handlers. They call the
 * FastAPI auth routes with OWNER_API_TOKEN (never sent to the browser) and
 * tell the API who is signed in with X-Seedha-Subject.
 */
import { type Limit, RateLimiter, clientAddress } from "./ratelimit.ts";

/** Per client address on the web server, in front of the API's own limits. */
export const AUTH_LIMITS = {
  // Asking for a code (sign in, resend, sign up).
  send: { count: 10, seconds: 15 * 60 },
  // Typing a code. The API also locks a number after 5 wrong codes.
  verify: { count: 10, seconds: 15 * 60 },
  // Direct beta login only opens the fictional sample hotel.
  demo: { count: 60, seconds: 15 * 60 },
} satisfies Record<string, Limit>;

export type AuthBucket = keyof typeof AUTH_LIMITS;

const limiter = new RateLimiter();

export function jsonError(
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
  headers?: HeadersInit,
): Response {
  return Response.json({ error: { code, message, ...extra } }, { status, headers });
}

/** A 429 response when this client is over the bucket's limit, else null. */
export function overLimit(bucket: AuthBucket, headers: Headers, rl: RateLimiter = limiter): Response | null {
  const wait = rl.check(`${bucket}:${clientAddress(headers)}`, AUTH_LIMITS[bucket]);
  if (wait <= 0) return null;
  const minutes = Math.ceil(wait / 60);
  return jsonError(
    429,
    "too_many_requests",
    `Too many tries. Wait ${minutes} minute${minutes === 1 ? "" : "s"} and try again.`,
    {},
    { "retry-after": String(wait) },
  );
}

/**
 * Refuse cross-site form posts: when the browser sends an Origin header it
 * must match this site. (Cookies are SameSite=Lax as well.)
 */
export function sameOrigin(headers: Headers, url: string): boolean {
  const origin = headers.get("origin");
  if (!origin) return true;
  try {
    return (
      new URL(origin).host === (headers.get("x-forwarded-host") ?? headers.get("host") ?? new URL(url).host)
    );
  } catch {
    return false;
  }
}

/** Read a JSON object body, or null. */
export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export type ApiResult = { status: number; body: unknown; headers: Headers };

/** Call the API's auth routes from the web server. */
export async function callApi(
  path: string,
  init: { method: "GET" | "POST" | "PATCH"; body?: unknown; subject?: string; client: string },
): Promise<ApiResult> {
  const headers = new Headers({
    authorization: `Bearer ${process.env.OWNER_API_TOKEN ?? ""}`,
    accept: "application/json",
    "x-forwarded-for": init.client,
  });
  if (init.subject) headers.set("x-seedha-subject", init.subject);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  const target = `${process.env.API_URL ?? "http://localhost:8000"}/${path}`;
  const res = await fetch(target, {
    method: init.method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const body: unknown = await res.json().catch(() => null);
  return { status: res.status, body, headers: res.headers };
}

/**
 * Pass an API answer to the browser. Errors keep the shared shape; the API's
 * X-Tries-Left header becomes `tries_left` and Retry-After is kept.
 */
export function relay(result: ApiResult): Response {
  const headers = new Headers();
  const retry = result.headers.get("retry-after");
  if (retry) headers.set("retry-after", retry);
  if (result.status >= 400) {
    const err = (result.body as { error?: { code?: string; message?: string } } | null)?.error;
    const tries = result.headers.get("x-tries-left");
    const extra = tries === null ? {} : { tries_left: Number(tries) };
    return jsonError(
      result.status,
      err?.code ?? "api_error",
      err?.message ?? "Something went wrong. Try again.",
      extra,
      headers,
    );
  }
  return Response.json(result.body, { status: result.status, headers });
}

export function unreachable(): Response {
  return jsonError(502, "api_unreachable", "Seedha API is not reachable. Is it running?");
}

export function isSecure(url: string): boolean {
  return new URL(url).protocol === "https:";
}

/** 503 when the web server lacks the secrets it needs to sign anyone in. */
export function notConfigured(): Response | null {
  if (process.env.OWNER_API_TOKEN && process.env.SESSION_SECRET) return null;
  return jsonError(503, "login_not_configured", "OWNER_API_TOKEN or SESSION_SECRET is not set");
}

/** Shared guard for auth POSTs: configuration, same origin, rate limit. */
export function guard(request: Request, bucket: AuthBucket): Response | null {
  const missing = notConfigured();
  if (missing) return missing;
  if (!sameOrigin(request.headers, request.url)) {
    return jsonError(403, "cross_site", "This request came from another site.");
  }
  return overLimit(bucket, request.headers);
}
