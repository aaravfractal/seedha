import { test } from "node:test";
import assert from "node:assert/strict";
import { count, inr, monthYear, pctTenths } from "./format.ts";

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
