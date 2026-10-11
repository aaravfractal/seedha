import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bpsLabel,
  clampRate,
  displacementPath,
  floorPath,
  groupErrors,
  parseWhole,
  rollupPath,
  splitWidths,
} from "./proViews.ts";

test("clampRate snaps to the step and stays in range", () => {
  assert.equal(clampRate(4049), 4000);
  assert.equal(clampRate(4050), 4100);
  assert.equal(clampRate(10), 1000);
  assert.equal(clampRate(99999), 12000);
  assert.equal(clampRate(Number.NaN), 4000);
});

test("floorPath sends paise", () => {
  assert.equal(floorPath(3500), "pro/floor?rate=350000");
  assert.equal(floorPath(3549), "pro/floor?rate=350000");
});

test("parseWhole accepts only digits in range", () => {
  assert.equal(parseWhole(" 12 ", 1, 22), 12);
  assert.equal(parseWhole("0", 1, 22), null);
  assert.equal(parseWhole("23", 1, 22), null);
  assert.equal(parseWhole("1.5", 1, 22), null);
  assert.equal(parseWhole("-3", 1, 22), null);
  assert.equal(parseWhole("", 1, 22), null);
  assert.equal(parseWhole("1e3", 1, 5000), null);
});

test("displacementPath needs every field valid", () => {
  const limits = { maxRooms: 22 };
  assert.equal(
    displacementPath({ rooms: "10", rate: "3000", nights: "2" }, limits),
    "pro/displacement?group_rooms=10&group_rate=300000&nights=2",
  );
  assert.equal(displacementPath({ rooms: "23", rate: "3000", nights: "2" }, limits), null);
  assert.equal(displacementPath({ rooms: "10", rate: "300", nights: "2" }, limits), null);
  assert.equal(displacementPath({ rooms: "10", rate: "3000", nights: "31" }, limits), null);
  assert.deepEqual(Object.keys(groupErrors({ rooms: "", rate: "x", nights: "0" }, limits)).sort(), [
    "nights",
    "rate",
    "rooms",
  ]);
  assert.deepEqual(groupErrors({ rooms: "1", rate: "500", nights: "30" }, limits), {});
});

test("splitWidths shares 100 between two parts", () => {
  assert.deepEqual(splitWidths(75, 25), [75, 25]);
  assert.deepEqual(splitWidths(0, 0), [0, 0]);
  assert.deepEqual(splitWidths(-5, 10), [0, 100]);
});

test("bpsLabel", () => {
  assert.equal(bpsLabel(2200), "22%");
  assert.equal(bpsLabel(1250), "12.5%");
  assert.equal(bpsLabel(1825), "18.25%");
  assert.equal(bpsLabel(0), "0%");
});

test("rollupPath", () => {
  assert.equal(rollupPath("b"), "pro/rollup?property=b");
});
