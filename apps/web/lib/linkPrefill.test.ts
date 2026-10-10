import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  cleanCheckIn,
  cleanCode,
  cleanNights,
  dayLabel,
  matchRoom,
  readPrefill,
  stayLabel,
} from "./linkPrefill.ts";

const ROOMS = ["Family Suite", "Deluxe Valley View", "Standard"];

test("codes are trimmed and upper-cased; junk is ignored", () => {
  assert.equal(cleanCode(" deodar-ng26 "), "DEODAR-NG26");
  assert.equal(cleanCode("DEODAR NG26"), null);
  assert.equal(cleanCode("<script>"), null);
  assert.equal(cleanCode("x".repeat(31)), null);
  assert.equal(cleanCode(null), null);
});

test("nights must be a whole number from 1 to 14", () => {
  assert.equal(cleanNights("2"), 2);
  assert.equal(cleanNights("14"), 14);
  assert.equal(cleanNights("0"), null);
  assert.equal(cleanNights("15"), null);
  assert.equal(cleanNights("2.5"), null);
  assert.equal(cleanNights("-1"), null);
  assert.equal(cleanNights(""), null);
});

test("check-in must be a real date after today and within a year", () => {
  assert.equal(cleanCheckIn("2026-11-13", "2026-10-10"), "2026-11-13");
  assert.equal(cleanCheckIn("2026-10-10", "2026-10-10"), null);
  assert.equal(cleanCheckIn("2026-02-30", "2026-01-10"), null);
  assert.equal(cleanCheckIn("2027-10-11", "2026-10-10"), null);
  assert.equal(cleanCheckIn("13-11-2026", "2026-10-10"), null);
});

test("rooms match a listed room type by name or slug only", () => {
  assert.equal(matchRoom("deluxe-valley-view", ROOMS), "Deluxe Valley View");
  assert.equal(matchRoom("Family Suite", ROOMS), "Family Suite");
  assert.equal(matchRoom("Presidential", ROOMS), null);
  assert.equal(matchRoom("", ROOMS), null);
});

test("readPrefill keeps good values and drops bad ones", () => {
  const params = new URLSearchParams("room=standard&in=2026-11-13&nights=40&code=deodar-ng26");
  assert.deepEqual(readPrefill(params, "2026-10-10"), {
    room: "standard",
    checkIn: "2026-11-13",
    nights: null,
    code: "DEODAR-NG26",
  });
});

test("labels and date arithmetic", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(dayLabel("2026-11-13"), "Fri 13 Nov");
  assert.equal(stayLabel("2026-11-13", 2), "13 Nov to 15 Nov · 2 nights");
  assert.equal(stayLabel("2026-11-30", 1), "30 Nov to 1 Dec · 1 night");
});
