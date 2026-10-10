import { test } from "node:test";
import assert from "node:assert/strict";
import { AUTH_LIMITS, overLimit, relay, sameOrigin } from "./authServer.ts";
import { RateLimiter } from "./ratelimit.ts";

test("each bucket allows its limit per client, then answers 429 Too many tries", async () => {
  const rl = new RateLimiter(() => 1000);
  const headers = new Headers({ "x-forwarded-for": "10.0.0.9" });
  for (let i = 0; i < AUTH_LIMITS.verify.count; i += 1) assert.equal(overLimit("verify", headers, rl), null);
  const refused = overLimit("verify", headers, rl);
  assert.equal(refused?.status, 429);
  const body = (await refused?.json()) as { error: { message: string } };
  assert.match(body.error.message, /^Too many tries\. Wait 15 minutes and try again\.$/);
  assert.equal(overLimit("demo", headers, rl), null, "buckets are separate");
  assert.equal(overLimit("verify", new Headers({ "x-forwarded-for": "10.0.0.8" }), rl), null);
});

test("cross-site posts are refused", () => {
  const url = "http://localhost:3000/api/auth/demo";
  assert.equal(sameOrigin(new Headers({ host: "localhost:3000" }), url), true, "no Origin header");
  assert.equal(
    sameOrigin(new Headers({ host: "localhost:3000", origin: "http://localhost:3000" }), url),
    true,
  );
  assert.equal(
    sameOrigin(new Headers({ host: "localhost:3000", origin: "https://evil.example" }), url),
    false,
  );
  assert.equal(sameOrigin(new Headers({ host: "localhost:3000", origin: "null" }), url), false);
});

test("API errors keep their shape and tries left", async () => {
  const res = relay({
    status: 401,
    body: { error: { code: "wrong_code", message: "That code is not right. 3 tries left." } },
    headers: new Headers({ "x-tries-left": "3" }),
  });
  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), {
    error: { code: "wrong_code", message: "That code is not right. 3 tries left.", tries_left: 3 },
  });
  const locked = relay({
    status: 429,
    body: { error: { code: "locked", message: "Too many tries. Try again in 15 minutes." } },
    headers: new Headers({ "retry-after": "900", "x-tries-left": "0" }),
  });
  assert.equal(locked.headers.get("retry-after"), "900");
  const ok = relay({ status: 200, body: { sent: true }, headers: new Headers() });
  assert.deepEqual(await ok.json(), { sent: true });
});
