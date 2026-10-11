/**
 * Seedha Pro sample data and pure helpers for the Rate Watch and Tonight
 * cards (POLISH_BUILD section C). Rate Watch prices are fixed sample values,
 * labelled Sample on the card; the parity gap is computed here in code,
 * never by an AI. Tonight only formats figures the API returned.
 * No "@/" imports: the node test runner loads this file directly.
 */
import { inr } from "./format.ts";

/** One price tile read from the owner's screenshot. Money is integer paise. */
export type PriceTile = { name: string; price: number };

export type RateWatchSample = {
  room: string;
  stayDate: string;
  ota: PriceTile;
  direct: PriceTile;
};

/** Sample screenshot comparison: Agoda shows a lower price than the hotel's own site. */
export const RATE_WATCH_SAMPLE: RateWatchSample = {
  room: "Deluxe double, 1 night",
  stayDate: "Sat 24 Oct",
  ota: { name: "Agoda", price: 395_000 },
  direct: { name: "Direct", price: 430_000 },
};

export type ParityGap = {
  /** Absolute difference in paise. */
  gap: number;
  /** Which side shows the lower price. */
  lower: "ota" | "direct" | "equal";
  /** Gap as tenths of a percent of the direct price, rounded half-up. */
  gapTenths: number;
};

/** Parity gap between an OTA price and the direct price (both paise). */
export function parityGap(ota: number, direct: number): ParityGap {
  const gap = Math.abs(ota - direct);
  const lower = ota === direct ? "equal" : ota < direct ? "ota" : "direct";
  const gapTenths = direct > 0 ? Math.floor((gap * 1000) / direct + 0.5) : 0;
  return { gap, lower, gapTenths };
}

/** One line for the Rate Watch card. Perks for returning guests, never a lower public rate (rule 6). */
export function parityLine(sample: RateWatchSample): string {
  const g = parityGap(sample.ota.price, sample.direct.price);
  if (g.lower === "equal") return `${sample.ota.name} matches your direct price. Nothing to fix.`;
  if (g.lower === "direct")
    return `Your direct price is ${inr(g.gap)} below ${sample.ota.name}. Guests who compare book direct.`;
  return `${sample.ota.name} shows ${inr(g.gap)} less than your direct price. Ask ${sample.ota.name} to restore parity, and offer returning guests a perk instead of a lower rate.`;
}

/** The headline on the big Rate Watch card. */
export function rateWatchHeadline(sample: RateWatchSample): string {
  return `${sample.ota.name} ${inr(sample.ota.price)} vs direct ${inr(sample.direct.price)}`;
}

/** The fields Tonight needs from GET /ledger/channels. */
export type TonightChannel = { key: string; name: string; kind: string; net_adr: number | null };

export type TonightCard = {
  roomsLeft: number;
  roomsTotal: number;
  best: TonightChannel | null;
  bestOta: TonightChannel | null;
  line: string;
};

function highest(channels: readonly TonightChannel[]): TonightChannel | null {
  let top: TonightChannel | null = null;
  for (const c of channels) {
    if (c.net_adr === null) continue;
    if (top === null || (top.net_adr ?? 0) < c.net_adr) top = c;
  }
  return top;
}

/**
 * Rooms left on the latest night and the channel with the highest net ADR
 * (channels without a net ADR are skipped). The figures come from the API.
 */
export function tonightCard(
  night: { rooms_total: number; rooms_sold: number },
  channels: readonly TonightChannel[],
): TonightCard {
  const roomsLeft = Math.max(0, night.rooms_total - night.rooms_sold);
  const best = highest(channels);
  const bestOta = highest(channels.filter((c) => c.kind === "ota"));
  const rooms = `${roomsLeft} room${roomsLeft === 1 ? "" : "s"}`;
  let line: string;
  if (roomsLeft === 0) line = "Every room is sold. Nothing to open tonight.";
  else if (!best || best.net_adr === null)
    line = "Upload your statements to see which channel keeps the most.";
  else {
    line = `Offer the ${rooms} left to ${best.name} guests first: they keep ${inr(best.net_adr)} a night on average.`;
    if (bestOta && bestOta.key !== best.key && bestOta.net_adr !== null) {
      line += ` If you open an online channel, ${bestOta.name} keeps the most at ${inr(bestOta.net_adr)}.`;
    }
  }
  return { roomsLeft, roomsTotal: night.rooms_total, best, bestOta, line };
}
