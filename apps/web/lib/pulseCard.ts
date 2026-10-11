/**
 * Pure text helpers for the Pulse decision card (docs/PULSE_SECTION.md).
 * Screen reader sentences only: no counts, no prices, no forecasts.
 * No "@/" imports: the node test runner loads this file directly.
 */
import { CHANNELS, railOrder, stateText, type PulseEvent } from "./pulse.ts";

/** Channel states that differ from "open", in rail order, as text. */
export function channelSummary(event: PulseEvent): string {
  const names = new Map(CHANNELS.map((c) => [c.key, c.name]));
  const parts = railOrder(event)
    .filter((key) => event.channels[key] !== "open")
    .map((key) => {
      const state = event.channels[key];
      return stateText(names.get(key) ?? key, state, state === "held" ? event.heldNote : undefined);
    });
  return parts.length ? `${parts.join(", ")}.` : "All channels stay open.";
}

/** One-line text for the 22-room illustration, without any count. */
export function roomSummary(event: PulseEvent): string {
  if (event.kind === "weekdays") return "Illustration: some weekday rooms open to OTAs.";
  if (event.kind === "package") return "Illustration: a package tag on the public rate.";
  if (event.kind === "perk") return "Illustration: the direct perk offered at the desk.";
  return "Illustration: some rooms kept for direct guests.";
}

/** Whole card as one sentence, for the parent's live region. */
export function cardSummary(event: PulseEvent): string {
  return `${event.name}, ${event.date}. Sample. Decision: ${event.decision} ${channelSummary(event)}`;
}

/** Visually hidden progress text, e.g. "Event 2 of 6". */
export function progressText(index: number, total: number): string {
  return `Event ${index + 1} of ${total}`;
}
