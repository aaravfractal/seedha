import { test } from "node:test";
import assert from "node:assert/strict";
import {
  barPct,
  channelShort,
  floorName,
  myPlacePath,
  nextSort,
  parseRupees,
  profitTone,
  signedInr,
  sortRooms,
} from "./myplace.ts";
import type { PlaceRoom } from "./types-myplace.ts";

const MAX = 100_000_00;

test("parseRupees accepts whole rupees and treats empty as not given", () => {
  assert.deepEqual(parseRupees("900", MAX, "Cost"), { value: 900, error: null });
  assert.deepEqual(parseRupees(" ₹1,200 ", MAX, "Cost"), { value: 1200, error: null });
  assert.deepEqual(parseRupees("", MAX, "Cost"), { value: null, error: null });
  assert.deepEqual(parseRupees("0", MAX, "Cost"), { value: 0, error: null });
});

test("parseRupees refuses decimals, signs, words and values over the cap", () => {
  for (const bad of ["12.5", "-4", "abc", "1e3"]) {
    const r = parseRupees(bad, MAX, "Cost");
    assert.equal(r.value, null);
    assert.match(r.error ?? "", /whole rupees/);
  }
  assert.match(parseRupees("100001", MAX, "Cost").error ?? "", /₹1,00,000 or less/);
});

test("myPlacePath only sends what was given", () => {
  assert.equal(myPlacePath("season", { costPerNight: null, fixedMonthly: null }), "my-place");
  assert.equal(
    myPlacePath("2026-09", { costPerNight: 900, fixedMonthly: 450000 }),
    "my-place?month=2026-09&cost_per_night=900&fixed_monthly=450000",
  );
  assert.equal(myPlacePath("season", { costPerNight: 0, fixedMonthly: null }), "my-place?cost_per_night=0");
});

test("signs are always written", () => {
  assert.equal(signedInr(395_400), "+₹3,954");
  assert.equal(signedInr(-24_800), "−₹248");
  assert.equal(signedInr(0), "₹0");
  assert.equal(profitTone(1), "gain");
  assert.equal(profitTone(-1), "loss");
  assert.equal(profitTone(0), "even");
});

const room = (number: number, channel: string, profit: number): PlaceRoom => ({
  number,
  floor: Math.floor(number / 100),
  room_type: "Standard",
  channel_key: channel,
  channel_name: channel,
  nights: 11,
  net: profit + 1000,
  variable_cost: 600,
  fixed_share: 400,
  profit,
});

test("sortRooms sorts by column with room number as the tie-break", () => {
  const rooms = [room(102, "Direct", 500), room(101, "Agoda", -200), room(201, "Agoda", 500)];
  assert.deepEqual(
    sortRooms(rooms, "profit", "desc").map((r) => r.number),
    [102, 201, 101],
  );
  assert.deepEqual(
    sortRooms(rooms, "channel", "asc").map((r) => r.number),
    [101, 201, 102],
  );
  assert.deepEqual(
    sortRooms(rooms, "number", "desc").map((r) => r.number),
    [201, 102, 101],
  );
  assert.deepEqual(nextSort({ key: "number", dir: "asc" }, "number"), { key: "number", dir: "desc" });
  assert.deepEqual(nextSort({ key: "number", dir: "asc" }, "profit"), { key: "profit", dir: "desc" });
});

test("bars and floor names", () => {
  assert.equal(barPct(-50, 200), 25);
  assert.equal(barPct(300, 200), 100);
  assert.equal(barPct(5, 0), 0);
  assert.equal(floorName(2), "Floor 2");
  assert.equal(floorName(0), "Ground floor");
});

test("short channel labels fall back to the name", () => {
  assert.equal(channelShort("mmt", "MakeMyTrip"), "MMT");
  assert.equal(channelShort("new", "Hostelworld"), "Hostelworld");
});
