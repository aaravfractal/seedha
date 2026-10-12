/**
 * Which headers the /api proxy passes each way. Pure, no "@/" imports, so
 * node --test can run it. Owner photos are cached by the browser and
 * revalidated with their ETag, so if-none-match goes up and cache-control,
 * etag come back; a 304 carries no body.
 */

export const FORWARD_REQUEST_HEADERS: readonly string[] = ["content-type", "accept", "if-none-match"];
export const FORWARD_RESPONSE_HEADERS: readonly string[] = [
  "content-type",
  "content-disposition",
  "cache-control",
  "etag",
];

/** Copy only the listed headers that are present. */
export function pickHeaders(from: Headers, names: readonly string[]): Headers {
  const out = new Headers();
  for (const name of names) {
    const value = from.get(name);
    if (value) out.set(name, value);
  }
  return out;
}

/** Statuses that must be sent without a body (Response throws on a body for these). */
export function hasNoBody(status: number): boolean {
  return status === 204 || status === 205 || status === 304;
}
