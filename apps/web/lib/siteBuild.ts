/**
 * Pure helpers for the owner's site build (photos, words, rooms, generated text). No React,
 * no "@/" imports, so node --test can run them directly.
 */

export const MIN_PHOTOS = 4;
export const MAX_PHOTOS = 8;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const PHOTO_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];
/** What the file picker offers (iPhones label HEIC files inconsistently, so the extension too). */
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,.heic";
export const MAX_DESCRIPTION_CHARS = 2000;
export const MIN_ROOMS = 1;
export const MAX_ROOMS = 10;

/** Field limits, the same numbers the API checks (app/services/site_gen.py, routers/site_build.py). */
export const LIMITS = {
  description: 1200,
  point: 120,
  google: 750,
  blurb: 300,
  captionWords: 8,
  captionChars: 120,
  roomNameMin: 2,
  roomNameMax: 60,
} as const;
/** The API takes a nightly price of 1 to 10,000,000 paise, so at most 1,00,000 rupees. */
export const MAX_ROOM_RUPEES = 1_00_000;

/** Why a picked file cannot be uploaded, or null when it can. Mirrors the API's checks. */
export function photoFileError(file: { name: string; type: string; size: number }): string | null {
  const heic = /\.(heic|heif)$/.test(file.name.toLowerCase());
  if (!PHOTO_TYPES.includes(file.type) && !heic) {
    return `${file.name}: use a JPEG, PNG, WebP or HEIC photo.`;
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return `${file.name} is larger than 10 MB. Pick a smaller photo.`;
  }
  if (file.size === 0) return `${file.name} is empty.`;
  return null;
}

/**
 * Rupees typed by the owner ("4,500", "4500.50") to integer paise, or null
 * when it is not a price. Integer maths only: no floating point on money.
 */
export function rupeesToPaise(text: string): number | null {
  const clean = text.trim().replace(/^₹\s*/, "").replace(/,/g, "");
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(clean);
  if (!match) return null;
  const rupees = Number(match[1]);
  const paise = Number((match[2] ?? "").padEnd(2, "0") || "0");
  const total = rupees * 100 + paise;
  return total > 0 && total <= MAX_ROOM_RUPEES * 100 ? total : null;
}

/** Integer paise back to plain rupee text for an input box (no grouping, no symbol). */
export function paiseToRupeeText(paise: number): string {
  if (!Number.isInteger(paise) || paise <= 0) return "";
  const rupees = Math.floor(paise / 100);
  const rest = paise % 100;
  return rest ? `${rupees}.${String(rest).padStart(2, "0")}` : String(rupees);
}

/** Why a room row is not ready, or null. */
export function roomRowError(name: string, price: string): string | null {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) return "Add the room name.";
  if (clean.length < LIMITS.roomNameMin) return "Use at least 2 letters for the room name.";
  if (clean.length > LIMITS.roomNameMax) return "Keep the room name to 60 letters or fewer.";
  if (rupeesToPaise(price) === null) {
    return "Type the price for one night in rupees, for example 4500 (up to 1,00,000).";
  }
  return null;
}

/** Why the room list cannot be saved, or null: 1 to 10 rows, each ready, no name twice. */
export function roomsError(rows: readonly { name: string; price: string }[]): string | null {
  if (rows.length < MIN_ROOMS) return "Add at least one room type.";
  if (rows.length > MAX_ROOMS) return "Up to 10 room types.";
  const seen = new Set<string>();
  for (const [i, row] of rows.entries()) {
    const err = roomRowError(row.name, row.price);
    if (err) return `Room ${i + 1}: ${err}`;
    const key = row.name.trim().replace(/\s+/g, " ").toLowerCase();
    if (seen.has(key)) return `Room ${i + 1}: each room type needs its own name.`;
    seen.add(key);
  }
  return null;
}

/** Why a photo caption is too long, or null. At most 8 words and 120 letters. */
export function captionError(text: string): string | null {
  if (wordCount(text) > LIMITS.captionWords) return "Keep captions to 8 words or fewer.";
  if (text.length > LIMITS.captionChars) return "Keep captions to 120 letters or fewer.";
  return null;
}

/** Why a "why book direct" point cannot be saved, or null. */
export function pointError(text: string): string | null {
  if (!text.trim()) return "Each point needs a few words.";
  if (text.length > LIMITS.point) return "Keep each point to 120 letters or fewer.";
  return null;
}

/** Words in a piece of text (Latin or Devanagari). */
export function wordCount(text: string): number {
  const words = text.trim().split(/\s+/);
  return words[0] === "" ? 0 : words.length;
}

/** A copy of the list with one item moved; out of range moves return the same order. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (from < 0 || from >= next.length || to < 0 || to >= next.length || from === to) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

const FIELD_LABELS: Readonly<Record<string, string>> = {
  description: "Description",
  why_book_direct: "Why book direct",
  google_description: "Google description",
};
const LANG_LABELS: Readonly<Record<string, string>> = { en: "English", hi: "Hindi" };

/**
 * Plain names for the fields the API wrote from the owner's own words. The
 * API names them "description_hi", "rooms.0.blurb_en", "photos.12.caption_hi"
 * or "photo_order". Unknown names are skipped; each label appears once.
 */
export function fallbackLabels(fields: readonly string[]): string[] {
  const out: string[] = [];
  const add = (label: string) => {
    if (!out.includes(label)) out.push(label);
  };
  for (const field of fields) {
    if (field === "photo_order") add("Photo order");
    else if (/^rooms\.\d+\.blurb_(en|hi)$/.test(field)) add("Room descriptions");
    else if (/^photos\.\d+\.caption_(en|hi)$/.test(field)) add("Photo captions");
    else {
      const match = /^(description|why_book_direct|google_description)_(en|hi)$/.exec(field);
      if (match) add(`${FIELD_LABELS[match[1]!]} (${LANG_LABELS[match[2]!]})`);
    }
  }
  return out;
}
