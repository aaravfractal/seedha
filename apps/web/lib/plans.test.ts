import { test } from "node:test";
import assert from "node:assert/strict";
import { PLANS, SITE_SETUP_RUPEES, STATEMENT_CLEANUP_RUPEES, yearlyPrice } from "./plans.ts";

test("yearly plans are 10 months, shown per month rounded half up", () => {
  assert.deepEqual(yearlyPrice(1499), { perMonth: 1249, perYear: 14990 });
  assert.deepEqual(yearlyPrice(2499), { perMonth: 2083, perYear: 24990 });
  assert.deepEqual(yearlyPrice(3999), { perMonth: 3333, perYear: 39990 });
  assert.deepEqual(yearlyPrice(1200), { perMonth: 1000, perYear: 12000 });
});

test("Pro is the recommended plan", () => {
  assert.deepEqual(
    PLANS.filter((p) => p.recommended).map((p) => p.name),
    ["Pro"],
  );
});

test("one-time prices are the handoff's early estimates", () => {
  assert.equal(SITE_SETUP_RUPEES, 4999);
  assert.equal(STATEMENT_CLEANUP_RUPEES, 2999);
});
