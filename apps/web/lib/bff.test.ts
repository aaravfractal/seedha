import { test } from "node:test";
import assert from "node:assert/strict";
import { accessFor } from "./bff.ts";

test("owner routes", () => {
  assert.equal(accessFor("pipeline"), "owner");
  assert.equal(accessFor("pipeline/flip/seen"), "owner");
  assert.equal(accessFor("overview"), "owner");
  assert.equal(accessFor("ledger/channels"), "owner");
  assert.equal(accessFor("desk/checkin"), "owner");
  assert.equal(accessFor("pro"), "owner");
  assert.equal(accessFor("site/publish"), "owner");
  assert.equal(accessFor("demo/reset"), "owner");
});

test("device routes win over the owner desk prefix", () => {
  assert.equal(accessFor("desk/poll"), "device");
  assert.equal(accessFor("desk/ack"), "device");
});

test("public routes", () => {
  assert.equal(accessFor("public/consent/abc"), "public");
  assert.equal(accessFor("health"), "public");
});

test("unknown or unsafe paths are refused", () => {
  assert.equal(accessFor("admin"), null);
  assert.equal(accessFor("pipelines"), null);
  assert.equal(accessFor("overviews"), null);
  assert.equal(accessFor("product"), null);
  assert.equal(accessFor("public/../pipeline"), null);
  assert.equal(accessFor("ledger/%2e%2e"), null);
  assert.equal(accessFor(""), null);
});
