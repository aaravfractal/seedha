import { test } from "node:test";
import assert from "node:assert/strict";
import { RATE_WATCH_SAMPLE, parityGap, parityLine, rateWatchHeadline, tonightCard } from "./proSample.ts";
import type { TonightChannel } from "./proSample.ts";

test("parity gap is computed from the two sample prices", () => {
  const g = parityGap(RATE_WATCH_SAMPLE.ota.price, RATE_WATCH_SAMPLE.direct.price);
  assert.equal(g.gap, 35_000);
  assert.equal(g.lower, "ota");
  assert.equal(g.gapTenths, 81);
});

test("parity gap handles equal and a lower direct price", () => {
  assert.deepEqual(parityGap(400_000, 400_000), { gap: 0, lower: "equal", gapTenths: 0 });
  assert.equal(parityGap(450_000, 400_000).lower, "direct");
  assert.equal(parityGap(100, 0).gapTenths, 0);
});

test("rate watch copy formats the computed gap and never suggests a lower rate", () => {
  assert.equal(rateWatchHeadline(RATE_WATCH_SAMPLE), "Agoda ₹3,950 vs direct ₹4,300");
  const line = parityLine(RATE_WATCH_SAMPLE);
  assert.match(line, /₹350 less/);
  assert.match(line, /perk instead of a lower rate/);
  assert.doesNotMatch(line, /[—!]/);
});

const channels: TonightChannel[] = [
  { key: "mmt", name: "MakeMyTrip", kind: "ota", net_adr: 273_700 },
  { key: "bcom", name: "Booking.com", kind: "ota", net_adr: 311_900 },
  { key: "walkin", name: "Walk-in", kind: "walkin", net_adr: 450_000 },
  { key: "direct", name: "Direct", kind: "direct", net_adr: 428_300 },
  { key: "none", name: "Nothing yet", kind: "ota", net_adr: null },
];

test("tonight picks rooms free at the last close and the highest net ADR channel", () => {
  const t = tonightCard({ rooms_total: 22, rooms_sold: 12 }, channels);
  assert.equal(t.roomsLeft, 10);
  assert.equal(t.best?.key, "walkin");
  assert.equal(t.bestOta?.key, "bcom");
  assert.match(
    t.line,
    /^10 rooms were free at the last close\. Offer free rooms to Walk-in guests first\. Walk-in keeps you ₹4,500/,
  );
  assert.match(t.line, /Booking\.com keeps the most at ₹3,119/);
});

test("tonight handles a full house and missing statements", () => {
  assert.match(
    tonightCard({ rooms_total: 22, rooms_sold: 22 }, channels).line,
    /Every room was sold at the last close/,
  );
  const empty = tonightCard({ rooms_total: 22, rooms_sold: 21 }, [{ ...channels[0]!, net_adr: null }]);
  assert.equal(empty.best, null);
  assert.equal(empty.roomsLeft, 1);
  assert.match(empty.line, /Upload your statements/);
});
