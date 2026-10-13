/**
 * Pure helpers for the hotel site's land-only globe
 * (components/site/v2/LocationGlobe.tsx). The website's 3D globe keeps its own
 * helpers in lib/globe.ts; this one is a flat orthographic drawing.
 *
 * A view is the point at the centre of the disc plus a zoom factor. The globe
 * eases once from START (a wide view west of the hotel) to END (centred on
 * the hotel, zoomed in) when it scrolls into view.
 */
import type { Geo } from "./types-site-v2.ts";

export type View = { lng: number; lat: number; k: number };

/** Ease length in milliseconds. */
export const EASE_MS = 1800;
/** Zoom at the end: the disc is this many times the box, so the hotel's region fills it. */
export const END_ZOOM = 2.4;
/** Start: the whole Earth, 70 degrees west of the hotel and nearer the equator. */
export const START_OFFSET_LNG = -70;
export const START_LAT_FACTOR = 0.35;
/** Disc radius as a share of half the box at zoom 1 (leaves a thin margin). */
export const DISC_SHARE = 0.94;

/**
 * The globe's box. A caller's next/dynamic `loading` placeholder should use the
 * same style, so the space is reserved before the chunk arrives (CLS 0).
 */
export const GLOBE_BOX = {
  position: "relative",
  width: "100%",
  maxWidth: 440,
  aspectRatio: "1 / 1",
  marginInline: "auto",
  borderRadius: "50%",
  overflow: "hidden",
  background: "#F5F1E8",
} as const;

export const GLOBE_COLOURS = {
  ocean: "#E6E0D4",
  land: "#1F4D3A",
  marker: "#1D1D1F",
  ring: "#F5F1E8",
} as const;

function wrapLng(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

/** Signed shortest turn from a to b in degrees, in [-180, 180). */
export function lngDelta(a: number, b: number): number {
  return wrapLng(b - a);
}

export function startView(geo: Geo): View {
  return { lng: wrapLng(geo.lng + START_OFFSET_LNG), lat: geo.lat * START_LAT_FACTOR, k: 1 };
}

export function endView(geo: Geo): View {
  return { lng: wrapLng(geo.lng), lat: geo.lat, k: END_ZOOM };
}

/** Smooth start and stop. */
export function easeInOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** View at linear progress t in [0, 1]: rotation the short way round, zoom geometric. */
export function viewAt(t: number, from: View, to: View): View {
  const e = easeInOutCubic(t);
  return {
    lng: wrapLng(from.lng + lngDelta(from.lng, to.lng) * e),
    lat: from.lat + (to.lat - from.lat) * e,
    k: from.k * Math.pow(to.k / from.k, e),
  };
}

/** d3-geo rotation that puts the view's centre in the middle of the disc. */
export function rotationFor(v: View): [number, number, number] {
  return [-v.lng, -v.lat, 0];
}

/** Orthographic scale (disc radius in px) for a square box of `size` px. */
export function scaleFor(v: View, size: number): number {
  return (size / 2) * DISC_SHARE * v.k;
}

/** Great-circle angle in degrees between two points; under 90 means on the visible side. */
export function angularDistance(a: Geo, b: Geo): number {
  const r = Math.PI / 180;
  const c =
    Math.sin(a.lat * r) * Math.sin(b.lat * r) +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lng - a.lng) * r);
  return Math.acos(Math.min(1, Math.max(-1, c))) / r;
}

export function markerVisible(v: View, geo: Geo): boolean {
  return angularDistance({ lat: v.lat, lng: v.lng }, geo) < 89;
}

export function cappedDpr(dpr: number | undefined): number {
  return dpr && dpr > 0 ? Math.min(dpr, 2) : 1;
}

/** Accessible name. Only the hotel name is used; no place names are invented. */
export function globeLabel(hotel: string, lang: "en" | "hi"): string {
  return lang === "hi" ? `नक्शा: ग्लोब पर ${hotel} की जगह` : `Map: where ${hotel} is on the globe`;
}
