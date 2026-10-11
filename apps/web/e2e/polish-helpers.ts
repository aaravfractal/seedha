import { expect } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";

/**
 * Shared helpers for the polish-build specs (room board, inbox, Pro views).
 * The rupee formatter is written here on purpose rather than imported from
 * lib/format, so the specs check the screen against the API independently.
 */

/** Integer paise as the screen prints it: "₹10,39,108", "−₹802", "₹0". */
export function inr(paise: number): string {
  const rupees = Math.floor((Math.abs(Math.trunc(paise)) + 50) / 100);
  const digits = String(rupees);
  let grouped = digits;
  if (digits.length > 3) {
    let head = digits.slice(0, -3);
    const parts: string[] = [];
    while (head.length > 2) {
      parts.unshift(head.slice(-2));
      head = head.slice(0, -2);
    }
    grouped = [head, ...parts, digits.slice(-3)].join(",");
  }
  return `${paise < 0 && rupees > 0 ? "−" : ""}₹${grouped}`;
}

/** A deduction line on the room sheet: "−₹1,234", or "₹0" when nothing was taken. */
export const deduction = (paise: number): string => (paise > 0 ? inr(-paise) : inr(0));

/** GET through the web app's /api proxy (the signed-in owner's cookie) and parse JSON. */
export async function getJson<T>(page: Page, path: string): Promise<T> {
  const res = await page.request.get(`/api/${path}`);
  expect(res.ok(), `GET /api/${path}: ${res.status()}`).toBe(true);
  return (await res.json()) as T;
}

/* ---------- room board ---------- */

export type ChannelCount = { channel_key: string; channel_name: string; rooms: number };
export type Tile = { room: number; channel_key: string | null; sold: boolean };
export type Night = {
  night: string;
  rooms_sold: number;
  rooms_total: number;
  net_kept: number;
  direct_bookings_pct: number | null;
  by_channel: ChannelCount[];
  tiles: Tile[];
};
export type RoomDetail = {
  room: number;
  night: string;
  channel_key: string;
  channel_name: string;
  nights: number;
  list_amount: number;
  discount: number;
  commission: number;
  gst_on_commission: number;
  fees: number;
  net_kept: number;
  guest_initials: string;
  consent_status: string;
  consent_id: number | null;
  if_direct: { extra_kept: number; commission_avoided: number; gst_avoided: number; upi_fee: number } | null;
};

export async function roomNights(page: Page): Promise<Night[]> {
  return (await getJson<{ nights: Night[] }>(page, "rooms/nights")).nights;
}

const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MON = [
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

function utcDay(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

/** "2026-10-10" -> "Saturday 10 October" (the scrubber's accessible name and the sheet subtitle). */
export function longDay(iso: string): string {
  const d = utcDay(iso);
  return `${DOW[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
}

/** "2026-10-10" -> "Sat 10" (the board heading for an earlier night). */
export function shortDay(iso: string): string {
  const d = utcDay(iso);
  return `${(DOW[d.getUTCDay()] ?? "").slice(0, 3)} ${d.getUTCDate()}`;
}

/** The summary line the board should print for a night, built from the API numbers. */
export function expectedSummary(n: Night): string {
  if (n.rooms_sold === 0) return `No rooms sold of ${n.rooms_total}`;
  const direct = n.direct_bookings_pct === null ? "" : ` · Direct bookings ${n.direct_bookings_pct}%`;
  return `${n.rooms_sold} of ${n.rooms_total} rooms sold · ${inr(n.net_kept)} net kept${direct}`;
}

/* ---------- inbox ---------- */

export type ThreadRow = {
  consent_id: number;
  guest_name: string;
  unread: number;
  last: { direction: "in" | "out"; body: string; sent_by?: string | null } | null;
};
export type Bubble = { direction: "in" | "out"; body: string };

export async function threads(page: Page): Promise<ThreadRow[]> {
  return (await getJson<{ threads: ThreadRow[] }>(page, "inbox/threads")).threads;
}

export async function threadId(page: Page, name: string): Promise<number> {
  const row = (await threads(page)).find((t) => t.guest_name === name);
  expect(row, `${name} has a thread`).toBeTruthy();
  return row?.consent_id ?? 0;
}

export async function bubbles(page: Page, id: number): Promise<Bubble[]> {
  return (await getJson<{ messages: Bubble[] }>(page, `inbox/threads/${id}/messages`)).messages;
}

/** Act as the guest (the demo webhook path) writing one text on a thread. */
export async function guestWrites(page: Page, id: number, text: string): Promise<void> {
  const res = await page.request.post(`/api/inbox/threads/${id}/simulate`, { data: { text } });
  expect(res.ok(), `simulate on thread ${id}: ${res.status()}`).toBe(true);
}

export const BILL_REQUEST = "Hi, could you please send the invoice for my stay? I need it for the office.";

/**
 * Make the guest's newest text a bill request, so opening the thread fetches
 * a draft with the stay invoice attached. Leaves the thread alone when it
 * already ends on one, whichever spec ran before.
 */
export async function ensureBillRequest(page: Page, id: number): Promise<void> {
  const last = (await bubbles(page, id)).at(-1);
  if (last?.direction === "in" && /invoice|bill|बिल/i.test(last.body)) return;
  await guestWrites(page, id, BILL_REQUEST);
}

/* ---------- theme ---------- */

/** Pick the light or dark theme through the app's own cookie. */
export async function setTheme(
  context: BrowserContext,
  baseURL: string | undefined,
  theme: "light" | "dark",
): Promise<void> {
  expect(baseURL, "baseURL").toBeTruthy();
  await context.addCookies([{ name: "seedha_theme", value: theme, url: baseURL ?? "" }]);
}
