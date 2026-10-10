import { test } from "node:test";
import assert from "node:assert/strict";
import { compactInr, longDate, monthRange, timeLabel, wholePct } from "./format-overview.ts";

test("compactInr labels the waterfall bars", () => {
  assert.equal(compactInr(630_500_000), "63.1L");
  assert.equal(compactInr(-53_288_000), "−5.3L");
  assert.equal(compactInr(-88_870_200), "−8.9L");
  assert.equal(compactInr(-275_200), "−2.8K");
  assert.equal(compactInr(473_301_200), "47.3L");
  assert.equal(compactInr(45_000), "450");
  assert.equal(compactInr(0), "0");
});

test("dates", () => {
  assert.equal(longDate("2026-10-13"), "Tuesday, 13 October 2026");
  assert.equal(longDate("2026-10-03"), "Saturday, 3 October 2026");
  assert.equal(monthRange("2026-04-01", "2026-09-30"), "Apr to Sep 2026");
  assert.equal(monthRange("2025-12-01", "2026-03-31"), "Dec 2025 to Mar 2026");
  assert.equal(timeLabel("2026-10-13T14:12:00Z"), "13 Oct, 7:42 PM");
});

test("wholePct", () => {
  assert.equal(wholePct(373), "37%");
  assert.equal(wholePct(375), "38%");
  assert.equal(wholePct(0), "0%");
});
