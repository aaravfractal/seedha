/**
 * Hotel Site V2 owner editors: pure helpers (no "@/" imports, so node --test
 * runs them). Client-side checks mirror SiteDetailsIn in
 * apps/api/app/services/site_details.py; the API stays the judge, and its 422
 * problems are turned into plain words by `apiProblems`. Nothing here is money.
 */
import { AMENITIES, AMENITY_IDS } from "./amenities.ts";
import type { AmenityId } from "./amenities.ts";
import type {
  CardKind,
  Contact,
  FieldProblem,
  NearbyKind,
  Note,
  ReachItem,
  ReachMode,
  ScanCard,
  ScanDay,
  SiteDetailsIn,
  SiteDetailsOut,
  TravelMode,
} from "./types-site-v2-owner.ts";

/** The API's limits (docs/HOTEL_SITE_V2.md). */
export const DETAIL_LIMITS = {
  amenities: 40,
  nearby: 8,
  reach: 6,
  notes: 8,
  name: 60,
  reachText: 200,
  note: 160,
  phone: 16,
  email: 120,
  address: 200,
  minutesMin: 1,
  minutesMax: 600,
} as const;

export const NEARBY_KINDS: ReadonlyArray<readonly [NearbyKind, string]> = [
  ["viewpoint", "Viewpoint"],
  ["temple", "Temple"],
  ["market", "Market"],
  ["waterfall", "Waterfall"],
  ["trek", "Trek"],
  ["lake", "Lake"],
  ["station", "Railway station"],
  ["airport", "Airport"],
  ["other", "Other"],
];

export const TRAVEL_MODES: ReadonlyArray<readonly [TravelMode, string]> = [
  ["walk", "On foot"],
  ["drive", "By car"],
];

export const REACH_MODES: ReadonlyArray<readonly [ReachMode, string]> = [
  ["road", "By road"],
  ["rail", "By train"],
  ["air", "By air"],
];

/** Eight compass points for the "which way from the hotel" picker. */
export const DIRECTIONS: ReadonlyArray<readonly [string, string, number]> = [
  ["N", "North", 0],
  ["NE", "North-east", 45],
  ["E", "East", 90],
  ["SE", "South-east", 135],
  ["S", "South", 180],
  ["SW", "South-west", 225],
  ["W", "West", 270],
  ["NW", "North-west", 315],
];

/** The compass point nearest a bearing (0 to 359), as [short, long]. */
export function nearestDirection(bearing: number): readonly [string, string] {
  const b = ((Math.round(bearing) % 360) + 360) % 360;
  const index = Math.round(b / 45) % 8;
  const d = DIRECTIONS[index] ?? DIRECTIONS[0];
  return d ? [d[0], d[1]] : ["N", "North"];
}

/** The 40 amenities in groups for the picker. Every id appears exactly once. */
export const AMENITY_GROUPS: ReadonlyArray<{ title: string; ids: readonly AmenityId[] }> = [
  {
    title: "Rooms",
    ids: [
      "hot_water",
      "heater",
      "geyser",
      "balcony",
      "family_rooms",
      "tv",
      "tea_coffee",
      "workspace",
      "housekeeping",
      "room_service",
    ],
  },
  { title: "Food", ids: ["breakfast", "restaurant", "veg_food", "local_food"] },
  {
    title: "Views and outdoors",
    ids: ["valley_view", "mountain_view", "garden", "terrace", "bonfire", "yoga", "trek_guide"],
  },
  {
    title: "Getting around",
    ids: ["parking", "travel_desk", "taxi", "airport_pickup", "luggage"],
  },
  {
    title: "Comfort and care",
    ids: [
      "wifi",
      "power_backup",
      "laundry",
      "lift",
      "wheelchair",
      "doctor_on_call",
      "first_aid",
      "cctv",
      "kids_play",
      "pet_friendly",
      "library",
      "indoor_games",
    ],
  },
  { title: "Payments", ids: ["upi", "cards"] },
];

/** English and Hindi labels of an amenity id. */
export function amenityLabel(id: string): { en: string; hi: string } {
  const found = AMENITIES.find((a) => a.id === id);
  return found ? { en: found.en, hi: found.hi } : { en: id, hi: id };
}

/** Amenities whose English or Hindi label contains the search text. */
export function matchesAmenity(id: AmenityId, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const { en, hi } = amenityLabel(id);
  return en.toLowerCase().includes(q) || hi.includes(q) || id.includes(q.replace(/\s+/g, "_"));
}

/* ---------- the editable draft ---------- */

/** A nearby place as typed: numbers stay text until saved. */
export type NearbyDraft = {
  name_en: string;
  name_hi: string;
  minutes: string;
  mode: TravelMode;
  kind: NearbyKind;
  bearing: string;
};

export type DetailsDraft = {
  amenities: AmenityId[];
  nearby: NearbyDraft[];
  how_to_reach: ReachItem[];
  good_to_know: Note[];
  check_in: string;
  check_out: string;
  contact: Contact;
  lat: string;
  lng: string;
};

/** The saved facts as an editable draft. */
export function toDraft(details: SiteDetailsIn | SiteDetailsOut): DetailsDraft {
  return {
    amenities: AMENITY_IDS.filter((id) => details.amenities.includes(id)),
    nearby: details.nearby.map((p) => ({
      name_en: p.name_en,
      name_hi: p.name_hi,
      minutes: String(p.minutes),
      mode: p.mode,
      kind: p.kind,
      bearing: String(p.bearing),
    })),
    how_to_reach: details.how_to_reach.map((r) => ({ ...r })),
    good_to_know: details.good_to_know.map((n) => ({ ...n })),
    check_in: details.check_in,
    check_out: details.check_out,
    contact: { ...details.contact },
    lat: details.geo ? String(details.geo.lat) : "",
    lng: details.geo ? String(details.geo.lng) : "",
  };
}

export function emptyNearby(): NearbyDraft {
  return { name_en: "", name_hi: "", minutes: "10", mode: "drive", kind: "viewpoint", bearing: "0" };
}

/** True when the draft differs from what was saved. */
export function draftChanged(draft: DetailsDraft, saved: DetailsDraft): boolean {
  return JSON.stringify(draft) !== JSON.stringify(saved);
}

/* ---------- checks (mirror the API) ---------- */

/** Letters as Python counts them (code points), after the API's strip. */
export function letters(value: string): number {
  return [...value.trim()].length;
}

/** A required or optional plain-text line: empty, too long or markup. Null when fine. */
export function textError(value: string, max: number, required: boolean): string | null {
  const n = letters(value);
  if (required && n === 0) return "This cannot be empty.";
  if (n > max) return `Use ${max} letters or fewer. This has ${n}.`;
  if (value.includes("<") || value.includes(">")) return "Use plain text without < or >.";
  return null;
}

/** Digits, spaces and one leading +, at most 16 characters, or empty. */
export function phoneError(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (letters(v) > DETAIL_LIMITS.phone) return `Use ${DETAIL_LIMITS.phone} characters or fewer.`;
  if (!/^\+?[0-9 ]*$/.test(v) || !/[0-9]/.test(v)) return "Use digits, spaces and a leading +.";
  return null;
}

const EMAIL = /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/;

export function emailError(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (letters(v) > DETAIL_LIMITS.email) return `Use ${DETAIL_LIMITS.email} characters or fewer.`;
  if (!EMAIL.test(v)) return "Use an email like name@example.com.";
  return null;
}

/** 24-hour time, HH:MM. */
export function timeError(value: string): string | null {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim()) ? null : "Use a 24-hour time like 12:00.";
}

/** A whole number typed as text, within [min, max]. */
export function wholeError(value: string, min: number, max: number, unit: string): string | null {
  const v = value.trim();
  if (!/^\d+$/.test(v)) return `Use a whole number of ${unit}.`;
  const n = Number(v);
  if (n < min || n > max) return `Use ${min} to ${max} ${unit}.`;
  return null;
}

/** A decimal coordinate within [-limit, limit]. */
export function coordError(value: string, limit: number): string | null {
  const v = value.trim();
  if (!/^-?\d{1,3}(\.\d+)?$/.test(v)) return "Use a number like 30.4598.";
  const n = Number(v);
  if (!Number.isFinite(n) || Math.abs(n) > limit) return `Use a number from -${limit} to ${limit}.`;
  return null;
}

/** Errors keyed like the API's 422 fields ("nearby.0.name_en"). Empty when the draft can be saved. */
export function validateDraft(d: DetailsDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  const put = (key: string, err: string | null) => {
    if (err) errors[key] = err;
  };
  const L = DETAIL_LIMITS;
  if (d.amenities.length > L.amenities) put("amenities", `Pick up to ${L.amenities}.`);
  if (d.amenities.some((a) => !AMENITY_IDS.includes(a))) put("amenities", "Pick from the list only.");
  if (d.nearby.length > L.nearby) put("nearby", `Add up to ${L.nearby} places.`);
  d.nearby.forEach((p, i) => {
    put(`nearby.${i}.name_en`, textError(p.name_en, L.name, true));
    put(`nearby.${i}.name_hi`, textError(p.name_hi, L.name, false));
    put(`nearby.${i}.minutes`, wholeError(p.minutes, L.minutesMin, L.minutesMax, "minutes"));
    put(`nearby.${i}.bearing`, wholeError(p.bearing, 0, 359, "degrees"));
  });
  if (d.how_to_reach.length > L.reach) put("how_to_reach", `Add up to ${L.reach} ways.`);
  d.how_to_reach.forEach((r, i) => {
    put(`how_to_reach.${i}.text_en`, textError(r.text_en, L.reachText, true));
    put(`how_to_reach.${i}.text_hi`, textError(r.text_hi, L.reachText, false));
  });
  if (d.good_to_know.length > L.notes) put("good_to_know", `Add up to ${L.notes} lines.`);
  d.good_to_know.forEach((n, i) => {
    put(`good_to_know.${i}.text_en`, textError(n.text_en, L.note, true));
    put(`good_to_know.${i}.text_hi`, textError(n.text_hi, L.note, false));
  });
  put("check_in", timeError(d.check_in));
  put("check_out", timeError(d.check_out));
  put("contact.phone", phoneError(d.contact.phone));
  put("contact.whatsapp", phoneError(d.contact.whatsapp));
  put("contact.email", emailError(d.contact.email));
  put("contact.address_en", textError(d.contact.address_en, L.address, false));
  put("contact.address_hi", textError(d.contact.address_hi, L.address, false));
  const hasLat = d.lat.trim() !== "";
  const hasLng = d.lng.trim() !== "";
  if (hasLat || hasLng) {
    put("geo.lat", hasLat ? coordError(d.lat, 90) : "Add the latitude too, or clear both.");
    put("geo.lng", hasLng ? coordError(d.lng, 180) : "Add the longitude too, or clear both.");
  }
  return errors;
}

/** The PUT body from a draft that passed `validateDraft`. Strings trimmed like the API. */
export function fromDraft(d: DetailsDraft): SiteDetailsIn {
  const t = (s: string) => s.trim();
  const hasGeo = t(d.lat) !== "" && t(d.lng) !== "";
  return {
    amenities: AMENITY_IDS.filter((id) => d.amenities.includes(id)),
    nearby: d.nearby.map((p) => ({
      name_en: t(p.name_en),
      name_hi: t(p.name_hi),
      minutes: Number(t(p.minutes)),
      mode: p.mode,
      kind: p.kind,
      bearing: Number(t(p.bearing)),
    })),
    how_to_reach: d.how_to_reach.map((r) => ({ mode: r.mode, text_en: t(r.text_en), text_hi: t(r.text_hi) })),
    good_to_know: d.good_to_know.map((n) => ({ text_en: t(n.text_en), text_hi: t(n.text_hi) })),
    check_in: t(d.check_in),
    check_out: t(d.check_out),
    contact: {
      phone: t(d.contact.phone),
      whatsapp: t(d.contact.whatsapp),
      email: t(d.contact.email),
      address_en: t(d.contact.address_en),
      address_hi: t(d.contact.address_hi),
    },
    geo: hasGeo ? { lat: Number(t(d.lat)), lng: Number(t(d.lng)) } : null,
  };
}

/* ---------- the API's 422 in plain words ---------- */

const SECTION: Record<string, string> = {
  nearby: "Nearby place",
  how_to_reach: "How to reach",
  good_to_know: "Good to know",
};
const FIELD: Record<string, string> = {
  name_en: "name in English",
  name_hi: "name in Hindi",
  minutes: "minutes",
  mode: "how to get there",
  kind: "kind of place",
  bearing: "direction",
  text_en: "English text",
  text_hi: "Hindi text",
  check_in: "Check-in time",
  check_out: "Check-out time",
  phone: "Phone",
  whatsapp: "WhatsApp number",
  email: "Email",
  address_en: "Address in English",
  address_hi: "Address in Hindi",
  lat: "Latitude",
  lng: "Longitude",
  amenities: "Amenities",
};

/** "nearby.1.name_en" -> "Nearby place 2, name in English". */
export function fieldName(field: string): string {
  const parts = field.split(".");
  const [head, second, third] = parts;
  if (head && SECTION[head]) {
    const n = second !== undefined && /^\d+$/.test(second) ? ` ${Number(second) + 1}` : "";
    const what = third ? `, ${FIELD[third] ?? third}` : "";
    return `${SECTION[head]}${n}${what}`;
  }
  const last = parts[parts.length - 1] ?? field;
  if (head === "geo" && !third && second === undefined) return "Map position";
  return FIELD[last] ?? (field || "This form");
}

/** One Pydantic problem in plain words. */
export function plainProblem(field: string, problem: string): string {
  let m: RegExpExecArray | null;
  if ((m = /at most (\d+) characters?/.exec(problem))) return `Use ${m[1]} letters or fewer.`;
  if (/at least 1 character/.test(problem)) return "This cannot be empty.";
  if ((m = /at most (\d+) items?/.exec(problem))) return `Up to ${m[1]} only.`;
  if ((m = /greater than or equal to (-?[\d.]+)/.exec(problem))) return `Use ${m[1]} or more.`;
  if ((m = /less than or equal to (-?[\d.]+)/.exec(problem))) return `Use ${m[1]} or less.`;
  if (/should match pattern/.test(problem)) {
    if (field.endsWith("email")) return "Use an email like name@example.com.";
    if (field === "check_in" || field === "check_out") return "Use a 24-hour time like 12:00.";
    return "This is not in the right form.";
  }
  if ((m = /^Value error, (.+?)\.?$/.exec(problem))) return `${m[1]}.`;
  if (/valid integer/.test(problem)) return "Use a whole number.";
  if (/valid number/.test(problem)) return "Use a number.";
  if (/Input should be/.test(problem)) return "Pick one of the choices.";
  if (/Extra inputs/.test(problem)) return "This field is not allowed.";
  if (/Field required/.test(problem)) return "This is needed.";
  return "This is not valid.";
}

/** The API's 422 details as {field: plain message}. */
export function apiProblems(details: readonly FieldProblem[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of details) {
    if (!out[d.field]) out[d.field] = plainProblem(d.field, d.problem);
  }
  return out;
}

/** Every error as one plain line each ("Nearby place 2, name in English: Use 60 letters or fewer."). */
export function errorLines(errors: Record<string, string>): string[] {
  return Object.entries(errors).map(([field, msg]) => `${fieldName(field)}: ${msg}`);
}

/* ---------- printed cards ---------- */

/** Which scan source each printed card's QR carries. */
export const CARD_SOURCE: Record<CardKind, ScanCard> = { wallet: "wallet", room: "room", tent: "desk" };

/** Card sizes in mm (trim, no bleed) and the smallest QR each must print. */
export const CARD_SPECS: Record<
  CardKind,
  { title: string; size: string; w: number; h: number; qrMm: number }
> = {
  wallet: { title: "Wallet card", size: "85.6 x 54 mm (CR80)", w: 85.6, h: 54, qrMm: 18 },
  room: { title: "In-room card", size: "A6, 105 x 148 mm", w: 105, h: 148, qrMm: 25 },
  tent: { title: "Desk tent card", size: "A5, 148 x 210 mm", w: 148, h: 210, qrMm: 40 },
};

/** The address a card's QR opens: the site with ?src=card-<wallet|room|desk>. */
export function cardUrl(siteUrl: string, card: ScanCard): string {
  try {
    const url = new URL(siteUrl);
    url.searchParams.set("src", `card-${card}`);
    return url.toString();
  } catch {
    const sep = siteUrl.includes("?") ? "&" : "?";
    return `${siteUrl}${sep}src=card-${card}`;
  }
}

/** Owner download links (through the /api proxy). */
export function cardsPdfHref(kind: CardKind | "all"): string {
  return `/api/site/cards.pdf?kind=${kind}`;
}
export function qrHref(card: ScanCard, format: "svg" | "png"): string {
  return `/api/site/cards/qr.${format}?card=${card}`;
}

/* ---------- card scans ---------- */

export const SCAN_LABELS: Record<ScanCard, string> = {
  wallet: "Wallet card",
  room: "In-room card",
  desk: "Desk tent card",
};

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

/** "2026-10" -> "October 2026". */
export function monthName(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  const name = m ? MONTHS[Number(m[2]) - 1] : undefined;
  return m && name ? `${name} ${m[1]}` : month;
}

/** "2026-10-03" -> "3 Oct". */
export function dayName(day: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(day);
  const name = m ? MONTHS[Number(m[1]) - 1] : undefined;
  return m && name ? `${Number(m[2])} ${name.slice(0, 3)}` : day;
}

/** Each day's total and its bar width (percent of the busiest day), days with scans only. */
export function scanBars(days: readonly ScanDay[]): { day: string; total: number; percent: number }[] {
  const rows = days
    .map((d) => ({ day: d.day, total: d.wallet + d.room + d.desk }))
    .filter((r) => r.total > 0);
  const max = Math.max(1, ...rows.map((r) => r.total));
  return rows.map((r) => ({ ...r, percent: Math.max(4, Math.round((r.total / max) * 100)) }));
}

/**
 * SVG path data for a QR symbol of `size` modules with a 4-module quiet zone
 * (viewBox 0 0 size+8 size+8): one 1x1 square per dark module, merged along rows.
 */
export function qrPathData(size: number, dark: (row: number, col: number) => boolean): string {
  const parts: string[] = [];
  for (let r = 0; r < size; r++) {
    let c = 0;
    while (c < size) {
      if (!dark(r, c)) {
        c++;
        continue;
      }
      const start = c;
      while (c < size && dark(r, c)) c++;
      parts.push(`M${start + 4} ${r + 4}h${c - start}v1h-${c - start}z`);
    }
  }
  return parts.join("");
}
