import { test } from "node:test";
import assert from "node:assert/strict";
import { SESSION_TTL_SECONDS, safeEqual, signSession, verifySession } from "./session.ts";

const SECRET = "test-secret-for-sessions-32-chars!"; // pragma: allowlist secret (test-only value)

test("a fresh session verifies", async () => {
  const value = await signSession(SECRET, 1_000);
  assert.equal(await verifySession(SECRET, value, 1_001), true);
});

test("an expired session is rejected", async () => {
  const value = await signSession(SECRET, 1_000);
  assert.equal(await verifySession(SECRET, value, 1_000 + SESSION_TTL_SECONDS), false);
});

test("a tampered or foreign session is rejected", async () => {
  const value = await signSession(SECRET, 1_000);
  const [expires, sig] = value.split(".");
  assert.equal(await verifySession(SECRET, `${Number(expires) + 999}.${sig}`, 1_001), false);
  assert.equal(await verifySession("other-secret", value, 1_001), false);
  assert.equal(await verifySession(SECRET, "garbage", 1_001), false);
  assert.equal(await verifySession(SECRET, undefined, 1_001), false);
  assert.equal(await verifySession("", value, 1_001), false);
});

test("safeEqual", () => {
  assert.equal(safeEqual("abc", "abc"), true);
  assert.equal(safeEqual("abc", "abd"), false);
  assert.equal(safeEqual("abc", "ab"), false);
});
