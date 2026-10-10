import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LONG_SESSION_TTL_SECONDS,
  SESSION_TTL_SECONDS,
  clearSessionCookie,
  readSession,
  safeEqual,
  sessionCookie,
  signSession,
  verifySession,
} from "./session.ts";

const SECRET = "test-secret-for-sessions-32-chars!"; // pragma: allowlist secret (test-only value)

test("a fresh session verifies and carries its subject", async () => {
  const value = await signSession(SECRET, 1_000, { subject: "a12" });
  assert.equal(await verifySession(SECRET, value, 1_001), true);
  assert.deepEqual(await readSession(SECRET, value, 1_001), {
    subject: "a12",
    expires: 1_000 + SESSION_TTL_SECONDS,
  });
  const demo = await signSession(SECRET, 1_000);
  assert.equal((await readSession(SECRET, demo, 1_001))?.subject, "demo");
});

test("an expired session is rejected", async () => {
  const value = await signSession(SECRET, 1_000);
  assert.equal(await verifySession(SECRET, value, 1_000 + SESSION_TTL_SECONDS), false);
});

test("the 30-day session lasts 30 days", async () => {
  const value = await signSession(SECRET, 1_000, { ttlSeconds: LONG_SESSION_TTL_SECONDS });
  assert.equal(await verifySession(SECRET, value, 1_000 + LONG_SESSION_TTL_SECONDS - 1), true);
  assert.equal(await verifySession(SECRET, value, 1_000 + LONG_SESSION_TTL_SECONDS), false);
});

test("a tampered or foreign session is rejected", async () => {
  const value = await signSession(SECRET, 1_000, { subject: "a1" });
  const [expires, subject, sig] = value.split(".");
  assert.equal(await verifySession(SECRET, `${Number(expires) + 999}.${subject}.${sig}`, 1_001), false);
  assert.equal(await verifySession(SECRET, `${expires}.a2.${sig}`, 1_001), false, "subject is signed");
  assert.equal(await verifySession(SECRET, `${expires}.${sig}`, 1_001), false, "old two-part format");
  assert.equal(await verifySession("other-secret", value, 1_001), false);
  assert.equal(await verifySession(SECRET, "garbage", 1_001), false);
  assert.equal(await verifySession(SECRET, undefined, 1_001), false);
  assert.equal(await verifySession("", value, 1_001), false);
});

test("only known subjects can be signed", async () => {
  await assert.rejects(signSession(SECRET, 1_000, { subject: "admin" }));
  await assert.rejects(signSession(SECRET, 1_000, { subject: "a1.x" }));
});

test("cookie lifetime follows keep me signed in", () => {
  const short = sessionCookie("v", { remember: false, secure: false });
  assert.match(short, /HttpOnly; SameSite=Lax$/);
  assert.doesNotMatch(short, /Max-Age/);
  const long = sessionCookie("v", { remember: true, secure: true });
  assert.match(long, new RegExp(`Max-Age=${LONG_SESSION_TTL_SECONDS}; Secure$`));
  assert.match(clearSessionCookie(false), /Max-Age=0$/);
});

test("safeEqual", () => {
  assert.equal(safeEqual("abc", "abc"), true);
  assert.equal(safeEqual("abc", "abd"), false);
  assert.equal(safeEqual("abc", "ab"), false);
});
