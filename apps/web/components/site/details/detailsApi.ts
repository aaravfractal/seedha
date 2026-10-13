"use client";

import { ApiError } from "@/lib/api";
import type { FieldProblem, SiteDetailsIn, SiteDetailsOut } from "@/lib/types-site-v2-owner";

export type SaveResult = { ok: true; details: SiteDetailsOut } | { ok: false; problems: FieldProblem[] };

type ErrorBody = { error?: { code?: string; message?: string; details?: unknown } };

function isProblems(value: unknown): value is FieldProblem[] {
  return (
    Array.isArray(value) &&
    value.every(
      (p) =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as FieldProblem).field === "string" &&
        typeof (p as FieldProblem).problem === "string",
    )
  );
}

/**
 * PUT /site/details with the whole object. A 422 comes back as the API's field
 * problems (to show in plain words next to each box); any other failure throws
 * an ApiError with the API's own message.
 */
export async function saveDetails(body: SiteDetailsIn): Promise<SaveResult> {
  let response: Response;
  try {
    response = await fetch("/api/site/details", {
      method: "PUT",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "offline", "No connection. Check the network and try again.");
  }
  const json: unknown = await response.json().catch(() => null);
  if (response.ok) return { ok: true, details: json as SiteDetailsOut };
  const err = (json as ErrorBody | null)?.error;
  if (response.status === 422 && isProblems(err?.details)) return { ok: false, problems: err.details };
  throw new ApiError(
    response.status,
    err?.code ?? "error",
    err?.message ?? "Saving did not work. Try again.",
  );
}
