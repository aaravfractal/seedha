/** Small display helpers for the Guest inbox (times in IST, initials, avatars). */

const IST = "Asia/Kolkata";

/** "NG" from "Neha Gupta", "KF" from "Kapoor family". */
export function initials(name: string): string {
  const parts = name
    .replace(/[^\p{L}\s]/gu, " ")
    .trim()
    .split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "";
  return `${first}${second}`.toUpperCase() || "G";
}

/** Fixed avatar fills with white text (each at least 4.5:1 against #fff). */
const AVATARS = ["#1E6B4E", "#1D1D1F", "#3A3A3C", "#48484A", "#5A5A5E"];

export function avatarFill(id: number): string {
  return AVATARS[Math.abs(id) % AVATARS.length] ?? "#1E6B4E";
}

/** "9:12 PM" in IST. */
export function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: IST });
}

function dayKey(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: IST });
}

/** "Today", "Yesterday" or "14 Jun" for a day divider. */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const key = dayKey(d);
  if (key === dayKey(now)) return "Today";
  if (key === dayKey(new Date(now.getTime() - 86_400_000))) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: IST });
}

/** List time: clock today, else the short date. */
export function listTime(iso: string, now: Date = new Date()): string {
  const label = dayLabel(iso, now);
  return label === "Today" ? clock(iso) : label;
}

/** "13 Oct 2026, 7:42 PM". */
export function dateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: IST,
  });
  return `${date}, ${clock(iso)}`;
}

/** "7 to 9 Nov" for a stay of N nights from an ISO date. */
export function stayRange(checkIn: string, nights: number): string {
  const start = new Date(`${checkIn}T00:00:00Z`);
  const end = new Date(start.getTime() + nights * 86_400_000);
  const fmt = (d: Date, month: boolean) =>
    d.toLocaleDateString("en-IN", { day: "numeric", ...(month ? { month: "short" } : {}), timeZone: "UTC" });
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  return `${fmt(start, !sameMonth)} to ${fmt(end, true)}`;
}

/** "14 Jun 2026" from an ISO date. */
export function shortDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
