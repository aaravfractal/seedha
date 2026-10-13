/**
 * Hotel Site V2 (docs/HOTEL_SITE_V2.md), the pure parts: card scans, links,
 * labels, structured data, cache tags and the hotel page's headers. Unit
 * tested in lib/hotelSiteV2.test.ts. Nothing here computes a price: rooms and
 * packages are shown exactly as the API sends them.
 */
import { inr } from "./format.ts";
import { mapsUrl } from "./localMap.ts";
import type { Lang } from "./types-site.ts";
import type {
  HotelSitePayload,
  RatingComment,
  RatingSummary,
  RoomDetail,
  ScanCard,
  SiteDetailsData,
} from "./types-hotel-site.ts";
import type { Geo } from "./types-site-v2.ts";

const CARDS: Readonly<Record<string, ScanCard>> = {
  "card-wallet": "wallet",
  "card-room": "room",
  "card-desk": "desk",
};

/** What a hotel without saved details shows (the API's defaults). */
export const EMPTY_DETAILS: SiteDetailsData = {
  amenities: [],
  amenity_labels: [],
  nearby: [],
  how_to_reach: [],
  good_to_know: [],
  check_in: "12:00",
  check_out: "11:00",
  contact: { phone: "", whatsapp: "", email: "", address_en: "", address_hi: "" },
  geo: null,
  sample: false,
  card_perk_en: "",
  card_perk_hi: "",
  rooms: [],
};

/**
 * The site payload with every V2 list present, so an API that does not send
 * `details` yet (or sends part of it) still renders the page.
 */
export function withDetails(
  site: Omit<HotelSitePayload, "details"> & { details?: Partial<SiteDetailsData> },
): HotelSitePayload {
  const d = site.details ?? {};
  return {
    ...site,
    details: {
      ...EMPTY_DETAILS,
      ...d,
      amenities: d.amenities ?? [],
      amenity_labels: d.amenity_labels ?? [],
      nearby: d.nearby ?? [],
      how_to_reach: d.how_to_reach ?? [],
      good_to_know: d.good_to_know ?? [],
      contact: { ...EMPTY_DETAILS.contact, ...(d.contact ?? {}) },
      geo: d.geo ?? null,
      card_perk_en: d.card_perk_en ?? "",
      card_perk_hi: d.card_perk_hi ?? "",
      rooms: d.rooms ?? [],
    },
  };
}

/**
 * The owner's card perk in the page language (Hindi falls back to English),
 * or "" when the owner set none. The page shows a perk only when this is not
 * empty: it never promises one the owner did not write (reviews R1-9, R2-1).
 */
export function cardPerk(
  details: Pick<SiteDetailsData, "card_perk_en" | "card_perk_hi">,
  lang: Lang,
): string {
  return pick((details.card_perk_en ?? "").trim(), (details.card_perk_hi ?? "").trim(), lang);
}

// The sample hotel's perk starts "Sample perk:" in the API's data; the page
// shows its own small "Sample" label instead (rule 11).
const SAMPLE_PERK_PREFIX = /^\s*(?:sample perk|नमूना पर्क)\s*:\s*/i;

/** The perk's own words: no "Sample perk:" prefix and no closing full stop, so it fits a sentence. */
export function perkWords(perk: string): string {
  return perk
    .replace(SAMPLE_PERK_PREFIX, "")
    .trim()
    .replace(/[\s.।]+$/u, "");
}

/**
 * The card ribbon's sentence around the owner's perk ("Scanned our card?
 * Book direct for <perk>."), or "" when there is no perk. The perk is the
 * owner's text; nothing is added to it.
 */
export function cardPerkSentence(perk: string, lang: Lang): string {
  const words = perkWords(perk);
  if (!words) return "";
  return lang === "hi"
    ? `हमारा कार्ड स्कैन किया? सीधे बुक करें और पाएं: ${words}।`
    : `Scanned our card? Book direct for ${words}.`;
}

/** The owner's facts for a room type (matched by name, ignoring case and spaces), or null. */
export function roomDetailFor(rooms: readonly RoomDetail[] | undefined, roomType: string): RoomDetail | null {
  const key = roomType.trim().toLowerCase();
  return (rooms ?? []).find((r) => (r.name ?? "").trim().toLowerCase() === key) ?? null;
}

/** The starting price exactly as the API computed it (integer paise), or null to show none. */
export function fromPrice(site: Pick<HotelSitePayload, "from_price_paise">): number | null {
  const p = site.from_price_paise;
  return typeof p === "number" && Number.isInteger(p) && p > 0 ? p : null;
}

export type RatingsView =
  { kind: "new" } | { kind: "shown"; average: string; count: number; comments: RatingComment[] };

/** Show a rating only as the API sums it, and only with at least 3 ratings; else "new". */
export function ratingsView(ratings: RatingSummary | undefined): RatingsView {
  const avg = ratings?.average;
  if (!ratings || typeof avg !== "number" || !Number.isFinite(avg) || ratings.count < 3)
    return { kind: "new" };
  const comments = (ratings.comments ?? []).filter((c) => (c.comment ?? "").trim());
  return { kind: "shown", average: avg.toFixed(1), count: ratings.count, comments };
}

const MONTHS: Record<Lang, readonly string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  hi: [
    "जनवरी",
    "फ़रवरी",
    "मार्च",
    "अप्रैल",
    "मई",
    "जून",
    "जुलाई",
    "अगस्त",
    "सितंबर",
    "अक्टूबर",
    "नवंबर",
    "दिसंबर",
  ],
};

/** "2026-09" as "Sep 2026" (Hindi: "सितंबर 2026"); anything else as it came. */
export function monthLabel(month: string, lang: Lang): string {
  const m = /^(\d{4})-(\d{2})/.exec(month);
  const name = m ? MONTHS[lang][Number(m[2]) - 1] : undefined;
  return m && name ? `${name} ${m[1]}` : month;
}

/** Longest rating comment (the API's limit). */
export const RATING_COMMENT_MAX = 200;

/** Why a rating comment cannot be sent, or null: at most 200 characters, no < or >. */
export function ratingCommentError(text: string): "too_long" | "bad_chars" | null {
  if ([...text].length > RATING_COMMENT_MAX) return "too_long";
  if (/[<>]/.test(text)) return "bad_chars";
  return null;
}

/** A rating link from the API as a safe href: a same-site path or an http(s) address, else "". */
export function ratingHref(url: string | null | undefined): string {
  const u = (url ?? "").trim();
  if (u.startsWith("/") && !u.startsWith("//")) return u;
  try {
    const parsed = new URL(u);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

/** How many amenities the hotel page shows before "Show all". */
export const AMENITIES_SHOWN = 12;

/** The printed card a QR scan came from (?src=card-wallet|card-room|card-desk), else null. */
export function scanCardFrom(search: string): ScanCard | null {
  const src = new URLSearchParams(search).get("src");
  return src !== null && Object.hasOwn(CARDS, src) ? (CARDS[src] ?? null) : null;
}

/** The query without `src`, so a reload or a shared link does not count the scan again. */
export function searchWithoutSrc(search: string): string {
  const params = new URLSearchParams(search);
  params.delete("src");
  const rest = params.toString();
  return rest ? `?${rest}` : "";
}

/** ?lang=en|hi when the owner shared a language version, else null. */
export function langFrom(search: string): Lang | null {
  const lang = new URLSearchParams(search).get("lang");
  return lang === "en" || lang === "hi" ? lang : null;
}

/** A plain Google Maps search link for the hotel's position (no API key, no embed), as LocalMap writes it. */
export function mapsHref(geo: Geo | null): string {
  if (!geo || !Number.isFinite(geo.lat) || !Number.isFinite(geo.lng)) return "";
  return mapsUrl(geo);
}

/** wa.me chat link for a number ("" when no number is set). */
export function whatsappHref(number: string): string {
  const digits = number.replace(/\D/g, "");
  return digits.length >= 6 ? `https://wa.me/${digits}` : "";
}

/** tel: link for a number ("" when no number is set). */
export function telHref(number: string): string {
  const plus = number.trim().startsWith("+") ? "+" : "";
  const digits = number.replace(/\D/g, "");
  return digits.length >= 6 ? `tel:${plus}${digits}` : "";
}

/** The Hindi text when there is one, else the English (owner text is English first). */
export function pick(en: string, hi: string, lang: Lang): string {
  return lang === "hi" && hi.trim() ? hi : en;
}

/**
 * Cache tags for the static hotel pages: every page carries both, so one
 * hotel can be marked stale alone (hotel-site:<slug>) or all at once.
 */
export const HOTEL_SITES_TAG = "hotel-sites";
export function hotelSiteTag(slug: string): string {
  return `hotel-site:${slug.slice(0, 64)}`;
}

export type HotelRevalidation = "none" | "own" | "all";

/**
 * Which static hotel pages a BFF response marks stale (security review R1-3):
 * - "own": a successful owner write to the hotel's own site (`site` and
 *   `site/*`: publish, text, photos, rooms on the site, packages, details,
 *   branding). Only that hotel's tag is cleared.
 * - "all": the demo reset, which reloads every table.
 * - "none": reads, failures, guest and device calls, every other owner
 *   write, and any write by the Direct beta demo login on the hosted site,
 *   where the sample's public page is locked to its fixed sample content.
 * No other owner write changes a public page: room prices on the page come
 * from the rack rates, which no owner route edits.
 */
export function hotelRevalidation(write: {
  access: string;
  method: string;
  status: number;
  path: string;
  subject: string | null;
  hosted: boolean;
}): HotelRevalidation {
  const { access, method, status, path, subject, hosted } = write;
  if (access !== "owner" || method === "GET" || method === "HEAD" || status < 200 || status >= 300) {
    return "none";
  }
  if (hosted && subject === "demo") return "none";
  if (path === "demo/reset") return "all";
  if (path === "site" || path.startsWith("site/")) return "own";
  return "none";
}

/** Crawl rules: public pages and hotel photos (under /api/public/site/), never the rest of the API. */
export const ROBOTS_RULES = { userAgent: "*", allow: ["/", "/api/public/site/"], disallow: ["/api/"] };

/** The service worker's scope: "/" on the hotel's own host, else the page's own path. */
export function serviceWorkerScope(pathname: string, slug: string): string {
  return pathname === "/" ? "/" : `/h/${slug}`;
}

/** Absolute URL for a same-origin path, on the hotel's public address. */
function absolute(path: string, base: string): string {
  try {
    return new URL(path, base).toString();
  } catch {
    return "";
  }
}

/** The photo widths and formats the public photo route serves (`?w=&fmt=`). */
export const PHOTO_WIDTHS = [480, 768, 1024] as const;
export type PhotoFormat = "avif" | "webp" | "jpeg";

export type PhotoSources = { avif: string; webp: string; jpeg: string; src: string };

/**
 * srcset strings for a public hotel photo in AVIF, WebP and JPEG, at the
 * widths the API resizes to (never wider than the stored photo, which the
 * API does not upscale), plus the JPEG fallback src. null for a photo that
 * is not on the public photo route (the owner's preview), which is shown as
 * it is.
 */
export function photoSources(url: string, width: number): PhotoSources | null {
  if (!url.startsWith("/api/public/site/") || !(width > 0)) return null;
  const sep = url.includes("?") ? "&" : "?";
  const at = (w: number, fmt: PhotoFormat) => `${url}${sep}w=${w}&fmt=${fmt}`;
  const steps: { w: number; shown: number }[] = [];
  for (const w of PHOTO_WIDTHS) {
    steps.push({ w, shown: Math.min(w, Math.round(width)) });
    if (w >= width) break;
  }
  const set = (fmt: PhotoFormat) => steps.map((x) => `${at(x.w, fmt)} ${x.shown}w`).join(", ");
  const largest = steps[steps.length - 1]!.w;
  return { avif: set("avif"), webp: set("webp"), jpeg: set("jpeg"), src: at(largest, "jpeg") };
}

/** Cut text to at most `max` characters at a word boundary, with an ellipsis when cut. */
export function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:]+$/, "")}…`;
}

/**
 * The page's meta description (about 155 characters): the owner's own
 * description when there is one, else the tagline with the hotel and place.
 * The sample hotel says it is a sample first (rule 11).
 */
export function metaDescription(site: HotelSitePayload): string {
  const place = site.location.en;
  const lead = site.sample ? "Sample hotel with fictional details. " : "";
  const where = place ? `${site.hotel} in ${place}` : site.hotel;
  const own = site.text?.description.en.trim() ?? "";
  if (own) return clip(`${lead}${own}`, 155);
  const tagline = site.tagline.en.trim().replace(/[.\s]+$/, "");
  const body = tagline
    ? `${tagline}. ${where}. Book directly with the hotel.`
    : `${where}. Book directly with the hotel.`;
  return clip(`${lead}${body}`, 155);
}

/**
 * "₹4,300 to ₹6,200" from the owner's own room prices as the API sends them
 * (formatting only, no price is computed); "" without a priced room.
 */
export function priceRange(rooms: readonly { nightly_rate: number }[]): string {
  const rates = rooms.map((r) => r.nightly_rate).filter((r) => Number.isInteger(r) && r > 0);
  if (!rates.length) return "";
  const low = Math.min(...rates);
  const high = Math.max(...rates);
  return low === high ? inr(low) : `${inr(low)} to ${inr(high)}`;
}

/**
 * schema.org Hotel for search engines: name, address, geo, telephone,
 * amenityFeature, url, image and the price range, each only when the hotel's
 * data has it. Never a review or rating. The fictional sample hotel (rule
 * 11; its page is also noindex) is labelled "(sample)" with a description
 * that says so, and carries no address, position, phone or email, so it
 * cannot pass for a real place (reviews R1-5, R2-6).
 */
export function hotelJsonLd(site: HotelSitePayload): Record<string, unknown> {
  const d = site.details;
  const url = site.url;
  const sample = site.sample || d.sample;
  const images = site.photos.map((p) => absolute(p.url, url)).filter(Boolean);
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Hotel",
    name: sample ? `${site.hotel} (sample)` : site.hotel,
    url,
  };
  if (sample) {
    data.description = "Sample hotel for the Seedha demo. All details are fictional.";
  } else {
    data.address = {
      "@type": "PostalAddress",
      ...(d.contact.address_en ? { streetAddress: d.contact.address_en } : {}),
      ...(site.location.en ? { addressLocality: site.location.en } : {}),
      addressCountry: "IN",
    };
    const description = site.text?.description.en || site.tagline.en;
    if (description) data.description = description;
    const telephone = d.contact.phone || d.contact.whatsapp;
    if (telephone) data.telephone = telephone;
    if (d.contact.email) data.email = d.contact.email;
    if (d.geo) data.geo = { "@type": "GeoCoordinates", latitude: d.geo.lat, longitude: d.geo.lng };
    const prices = priceRange(site.rooms);
    if (prices) data.priceRange = prices;
  }
  if (images.length) data.image = images;
  if (d.amenity_labels.length) {
    data.amenityFeature = d.amenity_labels.map((a) => ({
      "@type": "LocationFeatureSpecification",
      name: a.en,
      value: true,
    }));
  }
  if (d.check_in) data.checkinTime = d.check_in;
  if (d.check_out) data.checkoutTime = d.check_out;
  if (site.rooms_count > 0) data.numberOfRooms = site.rooms_count;
  return data;
}

/** JSON for a <script type="application/ld+json">, with "<" escaped so it cannot close the tag. */
export function jsonLdText(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/**
 * Headers for the public hotel pages (/h/<slug> and the hotel's own host):
 * the app's policy, tightened. No framing by other sites, no plugins, no
 * microphone or camera, workers only from this origin, network only to this
 * origin (the hotel's public API through the same-origin proxy), and no
 * stale copies in the browser after an owner save.
 */
export function hotelPageHeaders(dev: boolean): { key: string; value: string }[] {
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-ancestors 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  return [
    { key: "Content-Security-Policy", value: csp },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    // The server keeps the page static (and revalidates it on an owner save);
    // browsers must ask again each time rather than show a stale copy while
    // revalidating (Next's ISR header carries stale-while-revalidate).
    { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
  ];
}
