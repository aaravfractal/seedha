import { test } from "node:test";
import assert from "node:assert/strict";
import { PULSE_EVENTS } from "./pulse.ts";
import { cardSummary, channelSummary, progressText, roomSummary } from "./pulseCard.ts";

const byId = (id: string) => PULSE_EVENTS.find((e) => e.id === id)!;

test("Dussehra summary names favoured and held channels", () => {
  assert.equal(
    channelSummary(byId("dussehra")),
    "Walk-in first, Direct first, MakeMyTrip held back on Saturday, Booking.com held back on Saturday, Agoda held back on Saturday.",
  );
});

test("New Year's Eve keeps every channel open", () => {
  assert.equal(channelSummary(byId("new-years-eve")), "All channels stay open.");
});

test("Diwali says weekdays", () => {
  assert.match(channelSummary(byId("diwali")), /MakeMyTrip open on weekdays/);
  assert.match(roomSummary(byId("diwali")), /^Illustration: /);
});

test("card summary starts with name and date and carries Sample", () => {
  const s = cardSummary(byId("republic-day"));
  assert.ok(s.startsWith("Republic Day weekend, 23 to 26 Jan. Sample. Decision: "));
  assert.match(s, /Agoda held back\.$/);
});

test("no digits counts, rupees, em dashes or exclamation marks in any summary", () => {
  for (const e of PULSE_EVENTS) {
    for (const s of [channelSummary(e), roomSummary(e)]) {
      assert.doesNotMatch(s, /[0-9₹—!]/);
    }
    assert.doesNotMatch(cardSummary(e), /[₹—!]/);
  }
});

test("progress text is 1-based", () => {
  assert.equal(progressText(1, 6), "Event 2 of 6");
});
