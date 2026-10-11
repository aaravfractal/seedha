/**
 * Seedha Pulse section on the public website (docs/PULSE_SECTION.md).
 * Sample events for a Mussoorie hotel and, for each, the channel decision
 * shown on the decision card. A channel decision, never a demand forecast:
 * nothing here is a number of bookings, a price or a rupee figure.
 * The room patterns are illustrative and labelled "Illustration".
 * No "@/" imports: the node test runner loads this file directly.
 */

export type ChannelKey = "mmt" | "bcom" | "agoda" | "ta" | "walkin" | "direct";

/** favoured: rises to the top with a pine ring. held: "Held back", lock icon. */
export type ChannelState = "favoured" | "open" | "held" | "weekdays";

export type DecisionKind = "hold" | "weekdays" | "perk" | "package";

/** Room tile in the 22-room illustration. */
export type RoomState = "plain" | "direct" | "otaWeekdays";

export type PulseEvent = {
  id: string;
  name: string;
  /** Date chip text, as written in the brief. */
  date: string;
  /** Month on the season timeline (Oct 2026 to Jan 2027). */
  month: "Oct" | "Nov" | "Dec" | "Jan";
  decision: string;
  kind: DecisionKind;
  channels: Record<ChannelKey, ChannelState>;
  /** Extra words after "held back", e.g. "on Saturday". */
  heldNote?: string;
  /** 0-based rooms lit as "For direct" (or "OTA weekdays" for Diwali). */
  rooms: readonly number[];
  /** Tag shown on the room grid instead of lit rooms (New Year's Eve). */
  tag?: string;
  /** Caption under the room grid. */
  caption: string;
};

export const ROOM_COUNT = 22;

export const CHANNELS: ReadonlyArray<{ key: ChannelKey; name: string }> = [
  { key: "mmt", name: "MakeMyTrip" },
  { key: "bcom", name: "Booking.com" },
  { key: "agoda", name: "Agoda" },
  { key: "ta", name: "Travel agents" },
  { key: "walkin", name: "Walk-in" },
  { key: "direct", name: "Direct" },
];

const ALL_OPEN: Record<ChannelKey, ChannelState> = {
  mmt: "open",
  bcom: "open",
  agoda: "open",
  ta: "open",
  walkin: "open",
  direct: "open",
};

export const PULSE_KICKER = "SEEDHA PULSE · PRO";
export const PULSE_TITLE = "Every festival, one channel decision.";
export const PULSE_SUB =
  "Pulse lists the dates that matter to a hill hotel and suggests which channel to hold back. It is a channel decision. It does not predict demand.";
export const PULSE_FOOTER = "Sample events for a Mussoorie hotel. Confirm dates locally before you act.";
export const SEASON_MONTHS = ["Oct", "Nov", "Dec", "Jan"] as const;
export const SEASON_LABEL = "Oct 2026 to Jan 2027";

export const PULSE_EVENTS: readonly PulseEvent[] = [
  {
    id: "dussehra",
    name: "Dussehra",
    date: "Tue 20 Oct",
    month: "Oct",
    decision: "Long weekend for Delhi families. Hold Saturday rooms for direct and repeat guests first.",
    kind: "hold",
    channels: {
      ...ALL_OPEN,
      direct: "favoured",
      walkin: "favoured",
      mmt: "held",
      bcom: "held",
      agoda: "held",
    },
    heldNote: "on Saturday",
    rooms: [0, 1, 2, 3, 4, 5],
    caption: "Saturday rooms kept for direct and repeat guests.",
  },
  {
    id: "diwali",
    name: "Diwali",
    date: "Sun 8 Nov",
    month: "Nov",
    decision: "Families book late. Open OTA rooms only for the quiet weekdays after.",
    kind: "weekdays",
    channels: { ...ALL_OPEN, direct: "favoured", mmt: "weekdays", bcom: "weekdays", agoda: "weekdays" },
    rooms: [14, 15, 16, 17, 18, 19, 20, 21],
    caption: "Weekday rooms open to OTAs after Diwali.",
  },
  {
    id: "guru-nanak-jayanti",
    name: "Guru Nanak Jayanti",
    date: "Tue 24 Nov",
    month: "Nov",
    decision: "Midweek holiday. Offer the direct perk to every walk-in enquiry.",
    kind: "perk",
    channels: { ...ALL_OPEN, walkin: "favoured", direct: "favoured" },
    rooms: [],
    caption: "Perk offered at the desk to every walk-in.",
  },
  {
    id: "winter-line-carnival",
    name: "Winter Line Carnival",
    date: "25 to 30 Dec",
    month: "Dec",
    decision:
      "Your busiest week. Sell direct first; open the lowest-net channel only for nights still empty.",
    kind: "hold",
    channels: { ...ALL_OPEN, direct: "favoured", agoda: "held" },
    heldNote: "until direct sells first",
    rooms: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    caption: "Direct first. The lowest-net channel waits for empty nights.",
  },
  {
    id: "new-years-eve",
    name: "New Year's Eve",
    date: "Thu 31 Dec",
    month: "Dec",
    decision: "Packages sell better than discounts. Keep the public rate.",
    kind: "package",
    channels: { ...ALL_OPEN },
    rooms: [],
    tag: "Package",
    caption: "Public rate kept. A package instead of a discount.",
  },
  {
    id: "republic-day",
    name: "Republic Day weekend",
    date: "23 to 26 Jan",
    month: "Jan",
    decision: "Long weekend with a bridge day. Hold rooms off the channel that leaves the least.",
    kind: "hold",
    channels: { ...ALL_OPEN, direct: "favoured", agoda: "held" },
    rooms: [0, 1, 2, 3, 4, 5],
    caption: "Rooms held off the channel that leaves the least.",
  },
];

const RANK: Record<ChannelState, number> = { favoured: 0, open: 1, weekdays: 1, held: 2 };

/** Rail order for an event: favoured on top, held at the bottom, stable otherwise. */
export function railOrder(event: PulseEvent): ChannelKey[] {
  return CHANNELS.map((c, i) => ({ key: c.key, i }))
    .sort((a, b) => RANK[event.channels[a.key]] - RANK[event.channels[b.key]] || a.i - b.i)
    .map((c) => c.key);
}

/** State of each of the 22 rooms for an event (illustration only). */
export function roomStates(event: PulseEvent): RoomState[] {
  const lit = new Set(event.rooms);
  const on: RoomState = event.kind === "weekdays" ? "otaWeekdays" : "direct";
  return Array.from({ length: ROOM_COUNT }, (_, i) => (lit.has(i) ? on : "plain"));
}

/** Text for a channel's state, for the label and screen readers ("Agoda held back"). */
export function stateText(name: string, state: ChannelState, heldNote?: string): string {
  if (state === "held") return heldNote ? `${name} held back ${heldNote}` : `${name} held back`;
  if (state === "favoured") return `${name} first`;
  if (state === "weekdays") return `${name} open on weekdays`;
  return `${name} open`;
}

/** Short label shown on the row itself. */
export function stateLabel(state: ChannelState): string {
  if (state === "held") return "Held back";
  if (state === "favoured") return "First";
  if (state === "weekdays") return "Open weekdays";
  return "Open";
}

/** Index after a step, wrapping around the six events. */
export function stepIndex(index: number, step: number, total = PULSE_EVENTS.length): number {
  return (((index + step) % total) + total) % total;
}
