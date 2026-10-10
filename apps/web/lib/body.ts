/**
 * Read a request body with a hard byte cap (security review S11). A chunked
 * body has no Content-Length, so the header alone cannot be trusted: the
 * stream is counted as it arrives and abandoned past the cap.
 */
export const AUTH_BODY_BYTES = 16 * 1024;
// The largest statement upload the API takes is 10 MB; leave room for the form.
export const API_BODY_BYTES = 11 * 1024 * 1024;

/** The body bytes, or null when the body is larger than `maxBytes`. */
export async function readCapped(request: Request, maxBytes: number): Promise<Uint8Array | null> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return null;
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}
