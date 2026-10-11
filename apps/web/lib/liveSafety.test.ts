import { test } from "node:test";
import assert from "node:assert/strict";
import { accessFor } from "./bff.ts";
import { INITIAL_KIOSK, applyCommand, safeUrl } from "./kiosk.ts";
import type { KioskCommand } from "./kiosk.ts";
import { cookieSecure, isLocalRequest, refuseRemoteReset } from "./requestOrigin.ts";

/* Live features T1: public-mode safety, the BFF route table and the kiosk reducer. */

const h = (init: Record<string, string>) => new Headers(init);

test("cookie Secure decision table", () => {
  const rows: Array<[string | null, string, boolean, boolean]> = [
    // proto, host, production, expected
    ["http", "localhost:3000", true, false],
    ["http", "127.0.0.1:3000", true, false],
    ["http", "[::1]:3000", true, false],
    ["http", "192.168.1.20:3000", true, false],
    ["http", "10.0.0.5:3000", true, false],
    ["http", "172.20.1.1:3000", true, false],
    ["http", "macbook.local:3000", true, false],
    ["https", "localhost:3000", true, true],
    ["https", "192.168.1.20:3000", false, true],
    ["HTTPS", "abc-def.trycloudflare.com", true, true],
    [" https , http", "abc-def.trycloudflare.com", true, true],
    ["http", "abc-def.trycloudflare.com", true, true],
    ["http", "172.32.0.1:3000", true, true],
    ["http", "abc-def.trycloudflare.com", false, false],
    [null, "seedha.example", true, true],
    [null, "seedha.example", false, false],
    ["http,https", "192.168.1.20:3000", true, false],
  ];
  for (const [proto, host, production, expected] of rows) {
    assert.equal(cookieSecure({ proto, host, production }), expected, `${proto} ${host} ${production}`);
  }
});

test("reset is refused through the tunnel and allowed from the laptop", () => {
  const reset = ["demo", "reset"];
  const refused: Array<Record<string, string>> = [
    { host: "localhost:3000", "cf-connecting-ip": "127.0.0.1" },
    { host: "127.0.0.1:3000", "cf-ray": "8f-BOM" },
    { host: "localhost:3000", "x-forwarded-host": "localhost:3001" },
    { host: "localhost:3000", "x-forwarded-host": "abc-def.trycloudflare.com" },
    { host: "abc-def.trycloudflare.com" },
    { host: "abc-def.trycloudflare.com", "x-forwarded-host": "abc-def.trycloudflare.com" },
    { host: "192.168.0.106:3000" },
    { host: "localhost" },
    { host: "localhost:3000.evil.example" },
  ];
  for (const init of refused) {
    assert.equal(refuseRemoteReset(reset, h(init), true), true, JSON.stringify(init));
    assert.equal(refuseRemoteReset(reset, h(init), false), false, "unchanged outside public mode");
  }
  const local: Array<Record<string, string>> = [
    { host: "localhost:3000" },
    { host: "LOCALHOST:3000" },
    { host: "127.0.0.1:3000", "x-forwarded-host": "127.0.0.1:3000" },
  ];
  for (const init of local) {
    assert.equal(isLocalRequest(h(init)), true, JSON.stringify(init));
    assert.equal(refuseRemoteReset(reset, h(init), true), false, JSON.stringify(init));
  }
  const tunnel = h({ host: "abc-def.trycloudflare.com", "cf-ray": "1" });
  for (const path of [
    ["DEMO", "RESET"],
    ["demo", "reset", ""],
    ["", "demo", "reset"],
  ]) {
    assert.equal(refuseRemoteReset(path, tunnel, true), true, path.join("/"));
  }
  assert.equal(refuseRemoteReset(["events", "extract"], tunnel, true), false);
});

test("events routes are owner only and never public or device", () => {
  for (const path of [
    "events",
    "events/extract",
    "events/42",
    "events/morning-preview",
    "events/morning-preview/send",
  ]) {
    assert.equal(accessFor(path), "owner", path);
  }
  for (const path of ["events/../demo/reset", "events/%2e%2e", "events//x", "public/../events", "event"]) {
    assert.equal(accessFor(path), null, path);
  }
  assert.notEqual(accessFor("public/events"), "owner");
});

const cmd = (kind: string, payload: Record<string, unknown> = {}): KioskCommand => ({ id: 9, kind, payload });

test("unknown kiosk commands change nothing and run no effect", () => {
  const qr = applyCommand(INITIAL_KIOSK, cmd("show_qr", { url: "https://x.example/consent/t" })).state;
  for (const kind of ["reboot", "__proto__", "constructor", "toString", "SHOW_QR", "", "show_qr "]) {
    const result = applyCommand(qr, cmd(kind, { url: "javascript:alert(1)", text: "x" }));
    assert.equal(result.state, qr, kind);
    assert.deepEqual(result.effects, [], kind);
  }
});

test("show_qr accepts only absolute http(s) URLs", () => {
  for (const url of [
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    "data:text/html,hi",
    "vbscript:msgbox",
    "file:///etc/passwd",
    "ftp://x.example/consent/t",
    "blob:https://x.example/1",
    "about:blank",
    "/consent/tok",
    "//x.example/consent/tok",
    "http://",
    "",
    `https://x.example/${"a".repeat(2048)}`,
  ]) {
    assert.equal(safeUrl(url), null, url);
    const screen = applyCommand(INITIAL_KIOSK, cmd("show_qr", { url })).state.screen;
    assert.equal(screen.kind, "bad_link", url);
  }
  for (const value of [null, undefined, 42, {}, ["https://x.example"]]) {
    assert.equal(safeUrl(value), null);
  }
  for (const url of ["https://abc-def.trycloudflare.com/consent/t", "http://192.168.0.106:3000/consent/t"]) {
    const screen = applyCommand(INITIAL_KIOSK, cmd("show_qr", { url })).state.screen;
    assert.ok(screen.kind === "qr" && screen.url === url, url);
  }
});
