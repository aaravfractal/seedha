/**
 * My Place helpers shared by the screen and its tests. No money maths here:
 * every figure arrives computed from the API; these only validate inputs,
 * build the request path, sort, and turn paise into display text.
 */
import { inr } from "./format.ts";
import type { PlaceRoom } from "./types-myplace.ts";

export type CostInputs = { costPerNight: number | null; fixedMonthly: number | null };

export type RupeeCheck = { value: number | null; error: string | null };

/** Parse an owner-typed whole-rupee amount ("1,200" or "₹ 900"); empty means "not given". */
export function parseRupees(text: string, maxPaise: number, label: string): RupeeCheck {
  const cleaned = text.replace(/[₹,\s]/g, "");
  if (cleaned === "") return { value: null, error: null };
  if (!/^\d+$/.test(cleaned)) return { value: null, error: `${label}: enter whole rupees, digits only.` };
  const value = Number(cleaned);
  const max = Math.floor(maxPaise / 100);
  if (!Number.isSafeInteger(value) || value > max) {
    return { value: null, error: `${label}: enter ${inr(maxPaise)} or less.` };
  }
  return { value, error: null };
}

/** The API path for a month and the owner's cost inputs (whole rupees). */
export function myPlacePath(month: string, inputs: CostInputs): string {
  const params = new URLSearchParams();
  if (month !== "season") params.set("month", month);
  if (inputs.costPerNight !== null) params.set("cost_per_night", String(inputs.costPerNight));
  if (inputs.fixedMonthly !== null) params.set("fixed_monthly", String(inputs.fixedMonthly));
  const query = params.toString();
  return query ? `my-place?${query}` : "my-place";
}

/** "+₹3,954", "−₹248" or "₹0": the sign is always written, so colour is never alone. */
export function signedInr(paise: number): string {
  if (paise > 0) return `+${inr(paise)}`;
  return inr(paise);
}

export type Tone = "gain" | "loss" | "even";

export function profitTone(paise: number): Tone {
  if (paise > 0) return "gain";
  if (paise < 0) return "loss";
  return "even";
}

export type SortKey = "number" | "channel" | "nights" | "net" | "costs" | "profit";
export type SortDir = "asc" | "desc";

/** Variable plus fixed share, as the table's Costs column shows it. */
export function roomCosts(room: PlaceRoom): number {
  return room.variable_cost + room.fixed_share;
}

/** Rooms sorted by a column; ties fall back to the room number. */
export function sortRooms(rooms: readonly PlaceRoom[], key: SortKey, dir: SortDir): PlaceRoom[] {
  const value = (room: PlaceRoom): number | string => {
    switch (key) {
      case "channel":
        return room.channel_name;
      case "nights":
        return room.nights;
      case "net":
        return room.net;
      case "costs":
        return roomCosts(room);
      case "profit":
        return room.profit;
      default:
        return room.number;
    }
  };
  const sign = dir === "asc" ? 1 : -1;
  return [...rooms].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    const order = typeof va === "string" ? va.localeCompare(String(vb)) : va - Number(vb);
    return order === 0 ? a.number - b.number : order * sign;
  });
}

/** Next sort after a header tap: same column flips, a new column starts high to low (numbers) or A to Z. */
export function nextSort(
  current: { key: SortKey; dir: SortDir },
  key: SortKey,
): { key: SortKey; dir: SortDir } {
  if (current.key === key) return { key, dir: current.dir === "asc" ? "desc" : "asc" };
  return { key, dir: key === "number" || key === "channel" ? "asc" : "desc" };
}

/** Bar length as a share of the largest magnitude, 0 to 100. */
export function barPct(value: number, maxAbs: number): number {
  if (maxAbs <= 0) return 0;
  return Math.min(100, Math.round((Math.abs(value) / maxAbs) * 1000) / 10);
}

/** "Floor 1" (ground floors are numbered from 1 by room number). */
export function floorName(floor: number): string {
  return floor === 0 ? "Ground floor" : `Floor ${floor}`;
}

const SHORT: Record<string, string> = {
  mmt: "MMT",
  bcom: "Booking",
  agoda: "Agoda",
  ta: "Agent",
  walkin: "Walk-in",
  direct: "Direct",
};

/** A tile-sized channel label; the full name stays in the legend, table and aria-label. */
export function channelShort(key: string, name: string): string {
  return SHORT[key] ?? name;
}
