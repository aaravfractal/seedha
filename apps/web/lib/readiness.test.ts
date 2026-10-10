import { test } from "node:test";
import assert from "node:assert/strict";
import { SUGGESTED_GOALS, parseGoal, partScore, readiness } from "./readiness.ts";

test("parts score actual over goal, capped at 100", () => {
  assert.equal(partScore(107, 200), 54);
  assert.equal(partScore(167, 300), 56);
  assert.equal(partScore(500, 200), 100);
  assert.equal(partScore(-5, 200), 0);
  assert.equal(partScore(3, 0), 100);
});

test("sample hotel: 10.7% direct, 16.7% commission-free, 5 coded bookings", () => {
  const r = readiness({ directTenths: 107, freeTenths: 167, codedBookings: 5 }, SUGGESTED_GOALS);
  assert.deepEqual(
    r.parts.map((p) => [p.label, p.score]),
    [
      ["Direct bookings", 54],
      ["Commission-free share", 56],
      ["Coded direct bookings", 50],
    ],
  );
  assert.equal(r.total, 53);
  assert.equal(r.parts[0]?.formula, "10.7% of a 20.0% goal = 54 of 100");
  assert.equal(r.parts[2]?.formula, "5 of a 10 goal = 50 of 100");
  for (const p of r.parts) assert.ok(!p.formula.includes("₹"));
});

test("missing shares count as zero", () => {
  const r = readiness({ directTenths: null, freeTenths: null, codedBookings: 0 }, SUGGESTED_GOALS);
  assert.equal(r.total, 0);
});

test("owner goals are parsed strictly", () => {
  assert.equal(parseGoal("25", "percent"), 250);
  assert.equal(parseGoal("12.5", "percent"), 125);
  assert.equal(parseGoal("0", "percent"), null);
  assert.equal(parseGoal("101", "percent"), null);
  assert.equal(parseGoal("abc", "percent"), null);
  assert.equal(parseGoal("12", "count"), 12);
  assert.equal(parseGoal("0", "count"), null);
  assert.equal(parseGoal("1.5", "count"), null);
});
