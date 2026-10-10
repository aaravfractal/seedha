import { test } from "node:test";
import assert from "node:assert/strict";
import { hasOwnChrome } from "./chrome.ts";

test("website, legal and World B pages bring their own chrome", () => {
  for (const p of ["/", "/privacy", "/terms", "/hotel/deodar-view", "/rate-card", "/agent-deck"]) {
    assert.equal(hasOwnChrome(p), true, p);
  }
});

test("app, guest and auth pages use the app chrome", () => {
  for (const p of ["/home", "/upload", "/desk", "/link/DEODAR-RS26", "/consent/abc", "/login", "/plans"]) {
    assert.equal(hasOwnChrome(p), false, p);
  }
  assert.equal(hasOwnChrome("/hotels"), false, "prefix must end at a path segment");
});
