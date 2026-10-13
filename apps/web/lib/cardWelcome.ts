/**
 * The card welcome panel on /h/<slug>?src=card-* (docs/CARD_PAGE.md, PART 2):
 * input checks that match the API contract, the Book again line and the
 * Book again address. Nothing here is a price: Book again opens Seedha Link
 * at the public rate, which the API computes.
 */
import { MAX_NIGHTS, parseIsoDate } from "./linkPrefill.ts";
import { perkWords } from "./hotelSiteV2.ts";
import { bookingLink } from "./siteHost.ts";
import type { CardVerify } from "./types-hotel-site.ts";
import type { Lang } from "./types-site.ts";

/** Longest booking reference the API takes. */
export const BOOKING_REF_MAX = 30;
/** Longest private note the API takes. */
export const FEEDBACK_MAX = 500;

const BOOKING_REF = /^[A-Za-z0-9-]{1,30}$/;
const LAST4 = /^\d{4}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The booking reference as the API takes it (1 to 30 letters, digits or dashes), else null. */
export function cleanBookingRef(raw: string): string | null {
  const value = raw.trim();
  return BOOKING_REF.test(value) ? value : null;
}

/** Exactly 4 digits, else null. */
export function cleanLast4(raw: string): string | null {
  const value = raw.trim();
  return LAST4.test(value) ? value : null;
}

/** Why a private note cannot be sent, or null: 1 to 500 characters after trimming. */
export function feedbackError(text: string): "empty" | "too_long" | null {
  const value = text.trim();
  if (!value) return "empty";
  if ([...value].length > FEEDBACK_MAX) return "too_long";
  return null;
}

/**
 * "Book direct next time: <perk>" around the owner's own perk words (no
 * "Sample perk:" prefix), or just "Book direct next time" when the owner set
 * no perk. Nothing is added to the perk.
 */
export function bookAgainLine(perk: string, lang: Lang): { lead: string; perk: string } {
  const words = perkWords(perk);
  if (lang === "hi")
    return { lead: words ? "अगली बार सीधे बुक करें:" : "अगली बार सीधे बुक करें", perk: words };
  return { lead: words ? "Book direct next time:" : "Book direct next time", perk: words };
}

type Here = { protocol: string; hostname: string; port: string };

/** The Book again prefill a verified stay carries, each value checked; anything odd is left out. */
export function stayPrefill(verify: CardVerify | null): {
  room: string | null;
  checkIn: string | null;
  nights: number | null;
  code: string | null;
} {
  if (!verify || verify.state !== "verified") return { room: null, checkIn: null, nights: null, code: null };
  const room = (verify.room_type ?? "").trim().slice(0, 60) || null;
  const day = verify.next_check_in ?? "";
  const checkIn = ISO_DATE.test(day) && parseIsoDate(day) ? day : null;
  const n = verify.nights;
  const nights = typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= MAX_NIGHTS ? n : null;
  const rawCode = (verify.perk_code ?? "").trim();
  const code = /^[A-Za-z0-9-]{3,30}$/.test(rawCode) ? rawCode : null;
  return { room, checkIn, nights, code };
}

/**
 * Where Book again goes: Seedha Link, with the verified stay's room, next
 * check-in and nights, and the guest's own perk code in the path when the
 * API gave one (/link/<code>?room=&in=&nights=). Unverified: /link with the
 * first room type and no dates. Works from /h/<slug>, from a hotel's own
 * host and with an absolute booking address, like the page's Book buttons.
 */
export function bookAgainHref(opts: {
  bookingUrl: string | null | undefined;
  verify: CardVerify | null;
  firstRoom: string;
  here?: Here;
}): string {
  const p = stayPrefill(opts.verify);
  const q = new URLSearchParams();
  const room = p.room ?? (opts.firstRoom.trim() || null);
  if (room) q.set("room", room);
  if (p.checkIn) q.set("in", p.checkIn);
  if (p.nights) q.set("nights", String(p.nights));
  const query = q.size ? `?${q.toString()}` : "";
  const codePart = p.code ? `/${encodeURIComponent(p.code)}` : "";
  const base = opts.bookingUrl || "/link";
  if (/^https?:\/\//.test(base)) return `${base.replace(/\/+$/, "")}${codePart}${query}`;
  return bookingLink(base, `/link${codePart}${query}`, opts.here);
}
