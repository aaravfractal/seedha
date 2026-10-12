import { test } from "node:test";
import assert from "node:assert/strict";
import { FORWARD_REQUEST_HEADERS, FORWARD_RESPONSE_HEADERS, hasNoBody, pickHeaders } from "./proxyHeaders.ts";

test("if-none-match goes up to the API; cookies and auth never do", () => {
  const browser = new Headers({
    "content-type": "application/json",
    "if-none-match": '"abc"',
    cookie: "seedha_session=secret",
    authorization: "Bearer nope",
  });
  const up = pickHeaders(browser, FORWARD_REQUEST_HEADERS);
  assert.equal(up.get("if-none-match"), '"abc"');
  assert.equal(up.get("content-type"), "application/json");
  assert.equal(up.get("cookie"), null);
  assert.equal(up.get("authorization"), null);
});

test("cache-control and etag come back with the content headers", () => {
  const api = new Headers({
    "content-type": "image/jpeg",
    "cache-control": "private, no-cache",
    etag: '"abc"',
    "set-cookie": "x=y",
    server: "uvicorn",
  });
  const down = pickHeaders(api, FORWARD_RESPONSE_HEADERS);
  assert.equal(down.get("cache-control"), "private, no-cache");
  assert.equal(down.get("etag"), '"abc"');
  assert.equal(down.get("content-type"), "image/jpeg");
  assert.equal(down.get("set-cookie"), null);
  assert.equal(down.get("server"), null);
});

test("a 304 passes through with no body", () => {
  assert.equal(hasNoBody(304), true);
  assert.equal(hasNoBody(204), true);
  assert.equal(hasNoBody(200), false);
  assert.equal(hasNoBody(404), false);
  // The proxy builds exactly this; Response refuses a body on 304.
  const r = new Response(null, { status: 304, headers: pickHeaders(new Headers({ etag: '"a"' }), ["etag"]) });
  assert.equal(r.status, 304);
  assert.equal(r.headers.get("etag"), '"a"');
});
