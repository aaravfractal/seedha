/**
 * Hotel Site V2 (docs/HOTEL_SITE_V2.md), the pure parts: card scans, links,
 * labels, structured data, cache tags and the hotel page's headers. Unit
 * tested in lib/hotelSiteV2.test.ts. Nothing here computes a price: rooms and
 * packages are shown exactly as the API sends them.
 */
import { mapsUrl } from "./localMap.ts";
import type { Lang } from "./types-site.ts";
import type { HotelSitePayload, ScanCard, SiteDetailsData } from "./types-hotel-site.ts";
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
    },
  };
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

/** Cache tags for the static hotel pages (revalidated when an owner saves anything). */
export const HOTEL_SITES_TAG = "hotel-sites";
export function hotelSiteTag(slug: string): string {
  return `hotel-site:${slug.slice(0, 64)}`;
}

/**
 * Whether a BFF response should mark every hotel page stale: a successful
 * owner write (publish, site edits, branding, rooms, prices, the demo reset).
 * Reads and guest calls never do.
 */
export function revalidatesHotelSites(access: string, method: string, status: number): boolean {
  return access === "owner" && method !== "GET" && method !== "HEAD" && status >= 200 && status < 300;
}

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

/**
 * schema.org Hotel for search engines: name, address, geo, telephone,
 * amenityFeature, url and image. Never a review, rating or price. The
 * sample hotel's placeholder phone is left out.
 */
export function hotelJsonLd(site: HotelSitePayload): Record<string, unknown> {
  const d = site.details;
  const url = site.url;
  const images = site.photos.map((p) => absolute(p.url, url)).filter(Boolean);
  const description = site.text?.description.en || site.tagline.en;
  const telephone = d.sample ? "" : d.contact.phone || d.contact.whatsapp;
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Hotel",
    name: site.hotel,
    url,
    address: {
      "@type": "PostalAddress",
      ...(d.contact.address_en ? { streetAddress: d.contact.address_en } : {}),
      ...(site.location.en ? { addressLocality: site.location.en } : {}),
      addressCountry: "IN",
    },
  };
  if (description) data.description = description;
  if (images.length) data.image = images;
  if (telephone) data.telephone = telephone;
  if (d.contact.email && !d.sample) data.email = d.contact.email;
  if (d.geo) data.geo = { "@type": "GeoCoordinates", latitude: d.geo.lat, longitude: d.geo.lng };
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
