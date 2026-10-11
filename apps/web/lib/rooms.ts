/**
 * Room board helpers: read GET /rooms/nights (tolerating small shape
 * differences), label nights and tiles, count tiles per channel and move
 * keyboard focus around the grid. No money is computed here; net kept comes
 * from the API and is only formatted.
 */
import { inr } from "./format.ts";
import type { RoomChannelCount, RoomNight, RoomNights, RoomTile } from "./types-rooms.ts";

/** Channel order and names for the legend chips (ruling 3: "Direct", never "direct share"). */
export const ROOM_CHANNELS: readonly { key: string; name: string; code: string }[] = [
  { key: "mmt", name: "MakeMyTrip", code: "MMT" },
  { key: "bcom", name: "Booking.com", code: "BDC" },
  { key: "agoda", name: "Agoda", code: "AGO" },
  { key: "ta", name: "Agent", code: "AGT" },
  { key: "walkin", name: "Walk-in", code: "WLK" },
  { key: "direct", name: "Direct", code: "DIR" },
];

/** The three-letter tile code, as the Overview's Last night grid prints it. */
export function tileCode(key: string | null): string {
  if (key === null) return "Empty";
  return ROOM_CHANNELS.find((c) => c.key === key)?.code ?? key.slice(0, 3).toUpperCase();
}

/** The filter key for unsold rooms. */
export const EMPTY_KEY = "empty";

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function day(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

/** "2026-10-10" -> "Sat 10". */
export function dayLabel(iso: string): string {
  const d = day(iso);
  return `${DAYS_SHORT[d.getUTCDay()]} ${d.getUTCDate()}`;
}

/** "2026-10-10" -> "Saturday 10 October". */
export function dayLong(iso: string): string {
  const d = day(iso);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** The display name of a channel key, falling back to the key itself. */
export function channelName(key: string, byChannel: RoomChannelCount[] = []): string {
  return (
    byChannel.find((c) => c.channel_key === key)?.channel_name ??
    ROOM_CHANNELS.find((c) => c.key === key)?.name ??
    key
  );
}

/** "Room 204, MakeMyTrip" or "Room 105, empty". */
export function tileLabel(tile: RoomTile, byChannel: RoomChannelCount[] = []): string {
  if (!tile.sold || !tile.channel_key) return `Room ${tile.room}, empty`;
  return `Room ${tile.room}, ${channelName(tile.channel_key, byChannel)}`;
}

/** "14 of 22 rooms sold · ₹38,120 net kept · Direct bookings 21%". */
export function nightSummary(night: RoomNight): string {
  if (night.rooms_sold === 0)
    return `No rooms sold. ${night.rooms_total} room${night.rooms_total === 1 ? "" : "s"} free.`;
  const direct = night.direct_bookings_pct === null ? "" : ` · Direct bookings ${night.direct_bookings_pct}%`;
  return `${night.rooms_sold} of ${night.rooms_total} rooms sold · ${inr(night.net_kept)} net kept${direct}`;
}

export type LegendChip = { key: string; name: string; rooms: number };

/** One chip per channel plus Empty, with this night's room counts. */
export function legendChips(night: RoomNight): LegendChip[] {
  const counted = (key: string) => night.tiles.filter((t) => t.sold && t.channel_key === key).length;
  const known = ROOM_CHANNELS.map(({ key }) => ({
    key,
    name: channelName(key, night.by_channel),
    rooms: night.by_channel.find((c) => c.channel_key === key)?.rooms ?? counted(key),
  }));
  const extra = night.by_channel
    .filter((c) => !ROOM_CHANNELS.some((k) => k.key === c.channel_key))
    .map((c) => ({ key: c.channel_key, name: c.channel_name, rooms: c.rooms }));
  const empty = night.tiles.filter((t) => !t.sold).length;
  return [...known, ...extra, { key: EMPTY_KEY, name: "Empty", rooms: empty }];
}

/** True when a tile matches the active filter (null shows every tile). */
export function tileMatches(tile: RoomTile, filter: string | null): boolean {
  if (filter === null) return true;
  if (filter === EMPTY_KEY) return !tile.sold;
  return tile.sold && tile.channel_key === filter;
}

/** The next focused index for an arrow, Home or End key in a grid of `cols` columns. */
export function gridMove(index: number, key: string, total: number, cols: number): number {
  if (total <= 0) return 0;
  const width = Math.max(1, cols);
  const next =
    key === "ArrowRight"
      ? index + 1
      : key === "ArrowLeft"
        ? index - 1
        : key === "ArrowDown"
          ? index + width
          : key === "ArrowUp"
            ? index - width
            : key === "Home"
              ? 0
              : key === "End"
                ? total - 1
                : index;
  return next < 0 || next >= total ? index : next;
}

/** A positive whole room number from ?room=, else null. */
export function roomParam(value: string | null): number | null {
  if (value === null || !/^\d{1,5}$/.test(value)) return null;
  const n = Number(value);
  return n > 0 ? n : null;
}

/* ---------- reading the API ---------- */

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

function readTiles(n: Obj): RoomTile[] {
  const list = Array.isArray(n.tiles) ? n.tiles : Array.isArray(n.rooms) ? n.rooms : [];
  return list.filter(isObj).map((t) => {
    const key = str(t.channel_key);
    return {
      room: num(t.room ?? t.number),
      channel_key: key,
      sold: typeof t.sold === "boolean" ? t.sold : key !== null,
    };
  });
}

function readByChannel(n: Obj): RoomChannelCount[] {
  const raw = n.by_channel;
  if (Array.isArray(raw)) {
    return raw.filter(isObj).map((c) => {
      const key = str(c.channel_key) ?? str(c.key) ?? "";
      return {
        channel_key: key,
        channel_name: str(c.channel_name) ?? str(c.name) ?? channelName(key),
        rooms: num(c.rooms ?? c.count),
      };
    });
  }
  if (isObj(raw)) {
    return Object.entries(raw).map(([key, rooms]) => ({
      channel_key: key,
      channel_name: channelName(key),
      rooms: num(rooms),
    }));
  }
  return [];
}

function readNight(n: Obj): RoomNight {
  const tiles = readTiles(n);
  const pct = n.direct_bookings_pct;
  return {
    night: str(n.night) ?? str(n.date) ?? "",
    rooms_sold: num(n.rooms_sold, tiles.filter((t) => t.sold).length),
    rooms_total: num(n.rooms_total, tiles.length),
    net_kept: num(n.net_kept),
    direct_bookings_pct: typeof pct === "number" ? pct : null,
    by_channel: readByChannel(n),
    tiles,
  };
}

/** GET /rooms/nights as an array or {nights: [...]}, oldest night first. */
export function readNights(raw: unknown): RoomNights {
  const list = Array.isArray(raw) ? raw : isObj(raw) && Array.isArray(raw.nights) ? raw.nights : [];
  const nights = list
    .filter(isObj)
    .map(readNight)
    .filter((n) => n.night !== "")
    .sort((a, b) => (a.night < b.night ? -1 : a.night > b.night ? 1 : 0));
  const sample = isObj(raw) && typeof raw.is_sample === "boolean" ? raw.is_sample : false;
  return { nights, is_sample: sample };
}

/** The Overview's single last night, used until /rooms/nights answers or if it fails. */
export function fromLastNight(last: {
  date: string;
  rooms_count: number;
  sold: number;
  net_kept: number;
  direct_share_pct: number | null;
  is_sample: boolean;
  rooms: { number: number; channel_key: string | null }[];
}): RoomNights {
  const tiles = last.rooms.map((r) => ({
    room: r.number,
    channel_key: r.channel_key,
    sold: r.channel_key !== null,
  }));
  return {
    is_sample: last.is_sample,
    nights: [
      {
        night: last.date,
        rooms_sold: last.sold,
        rooms_total: last.rooms_count,
        net_kept: last.net_kept,
        direct_bookings_pct: last.direct_share_pct,
        by_channel: [],
        tiles,
      },
    ],
  };
}
