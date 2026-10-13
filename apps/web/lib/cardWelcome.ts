/**
 * The card welcome panel on /h/<slug>?src=card-* (docs/CARD_PAGE.md, PART 2):
 * input checks that match the API contract, the Book again line and the
 * Book again address. Nothing here is a price: Book again opens Seedha Link
 * at the public rate, which the API computes.
 */
import { MAX_NIGHTS, parseIsoDate } from "./linkPrefill.ts";
import { perkWords } from "./hotelSiteV2.ts";
import { bookingLink } from "./siteHost.ts";
import type { CardVerify, RewardId, SiteReward } from "./types-hotel-site.ts";
import type { Lang } from "./types-site.ts";

/** Longest booking reference the API takes. */
export const BOOKING_REF_MAX = 30;
/** Longest private note the API takes. */
export const FEEDBACK_MAX = 500;

/** Longest guest name the feedback form takes. */
export const NAME_MAX = 60;
/** Longest WhatsApp number as typed (digits, spaces, a leading +). */
export const WHATSAPP_MAX = 16;

const BOOKING_REF = /^[A-Za-z0-9-]{1,30}$/;
const WHATSAPP = /^\+?[0-9 ]+$/;
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

/** The guest's name: 1 to 60 characters after trimming, else null. */
export function cleanName(raw: string): string | null {
  const value = raw.trim().replace(/\s+/g, " ");
  return value && [...value].length <= NAME_MAX ? value : null;
}

/** A WhatsApp number as the API takes it (digits, spaces, a leading +; at most 16; 10 to 15 digits), else null. */
export function cleanWhatsapp(raw: string): string | null {
  const value = raw.trim().replace(/\s+/g, " ");
  if (!value || value.length > WHATSAPP_MAX || !WHATSAPP.test(value)) return null;
  const digits = value.replace(/\D/g, "").length;
  return digits >= 10 && digits <= 15 ? value : null;
}

export type FeedbackForm = {
  name: string;
  whatsapp: string;
  ref: string;
  last4: string;
  askLast4: boolean;
  overall: number;
  food: number;
  review: string;
  reward: RewardId | "none";
  consent: boolean;
};

export type FeedbackField = "name" | "whatsapp" | "ref" | "last4" | "overall" | "review" | "reward";

/** Discounts are only for a stay the hotel can check: without a booking reference, breakfast only. */
export function rewardAllowed(reward: RewardId | "none", hasRef: boolean): boolean {
  return reward === "none" || reward === "breakfast" || hasRef;
}

/** The rewards the owner turned on, each once, in the API's order (anything unknown is left out). */
export function rewardChoices(rewards: SiteReward[] | null | undefined): SiteReward[] {
  const seen = new Set<string>();
  return (rewards ?? []).filter((r) => {
    if (!r || !["breakfast", "pct5", "flat100"].includes(r.id) || seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}

/**
 * Which fields stop the feedback form, in form order (empty when it can be
 * sent), and the body the API takes when it can. WhatsApp is needed (and
 * sent) only with consent; the phone digits only once the API asked for them.
 */
export function feedbackBody(f: FeedbackForm): {
  problems: FeedbackField[];
  body: Record<string, unknown> | null;
} {
  const problems: FeedbackField[] = [];
  const name = cleanName(f.name);
  if (!name) problems.push("name");
  // The number is sent (and so stored) only with consent.
  const whatsapp = f.consent ? cleanWhatsapp(f.whatsapp) : null;
  if (f.consent && !whatsapp) problems.push("whatsapp");
  const ref = f.ref.trim() ? cleanBookingRef(f.ref) : null;
  if (f.ref.trim() && !ref) problems.push("ref");
  const last4 = ref && f.askLast4 ? cleanLast4(f.last4) : null;
  if (ref && f.askLast4 && !last4) problems.push("last4");
  if (!Number.isInteger(f.overall) || f.overall < 1 || f.overall > 5) problems.push("overall");
  const review = f.review.trim();
  if ([...review].length > FEEDBACK_MAX) problems.push("review");
  if (!rewardAllowed(f.reward, Boolean(ref))) problems.push("reward");
  if (problems.length) return { problems, body: null };
  const food = Number.isInteger(f.food) && f.food >= 1 && f.food <= 5 ? f.food : null;
  return {
    problems,
    body: {
      name,
      ...(whatsapp ? { whatsapp } : {}),
      ...(ref ? { booking_ref: ref } : {}),
      ...(last4 ? { phone_last4: last4 } : {}),
      overall: f.overall,
      ...(food ? { food } : {}),
      ...(review ? { review } : {}),
      reward: f.reward,
      consent: f.consent,
    },
  };
}

/** "Hotel Deodar View" -> "Deodar View" for the slim Seedha bar; the full name when nothing is left. */
export function shortHotelName(name: string): string {
  const full = name.trim();
  const short = full
    .replace(/^(hotel|the)\s+/i, "")
    .replace(/^होटल\s+/, "")
    .trim();
  return short || full;
}

/**
 * The main Seedha home ("/") for "on Seedha" and "Powered by Seedha": the
 * app's own origin when the page has an absolute booking address (a hotel's
 * own host), localhost on *.localhost, else the same origin.
 */
export function seedhaHomeHref(bookingUrl: string | null | undefined, here?: Here): string {
  if (bookingUrl && /^https?:\/\//.test(bookingUrl)) {
    try {
      return `${new URL(bookingUrl).origin}/`;
    } catch {
      return "/";
    }
  }
  return bookingLink(bookingUrl || "/link", "/", here);
}
