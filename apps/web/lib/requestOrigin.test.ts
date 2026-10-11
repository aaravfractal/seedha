import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cookieSecure,
  hostName,
  isLocalNetworkHost,
  isLocalRequest,
  isLoopbackHost,
  refuseRemoteReset,
} from "./requestOrigin.ts";

test("host names lose the port and IPv6 brackets", () => {
  assert.equal(hostName("192.168.0.106:3000"), "192.168.0.106");
  assert.equal(hostName("LocalHost:3000"), "localhost");
  assert.equal(hostName("[::1]:3000"), "::1");
  assert.equal(hostName("abc-def.trycloudflare.com"), "abc-def.trycloudflare.com");
});

test("local network hosts", () => {
  for (const h of [
    "localhost",
    "127.0.0.1",
    "::1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.9.9",
    "192.168.0.106",
    "mac.local",
  ])
    assert.equal(isLocalNetworkHost(h), true, h);
  for (const h of [
    "172.32.0.1",
    "8.8.8.8",
    "seedha.in",
    "abc-def.trycloudflare.com",
    "192.168.1",
    "999.168.0.1",
  ])
    assert.equal(isLocalNetworkHost(h), false, h);
  assert.equal(isLoopbackHost("127.0.0.1"), true);
  assert.equal(isLoopbackHost("192.168.0.106"), false);
});

test("the session cookie is Secure on https, never on plain http over Wi-Fi", () => {
  const prod = true;
  // make demo-lan: a phone on http://192.168.x.x:3000 must get a cookie it keeps.
  assert.equal(cookieSecure({ proto: "http", host: "192.168.0.106:3000", production: prod }), false);
  assert.equal(cookieSecure({ proto: "http:", host: "localhost:3000", production: prod }), false);
  assert.equal(cookieSecure({ proto: null, host: "127.0.0.1:3000", production: prod }), false);
  // make demo-live: the tunnel sends x-forwarded-proto https.
  assert.equal(cookieSecure({ proto: "https", host: "abc-def.trycloudflare.com", production: prod }), true);
  assert.equal(cookieSecure({ proto: "https,http", host: "localhost:3000", production: false }), true);
  // Production on a public host keeps Secure (security review S12).
  assert.equal(cookieSecure({ proto: "http", host: "seedha.example", production: prod }), true);
  // Development never forces it.
  assert.equal(cookieSecure({ proto: "http", host: "seedha.example", production: false }), false);
});

const h = (init: Record<string, string>) => new Headers(init);

test("a request is local only from the laptop itself, never through the tunnel", () => {
  assert.equal(isLocalRequest(h({ host: "localhost:3000" })), true);
  assert.equal(isLocalRequest(h({ host: "127.0.0.1:3000", "x-forwarded-host": "127.0.0.1:3000" })), true);
  // Tunnel: the public Host, plus Cloudflare's own headers.
  assert.equal(isLocalRequest(h({ host: "abc-def.trycloudflare.com", "cf-ray": "1" })), false);
  assert.equal(isLocalRequest(h({ host: "localhost:3000", "cf-connecting-ip": "203.0.113.7" })), false);
  assert.equal(isLocalRequest(h({ host: "localhost:3000", "cf-ray": "8f-BOM" })), false);
  assert.equal(
    isLocalRequest(h({ host: "localhost:3000", "x-forwarded-host": "abc.trycloudflare.com" })),
    false,
  );
  // A phone on the Wi-Fi, another port, or no Host at all.
  assert.equal(isLocalRequest(h({ host: "192.168.0.106:3000" })), false);
  assert.equal(isLocalRequest(h({ host: "localhost:3001" })), false);
  assert.equal(isLocalRequest(h({})), false);
});

test("public mode refuses a remote reset and nothing else", () => {
  const remote = h({ host: "abc-def.trycloudflare.com", "cf-ray": "1" });
  const local = h({ host: "localhost:3000" });
  assert.equal(refuseRemoteReset(["demo", "reset"], remote, true), true);
  assert.equal(refuseRemoteReset(["demo", "", "Reset"], remote, true), true);
  assert.equal(refuseRemoteReset(["demo", "reset"], local, true), false);
  assert.equal(refuseRemoteReset(["ledger", "channels"], remote, true), false);
  assert.equal(refuseRemoteReset(["demo", "reset"], remote, false), false, "unchanged outside public mode");
});
