import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHANNELS,
  PULSE_EVENTS,
  PULSE_FOOTER,
  PULSE_SUB,
  PULSE_TITLE,
  ROOM_COUNT,
  railOrder,
  roomStates,
  stateLabel,
  stateText,
  stepIndex,
} from "./pulse.ts";

test("six sample events in season order with every channel state set", () => {
  assert.equal(PULSE_EVENTS.length, 6);
  assert.deepEqual(
    PULSE_EVENTS.map((e) => e.month),
    ["Oct", "Nov", "Nov", "Dec", "Dec", "Jan"],
  );
  for (const e of PULSE_EVENTS) {
    for (const c of CHANNELS) assert.ok(e.channels[c.key], `${e.id} ${c.key}`);
    for (const r of e.rooms) assert.ok(r >= 0 && r < ROOM_COUNT);
  }
});

test("copy has no rupee figure, em dash, exclamation mark or demand forecast", () => {
  const all = [
    PULSE_TITLE,
    PULSE_SUB,
    PULSE_FOOTER,
    ...PULSE_EVENTS.flatMap((e) => [e.decision, e.caption]),
  ].join(" ");
  assert.doesNotMatch(all, /₹|\bRs\b|INR|rupee|—|!/i);
  assert.doesNotMatch(all, /\b(sell out|sold out|occupancy|forecast|will book)\b/i);
});

test("rail order puts favoured first and held last, stable otherwise", () => {
  const dussehra = PULSE_EVENTS[0]!;
  assert.deepEqual(railOrder(dussehra), ["walkin", "direct", "ta", "mmt", "bcom", "agoda"]);
  const nye = PULSE_EVENTS.find((e) => e.id === "new-years-eve")!;
  assert.deepEqual(
    railOrder(nye),
    CHANNELS.map((c) => c.key),
  );
  const carnival = PULSE_EVENTS.find((e) => e.id === "winter-line-carnival")!;
  assert.equal(railOrder(carnival).at(-1), "agoda");
  assert.equal(railOrder(carnival)[0], "direct");
});

test("room states light direct rooms, Diwali weekdays for OTAs, none for the package", () => {
  const [dussehra, diwali, , , nye] = PULSE_EVENTS;
  assert.equal(roomStates(dussehra!).filter((s) => s === "direct").length, 6);
  assert.equal(roomStates(diwali!).filter((s) => s === "otaWeekdays").length, 8);
  assert.equal(
    roomStates(nye!).every((s) => s === "plain"),
    true,
  );
  assert.equal(nye!.tag, "Package");
  assert.equal(roomStates(dussehra!).length, ROOM_COUNT);
});

test("state text reads naturally for screen readers", () => {
  assert.equal(stateText("Agoda", "held"), "Agoda held back");
  assert.equal(stateText("Agoda", "held", "on Saturday"), "Agoda held back on Saturday");
  assert.equal(stateText("Direct", "favoured"), "Direct first");
  assert.equal(stateText("MakeMyTrip", "weekdays"), "MakeMyTrip open on weekdays");
  assert.equal(stateLabel("held"), "Held back");
});

test("step wraps around the season", () => {
  assert.equal(stepIndex(5, 1), 0);
  assert.equal(stepIndex(0, -1), 5);
  assert.equal(stepIndex(2, 1), 3);
});
