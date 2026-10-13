/**
 * Pure helpers for the hotel site's local map (components/site/v2/LocalMap.tsx).
 *
 * The map is a drawing, not a survey: the hotel sits at the centre, each
 * nearby place sits in its compass direction (bearing, 0 = north, clockwise)
 * at a radius that grows with how far the owner says it is.
 *
 * Distance scale: minutes become rough kilometres first, so a walk counts for
 * less ground than a drive of the same length.
 *   walk:  5 km/h  -> 1 minute = 0.08 km
 *   drive: 24 km/h (hill roads) -> 1 minute = 0.4 km
 * The radius is then R_MIN + (R_MAX - R_MIN) * sqrt(km / farthest), where
 * `farthest` is the farthest place on this map (never less than 2 km, so one
 * short walk does not land on the outer ring). The square root keeps close
 * places apart from the hotel when one place is much farther than the rest.
 */
import type { Geo, NearbyKind, NearbyMode, NearbyPlace } from "./types-site-v2.ts";

export type Lang = "en" | "hi";

/** SVG viewBox. The map scales to its box; 360 wide reads well at 390 px phones. */
export const MAP_W = 360;
export const MAP_H = 300;
export const CX = MAP_W / 2;
export const CY = MAP_H / 2;
export const R_MIN = 46;
export const R_MAX = 118;
/** Labels keep this far from the viewBox edges. */
export const PAD = 6;

export const KM_PER_MIN: Record<NearbyMode, number> = { walk: 0.08, drive: 0.4 };
export const MIN_FARTHEST_KM = 2;

/** Label type sizes in viewBox units. */
export const NAME_SIZE = 12.5;
export const TIME_SIZE = 11;
export const LABEL_H = 30;
/** Longest name drawn on the map; the list below always has the full name. */
export const MAX_NAME_CHARS = 20;

export function roughKm(minutes: number, mode: NearbyMode): number {
  return Math.max(0, minutes) * KM_PER_MIN[mode];
}

/** Radius on the map for each place, in input order. */
export function radii(places: readonly Pick<NearbyPlace, "minutes" | "mode">[]): number[] {
  const kms = places.map((p) => roughKm(p.minutes, p.mode));
  const farthest = Math.max(MIN_FARTHEST_KM, ...kms);
  return kms.map((km) => R_MIN + (R_MAX - R_MIN) * Math.sqrt(Math.min(km, farthest) / farthest));
}

/** Point for a bearing (degrees, 0 = north, clockwise) at radius r around (cx, cy). */
export function polar(bearing: number, r: number, cx = CX, cy = CY): { x: number; y: number } {
  const a = (((bearing % 360) + 360) % 360) * (Math.PI / 180);
  return { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) };
}

/** "5 min walk" / "10 min drive"; Hindi "5 मिनट पैदल" / "10 मिनट ड्राइव". */
export function minutesText(minutes: number, mode: NearbyMode, lang: Lang): string {
  if (lang === "hi") return `${minutes} मिनट ${mode === "walk" ? "पैदल" : "ड्राइव"}`;
  return `${minutes} min ${mode}`;
}

/** The place name in the chosen language; Hindi falls back to English. */
export function placeName(p: Pick<NearbyPlace, "name_en" | "name_hi">, lang: Lang): string {
  return lang === "hi" && p.name_hi.trim() ? p.name_hi.trim() : p.name_en.trim();
}

/** Cut a long name for the map with a single ellipsis character. */
export function shortName(name: string, max = MAX_NAME_CHARS): string {
  const chars = Array.from(name);
  return chars.length <= max ? name : `${chars.slice(0, max - 1).join("")}…`;
}

// Devanagari vowel signs and other combining marks take no width of their own.
const COMBINING = /[̀-ͯऀ-ःऺ-ॏ॑-ॗॢॣ]/u;

/** A generous width estimate for one line of text, in viewBox units. */
export function textWidth(text: string, size: number): number {
  let n = 0;
  for (const ch of text) {
    if (COMBINING.test(ch)) continue;
    n += ch === " " ? 0.3 : /[ऀ-ॿ]/u.test(ch) ? 0.62 : 0.56;
  }
  return n * size;
}

export type Box = { x: number; y: number; w: number; h: number };

export function overlaps(a: Box, b: Box, gap = 2): boolean {
  return a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
}

export function inBounds(b: Box, w = MAP_W, h = MAP_H, pad = PAD): boolean {
  return b.x >= pad - 1e-6 && b.y >= pad - 1e-6 && b.x + b.w <= w - pad + 1e-6 && b.y + b.h <= h - pad + 1e-6;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), Math.max(lo, hi));
}

export type PlacedLabel = Box & {
  /** Point the label belongs to. */
  px: number;
  py: number;
  /** True when the label had to move away from its point; draw a leader line. */
  moved: boolean;
};

const GAP = 15;
/** Half size of a place dot, used to keep labels off other places. */
export const DOT_R = 12;

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Put one label box beside each point without overlaps and inside the map.
 *
 * Greedy search, most crowded first (points nearest the centre): every label
 * tries a set of candidate boxes (beside its point on either side, above,
 * below, and as a last resort anywhere on a 3-unit grid) and takes the free
 * one closest to where it would ideally sit, the side facing away from the
 * centre. A candidate is free when it stays inside the map and touches no
 * placed label, no fixed obstacle (the hotel name and dot) and no place
 * dot, its own included. If nothing is free, dots stop counting as obstacles; if still
 * nothing, the label keeps its clamped ideal box (only possible with far more
 * text than eight places can carry).
 */
export function placeLabels(
  items: readonly { x: number; y: number; w: number; h: number }[],
  obstacles: readonly Box[] = [],
  w = MAP_W,
  h = MAP_H,
): PlacedLabel[] {
  const dots: Box[] = items.map((it) => ({ x: it.x - DOT_R, y: it.y - DOT_R, w: 2 * DOT_R, h: 2 * DOT_R }));
  const out: PlacedLabel[] = new Array(items.length);
  const placed: Box[] = [];
  const order = items
    .map((_, i) => i)
    .sort((a, b) => {
      const da = dist(items[a]!, { x: w / 2, y: h / 2 });
      const db = dist(items[b]!, { x: w / 2, y: h / 2 });
      return da - db || a - b;
    });

  for (const i of order) {
    const it = items[i]!;
    const bw = Math.min(it.w, w - 2 * PAD);
    const bh = Math.min(it.h, h - 2 * PAD);
    const ideal = (it.x >= w / 2 ? 1 : -1) as 1 | -1;
    const right = { x: it.x + GAP, y: it.y - bh / 2 };
    const left = { x: it.x - GAP - bw, y: it.y - bh / 2 };
    const want = ideal === 1 ? right : left;
    const other = ideal === 1 ? left : right;
    // Distance from the ideal spot; the far side costs a little extra.
    const cost = (c: { x: number; y: number }) => Math.min(dist(c, want), dist(c, other) + 12);

    const cands: { x: number; y: number }[] = [];
    const xs = [want.x, other.x, it.x - bw / 2, PAD, w - PAD - bw, w / 2 - bw / 2];
    const ys = [it.y - bh / 2, it.y + GAP, it.y - GAP - bh];
    for (const x of xs) for (const y of ys) cands.push({ x, y });
    for (let y = PAD; y <= h - PAD - bh; y += 3) for (const x of xs) cands.push({ x, y });
    for (let y = PAD; y <= h - PAD - bh; y += 3)
      for (let x = PAD; x <= w - PAD - bw; x += 3) cands.push({ x, y });

    const free = (c: { x: number; y: number }, withDots: boolean) => {
      const box = { x: c.x, y: c.y, w: bw, h: bh };
      if (!inBounds(box, w, h)) return false;
      if (placed.some((p) => overlaps(box, p))) return false;
      if (obstacles.some((o) => overlaps(box, o))) return false;
      if (withDots && dots.some((d) => overlaps(box, d, 0))) return false;
      return true;
    };
    const pick = (withDots: boolean) => {
      let best: { x: number; y: number } | null = null;
      let bestCost = Infinity;
      for (const c of cands) {
        const k = cost(c);
        if (k < bestCost && free(c, withDots)) {
          best = c;
          bestCost = k;
        }
      }
      return best;
    };
    const chosen = pick(true) ??
      pick(false) ?? {
        x: clamp(want.x, PAD, w - PAD - bw),
        y: clamp(want.y, PAD, h - PAD - bh),
      };
    const box = { x: chosen.x, y: chosen.y, w: bw, h: bh };
    placed.push(box);
    out[i] = { ...box, px: it.x, py: it.y, moved: Math.min(dist(chosen, want), dist(chosen, other)) > 4 };
  }
  return out;
}

export type MapPlace = {
  place: NearbyPlace;
  name: string;
  shortName: string;
  time: string;
  x: number;
  y: number;
  label: PlacedLabel;
};

/** The north arrow in the top right corner (an obstacle for place labels). */
export const NORTH_X = MAP_W - 18;
export const NORTH_BOX: Box = { x: NORTH_X - 9, y: PAD, w: 18, h: 28 };

/** The hotel name box under the centre point (an obstacle for place labels). */
export function hotelBox(hotel: string): Box & { text: string } {
  const text = shortName(hotel, 24);
  const bw = Math.min(textWidth(text, NAME_SIZE) + 4, MAP_W - 2 * PAD);
  return { text, x: CX - bw / 2, y: CY + 10, w: bw, h: NAME_SIZE + 4 };
}

/** Everything the local map draws, in input order. */
export function layoutMap(nearby: readonly NearbyPlace[], hotel: string, lang: Lang): MapPlace[] {
  const rs = radii(nearby);
  const pts = nearby.map((p, i) => polar(p.bearing, rs[i]!));
  const texts = nearby.map((p) => {
    const name = placeName(p, lang);
    return { name, short: shortName(name), time: minutesText(p.minutes, p.mode, lang) };
  });
  const items = pts.map((pt, i) => {
    const t = texts[i]!;
    const w = Math.max(textWidth(t.short, NAME_SIZE), textWidth(t.time, TIME_SIZE)) + 2;
    return { x: pt.x, y: pt.y, w, h: LABEL_H };
  });
  const hb = hotelBox(hotel);
  const centreDot: Box = { x: CX - 8, y: CY - 8, w: 16, h: 16 };
  const labels = placeLabels(items, [hb, centreDot, NORTH_BOX]);
  return nearby.map((place, i) => ({
    place,
    name: texts[i]!.name,
    shortName: texts[i]!.short,
    time: texts[i]!.time,
    x: pts[i]!.x,
    y: pts[i]!.y,
    label: labels[i]!,
  }));
}

/** Rings drawn behind the places (purely decorative). */
export const RINGS = [R_MIN, (R_MIN + R_MAX) / 2, R_MAX];

/** Plain "Open in Maps" link: a public search URL, no key, nothing loaded. */
export function mapsUrl(geo: Geo): string {
  return `https://www.google.com/maps/search/?api=1&query=${geo.lat.toFixed(5)},${geo.lng.toFixed(5)}`;
}

/** Small 12 x 12 glyphs per kind, drawn in white on a pine dot. `fill` glyphs are solid. */
export const KIND_ICON: Record<NearbyKind, { d: string; fill: boolean }> = {
  viewpoint: { d: "M1 10.5 L4.5 4 L7 8 L8.5 6 L11 10.5 Z", fill: true },
  temple: { d: "M6 1 L8.5 5 V11 H3.5 V5 Z M2 11 H10", fill: false },
  market: { d: "M2.5 4.5 H9.5 L9 11 H3 Z M4.5 4.5 V3.5 A1.5 1.5 0 0 1 7.5 3.5 V4.5", fill: false },
  waterfall: { d: "M3 1 V8 M6 1 V9 M9 1 V8 M2 11 Q4 9.5 6 11 Q8 12.5 10 11", fill: false },
  trek: { d: "M1.5 10.5 L4.5 6 L7 8.5 L10.5 2.5", fill: false },
  lake: { d: "M1 5 Q3 3.5 5 5 T9 5 T11 5 M1 8.5 Q3 7 5 8.5 T9 8.5 T11 8.5", fill: false },
  station: { d: "M3 1.5 H9 V9 H3 Z M3 5.5 H9 M4.5 9 L3.5 11 M7.5 9 L8.5 11", fill: false },
  airport: { d: "M6 1 V11 M1.5 6.5 L6 4.5 L10.5 6.5 M4 10.5 L6 9.5 L8 10.5", fill: false },
  other: { d: "M6 3.5 A2.5 2.5 0 1 1 6 8.5 A2.5 2.5 0 1 1 6 3.5 Z", fill: true },
};

export const MAP_COPY: Record<
  Lang,
  { mapLabel: (hotel: string, n: number) => string; note: string; open: string; north: string }
> = {
  en: {
    mapLabel: (hotel, n) =>
      `Local map: ${hotel} at the centre and ${n} nearby ${n === 1 ? "place" : "places"}, listed below`,
    note: "Not to scale. Dashed line: walk. Solid line: drive.",
    open: "Open in Maps",
    north: "N",
  },
  hi: {
    mapLabel: (hotel, n) => `आसपास का नक्शा: बीच में ${hotel} और पास की ${n} जगहें, सूची नीचे है`,
    note: "पैमाने पर नहीं। बिंदुदार रेखा: पैदल। सीधी रेखा: ड्राइव।",
    open: "मैप्स में खोलें",
    north: "उ",
  },
};
