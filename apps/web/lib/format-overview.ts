/**
 * Formatting used by the app shell and Overview. Money arrives as integer
 * paise; this only turns it into text at the edge (CLAUDE.md section 7).
 */

const MINUS = "−";
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
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Short chart label: 630500000 paise -> "63.1L", -275200 -> "−2.8K". Half-up. */
export function compactInr(paise: number): string {
  const sign = paise < 0 ? MINUS : "";
  const magnitude = Math.abs(Math.trunc(paise));
  const scaled = (unitPaise: number) => Math.floor((magnitude * 10) / unitPaise + 0.5) / 10;
  if (magnitude >= 100_000_00) return `${sign}${scaled(100_000_00).toFixed(1)}L`;
  if (magnitude >= 1_000_00) return `${sign}${scaled(1_000_00).toFixed(1)}K`;
  return `${sign}${Math.floor(magnitude / 100 + 0.5)}`;
}

function parseDay(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

/** "2026-10-13" -> "Tuesday, 13 October 2026". */
export function longDate(iso: string): string {
  const day = parseDay(iso);
  return `${DAYS[day.getUTCDay()]}, ${day.getUTCDate()} ${MONTHS[day.getUTCMonth()]} ${day.getUTCFullYear()}`;
}

/** "2026-04-01", "2026-09-30" -> "Apr to Sep 2026"; across years -> "Dec 2025 to Mar 2026". */
export function monthRange(start: string, end: string): string {
  const a = parseDay(start);
  const b = parseDay(end);
  const short = (d: Date) => (MONTHS[d.getUTCMonth()] ?? "").slice(0, 3);
  if (a.getUTCFullYear() === b.getUTCFullYear()) {
    return `${short(a)} to ${short(b)} ${b.getUTCFullYear()}`;
  }
  return `${short(a)} ${a.getUTCFullYear()} to ${short(b)} ${b.getUTCFullYear()}`;
}

/** An API timestamp shown in India time: "13 Oct, 7:42 PM". */
export function timeLabel(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")} ${get("month")}, ${get("hour")}:${get("minute")} ${get("dayPeriod").toUpperCase()}`;
}

/** A tenths-of-a-percent share rounded to a whole percent: 373 -> "37%". */
export function wholePct(tenths: number): string {
  return `${Math.floor(tenths / 10 + 0.5)}%`;
}
