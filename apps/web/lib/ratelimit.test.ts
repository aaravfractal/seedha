import { test } from "node:test";
import assert from "node:assert/strict";
import { RateLimiter, clientAddress } from "./ratelimit.ts";

test("allows the limit, then refuses until the oldest hit leaves the window", () => {
  let now = 1000;
  const limiter = new RateLimiter(() => now);
  const limit = { count: 3, seconds: 60 };
  assert.deepEqual(
    [1, 2, 3].map(() => limiter.check("a", limit)),
    [0, 0, 0],
  );
  assert.equal(limiter.check("a", limit), 60);
  now += 20;
  assert.equal(limiter.check("a", limit), 40);
  assert.equal(limiter.check("b", limit), 0, "other keys have their own window");
  now += 40;
  assert.equal(limiter.check("a", limit), 0);
});

test("refused attempts do not count", () => {
  let now = 0;
  const limiter = new RateLimiter(() => now);
  const limit = { count: 1, seconds: 60 };
  limiter.check("a", limit);
  for (let i = 0; i < 20; i += 1) limiter.check("a", limit);
  now += 60;
  assert.equal(limiter.check("a", limit), 0);
});

test("client address is the last forwarded hop", () => {
  assert.equal(clientAddress(new Headers({ "x-forwarded-for": "6.6.6.6, 10.0.0.7" })), "10.0.0.7");
  assert.equal(clientAddress(new Headers({ "x-forwarded-for": "10.0.0.7" })), "10.0.0.7");
  assert.equal(clientAddress(new Headers({ "x-real-ip": "10.0.0.8" })), "10.0.0.8");
  assert.equal(clientAddress(new Headers()), "unknown");
});

test("behind Vercel the client address is the visitor Vercel saw", () => {
  // Vercel overwrites X-Forwarded-For (and sets X-Real-IP, X-Vercel-Forwarded-For)
  // with the client IP, dropping whatever the browser sent.
  const vercel = new Headers({
    "x-forwarded-for": "203.0.113.7",
    "x-real-ip": "203.0.113.7",
    "x-vercel-forwarded-for": "203.0.113.7",
  });
  assert.equal(clientAddress(vercel), "203.0.113.7");
});
