import { test } from "node:test";
import assert from "node:assert/strict";
import { readCapped } from "./body.ts";

function chunked(parts: string[]): Request {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const p of parts) controller.enqueue(new TextEncoder().encode(p));
      controller.close();
    },
  });
  return new Request("http://x/", { method: "POST", body: stream, duplex: "half" } as RequestInit);
}

test("reads a body under the cap", async () => {
  const bytes = await readCapped(new Request("http://x/", { method: "POST", body: "hello" }), 16);
  assert.equal(new TextDecoder().decode(bytes ?? undefined), "hello");
});

test("refuses a declared length over the cap", async () => {
  const req = new Request("http://x/", { method: "POST", body: "x".repeat(20) });
  assert.equal(await readCapped(req, 16), null);
});

test("refuses a chunked body that grows past the cap", async () => {
  assert.equal(await readCapped(chunked(["0123456789", "0123456789"]), 16), null);
  const ok = await readCapped(chunked(["0123", "4567"]), 16);
  assert.equal(ok?.byteLength, 8);
});

test("an empty body is empty", async () => {
  assert.equal((await readCapped(new Request("http://x/"), 16))?.byteLength, 0);
});
