import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compactInr,
  count,
  inr,
  longDate,
  monthRange,
  monthYear,
  pctTenths,
  timeLabel,
  wholePct,
} from "./format.ts";

test("inr uses Indian grouping on paise", () => {
  assert.equal(inr(0), "₹0");
  assert.equal(inr(99_900), "₹999");
  assert.equal(inr(100_000), "₹1,000");
  assert.equal(inr(4_180_000), "₹41,800");
  assert.equal(inr(103_910_800), "₹10,39,108");
  assert.equal(inr(473_301_200), "₹47,33,012");
  assert.equal(inr(12_345_678_00), "₹1,23,45,678");
});

test("inr rounds half up and signs negatives", () => {
  assert.equal(inr(250), "₹3");
  assert.equal(inr(249), "₹2");
  assert.equal(inr(-80_200), "−₹802");
});

test("pctTenths", () => {
  assert.equal(pctTenths(107), "10.7%");
  assert.equal(pctTenths(167), "16.7%");
  assert.equal(pctTenths(1000), "100.0%");
  assert.equal(pctTenths(0), "0.0%");
});

test("count", () => {
  assert.equal(count(1500), "1,500");
  assert.equal(count(12), "12");
});

test("monthYear", () => {
  assert.equal(monthYear("2025-05-16"), "May 2025");
  assert.equal(monthYear("2026-12-01"), "Dec 2026");
});

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
