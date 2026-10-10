import { test } from "node:test";
import assert from "node:assert/strict";
import {
  baseYearCostPaise,
  easeOutCubic,
  flipToast,
  growth,
  ordinal,
  periodLabel,
  readCookieChoice,
} from "./website.ts";

test("ordinals", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 11, 12, 13, 21, 22].map(ordinal), [
    "1st",
    "2nd",
    "3rd",
    "4th",
    "5th",
    "11th",
    "12th",
    "13th",
    "21st",
    "22nd",
  ]);
});

test("flip toast names the biggest channel's new rank", () => {
  const names = { mmt: "MakeMyTrip", walkin: "Walk-in" };
  assert.equal(
    flipToast(["mmt", "bcom", "direct"], ["walkin", "direct", "agent", "bcom", "mmt", "agoda"], names),
    "MakeMyTrip drops from 1st to 5th",
  );
  assert.equal(flipToast(["walkin"], ["walkin"], names), null);
  assert.equal(flipToast([], [], names), null);
});

test("growth calculator matches the handoff at 20 and 49 room nights", () => {
  assert.equal(baseYearCostPaise(), 17_988_00);
  const per = 1_546_00;
  const at20 = growth(20, per);
  assert.equal(at20.perMonth, 30_920_00);
  assert.equal(at20.perYear, 3_71_040_00);
  assert.equal(at20.afterSeedha, 3_53_052_00);
  const at49 = growth(49, per);
  assert.equal(at49.perMonth, 75_754_00);
  assert.equal(at49.perYear, 9_09_048_00);
  assert.equal(at49.afterSeedha, 8_91_060_00);
  assert.equal(at49.months.length, 12);
  assert.equal(at49.months[11]?.kept, at49.perYear);
  assert.equal(at49.months[11]?.cost, 17_988_00);
  assert.equal(growth(0, per).afterSeedha, -17_988_00);
});

test("cookie choice is read from the cookie string only when valid", () => {
  assert.equal(readCookieChoice("a=1; seedha_cookies=necessary; b=2"), "necessary");
  assert.equal(readCookieChoice("seedha_cookies=all"), "all");
  assert.equal(readCookieChoice("seedha_cookies=tracking"), null);
  assert.equal(readCookieChoice(""), null);
});

test("ease out cubic is clamped", () => {
  assert.equal(easeOutCubic(-1), 0);
  assert.equal(easeOutCubic(1), 1);
  assert.equal(easeOutCubic(2), 1);
});

test("period label", () => {
  assert.equal(periodLabel("2026-04-01", "2026-09-30"), "Apr to Sep 2026");
  assert.equal(periodLabel("2026-10-01", "2027-01-31"), "Oct 2026 to Jan 2027");
});
