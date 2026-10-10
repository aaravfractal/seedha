/**
 * Seedha Link prefill: a link may open with ?room=&in=&nights=&code=.
 * Each value is checked on its own; a bad value is ignored, never guessed.
 * The server validates the booking again (dates, nights, room, code).
 */

export const MAX_NIGHTS = 14;
const HORIZON_DAYS = 365;
const CODE = /^[A-Za-z0-9-]{3,30}$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type Prefill = {
  room: string | null;
  checkIn: string | null;
  nights: number | null;
  code: string | null;
};

type Params = { get(name: string): string | null };

/** "2026-11-13" -> a UTC Date, or null when it is not a real calendar date. */
export function parseIsoDate(value: string): Date | null {
  const m = ISO_DATE.exec(value);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date;
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Add whole days to an ISO date. */
export function addDays(iso: string, days: number): string {
  const date = parseIsoDate(iso);
  if (!date) return iso;
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

/** A perk code as typed on a slip, upper-cased; null when it cannot be one. */
export function cleanCode(raw: string | null): string | null {
  const value = (raw ?? "").trim();
  return CODE.test(value) ? value.toUpperCase() : null;
}

/** Nights as a whole number from 1 to 14, else null. */
export function cleanNights(raw: string | null): number | null {
  const value = (raw ?? "").trim();
  if (!/^\d{1,2}$/.test(value)) return null;
  const n = Number(value);
  return n >= 1 && n <= MAX_NIGHTS ? n : null;
}

/** A check-in after `today` and within a year, else null. */
export function cleanCheckIn(raw: string | null, today: string): string | null {
  const value = (raw ?? "").trim();
  const date = parseIsoDate(value);
  if (!date || !parseIsoDate(today)) return null;
  return value > today && value <= addDays(today, HORIZON_DAYS) ? value : null;
}

function squash(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** The listed room type a prefill names ("deluxe-valley-view" or the exact name), else null. */
export function matchRoom(raw: string | null, roomTypes: readonly string[]): string | null {
  const wanted = squash(raw ?? "");
  if (!wanted) return null;
  return roomTypes.find((t) => squash(t) === wanted) ?? null;
}

/** Read every prefill value from the URL; the room is matched later against the listed rooms. */
export function readPrefill(params: Params, today: string): Prefill {
  const room = (params.get("room") ?? "").trim().slice(0, 60);
  return {
    room: room || null,
    checkIn: cleanCheckIn(params.get("in"), today),
    nights: cleanNights(params.get("nights")),
    code: cleanCode(params.get("code")),
  };
}

/** "Fri 13 Nov". */
export function dayLabel(iso: string): string {
  const date = parseIsoDate(iso);
  if (!date) return iso;
  return `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

/** "13 Nov to 15 Nov · 2 nights". */
export function stayLabel(checkIn: string, nights: number): string {
  const start = parseIsoDate(checkIn);
  const end = parseIsoDate(addDays(checkIn, nights));
  if (!start || !end) return "";
  const plural = nights === 1 ? "night" : "nights";
  return `${start.getUTCDate()} ${MONTHS[start.getUTCMonth()]} to ${end.getUTCDate()} ${
    MONTHS[end.getUTCMonth()]
  } · ${nights} ${plural}`;
}

/** Today's date in the guest's own time zone, as ISO. */
export function localToday(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
