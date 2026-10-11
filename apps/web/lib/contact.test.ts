import { test } from "node:test";
import assert from "node:assert/strict";
import { CONTACT_PENDING, publicEmail } from "./contact.ts";

test("unset or empty addresses give null, so pages show the pending line", () => {
  assert.equal(publicEmail("contact", {}), null);
  assert.equal(publicEmail("privacy", { PUBLIC_PRIVACY_EMAIL: "" }), null);
  assert.equal(publicEmail("security", { PUBLIC_SECURITY_EMAIL: "   " }), null);
  assert.equal(CONTACT_PENDING, "Contact details will be published before launch.");
});

test("each kind reads its own variable, trimmed", () => {
  const env = {
    PUBLIC_CONTACT_EMAIL: " hello@seedha.example ",
    PUBLIC_PRIVACY_EMAIL: "privacy@seedha.example",
    PUBLIC_SECURITY_EMAIL: "security@seedha.example",
  };
  assert.equal(publicEmail("contact", env), "hello@seedha.example");
  assert.equal(publicEmail("privacy", env), "privacy@seedha.example");
  assert.equal(publicEmail("security", env), "security@seedha.example");
});

test("placeholders and malformed values are refused", () => {
  for (const bad of [
    "[contact email]",
    "TBD",
    "a@b",
    "a b@seedha.example",
    "<x@seedha.example>",
    "x@@y.in",
  ]) {
    assert.equal(publicEmail("contact", { PUBLIC_CONTACT_EMAIL: bad }), null, bad);
  }
});
