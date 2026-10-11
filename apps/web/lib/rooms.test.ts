import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_KEY,
  dayLabel,
  dayLong,
  fromLastNight,
  gridMove,
  legendChips,
  nightSummary,
  readNights,
  roomParam,
  tileCode,
  tileLabel,
  tileMatches,
} from "./rooms.ts";
import type { RoomNight } from "./types-rooms.ts";

const night: RoomNight = {
  night: "2026-10-10",
  rooms_sold: 3,
  rooms_total: 4,
  net_kept: 812_345,
  direct_bookings_pct: 33,
  by_channel: [
    { channel_key: "mmt", channel_name: "MakeMyTrip", rooms: 2 },
    { channel_key: "direct", channel_name: "Direct", rooms: 1 },
  ],
  tiles: [
    { room: 101, channel_key: "mmt", sold: true },
    { room: 102, channel_key: "mmt", sold: true },
    { room: 103, channel_key: "direct", sold: true },
    { room: 104, channel_key: null, sold: false },
  ],
};

test("day labels", () => {
  assert.equal(dayLabel("2026-10-10"), "Sat 10");
  assert.equal(dayLong("2026-10-12"), "Monday 12 October");
});

test("tile labels name the channel or say empty", () => {
  assert.equal(tileLabel(night.tiles[0]!, night.by_channel), "Room 101, MakeMyTrip");
  assert.equal(tileLabel(night.tiles[3]!), "Room 104, empty");
  assert.equal(tileLabel({ room: 5, channel_key: "bcom", sold: true }), "Room 5, Booking.com");
});

test("summary uses Direct bookings, never direct share", () => {
  const text = nightSummary(night);
  assert.equal(text, "3 of 4 rooms sold · ₹8,123 net kept · Direct bookings 33%");
  assert.doesNotMatch(text, /direct share/i);
  assert.equal(nightSummary({ ...night, rooms_sold: 0 }), "No rooms sold of 4");
  assert.equal(nightSummary({ ...night, direct_bookings_pct: null }), "3 of 4 rooms sold · ₹8,123 net kept");
});

test("legend chips count rooms per channel and empty", () => {
  const chips = legendChips(night);
  const by = Object.fromEntries(chips.map((c) => [c.key, c.rooms]));
  assert.equal(by.mmt, 2);
  assert.equal(by.direct, 1);
  assert.equal(by.agoda, 0);
  assert.equal(by[EMPTY_KEY], 1);
  assert.equal(chips.at(-1)?.name, "Empty");
});

test("tile codes", () => {
  assert.equal(tileCode("bcom"), "BDC");
  assert.equal(tileCode(null), "Empty");
  assert.equal(tileCode("xyzzy"), "XYZ");
});

test("filter matching", () => {
  assert.ok(tileMatches(night.tiles[0]!, null));
  assert.ok(tileMatches(night.tiles[0]!, "mmt"));
  assert.ok(!tileMatches(night.tiles[2]!, "mmt"));
  assert.ok(tileMatches(night.tiles[3]!, EMPTY_KEY));
  assert.ok(!tileMatches(night.tiles[0]!, EMPTY_KEY));
});

test("grid moves stay inside the grid", () => {
  assert.equal(gridMove(0, "ArrowRight", 22, 10), 1);
  assert.equal(gridMove(0, "ArrowLeft", 22, 10), 0);
  assert.equal(gridMove(3, "ArrowDown", 22, 10), 13);
  assert.equal(gridMove(15, "ArrowDown", 22, 10), 15);
  assert.equal(gridMove(13, "ArrowUp", 22, 10), 3);
  assert.equal(gridMove(7, "Home", 22, 10), 0);
  assert.equal(gridMove(7, "End", 22, 10), 21);
  assert.equal(gridMove(7, "x", 22, 10), 7);
  assert.equal(gridMove(0, "ArrowDown", 22, 4), 4);
});

test("room param accepts whole positive numbers only", () => {
  assert.equal(roomParam("204"), 204);
  assert.equal(roomParam(null), null);
  assert.equal(roomParam("0"), null);
  assert.equal(roomParam("20a"), null);
  assert.equal(roomParam("-1"), null);
});

test("reads the contract shape and sorts oldest first", () => {
  const read = readNights({ nights: [night, { ...night, night: "2026-10-09" }] });
  assert.deepEqual(
    read.nights.map((n) => n.night),
    ["2026-10-09", "2026-10-10"],
  );
  assert.deepEqual(read.nights[1], night);
});

test("tolerates a bare array and the date/rooms/by_channel-object variant", () => {
  const read = readNights([
    {
      date: "2026-10-11",
      rooms_sold: 1,
      rooms_total: 2,
      net_kept: 100,
      direct_bookings_pct: 0,
      by_channel: { agoda: 1 },
      rooms: [
        { number: 201, channel_key: "agoda", code: "AG" },
        { number: 202, channel_key: null, code: null },
      ],
    },
  ]);
  const n = read.nights[0]!;
  assert.equal(n.night, "2026-10-11");
  assert.deepEqual(n.tiles, [
    { room: 201, channel_key: "agoda", sold: true },
    { room: 202, channel_key: null, sold: false },
  ]);
  assert.deepEqual(n.by_channel, [{ channel_key: "agoda", channel_name: "Agoda", rooms: 1 }]);
  assert.deepEqual(readNights(null).nights, []);
});

test("falls back to the Overview's last night", () => {
  const read = fromLastNight({
    date: "2026-10-12",
    rooms_count: 2,
    sold: 1,
    net_kept: 5000,
    direct_share_pct: 50,
    is_sample: true,
    rooms: [
      { number: 101, channel_key: "direct" },
      { number: 102, channel_key: null },
    ],
  });
  assert.equal(read.is_sample, true);
  assert.equal(read.nights[0]?.direct_bookings_pct, 50);
  assert.equal(read.nights[0]?.tiles[1]?.sold, false);
});
