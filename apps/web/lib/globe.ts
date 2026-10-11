/**
 * Data and pure helpers for the website globe (docs/WEBSITE_UPGRADE.md section 2).
 *
 * Seedha Pass and Event Radar are planned features shown with sample content
 * only. Coordinates are public town centres. Only the Winter Line Carnival has
 * dates (the same sample event as apps/api/app/services/calendar.py); every
 * other event shows "Dates to confirm". No rupee figures belong here.
 */

export type GlobeLayerKey = "pass" | "radar";

export type Town = { key: string; name: string; lat: number; lon: number };

export type GlobeMarker = {
  /** Stable id, also the data-marker value on list items and map markers. */
  id: string;
  layer: GlobeLayerKey;
  /** Marker title: the town for Seedha Pass, the event name for Event Radar. */
  name: string;
  town: string;
  lat: number;
  lon: number;
  /** "Planned town" for Seedha Pass; dates or "Dates to confirm" for events. */
  detail: string;
  /** Event Radar cards carry the "Sample" label. */
  sample: boolean;
};

export const PLANNED_TOWN = "Planned town";
export const DATES_TO_CONFIRM = "Dates to confirm";
export const SAMPLE = "Sample";

export const TOWNS = {
  mussoorie: { key: "mussoorie", name: "Mussoorie", lat: 30.4598, lon: 78.0644 },
  nainital: { key: "nainital", name: "Nainital", lat: 29.3919, lon: 79.4542 },
  rishikesh: { key: "rishikesh", name: "Rishikesh", lat: 30.0869, lon: 78.2676 },
  auli: { key: "auli", name: "Auli", lat: 30.5286, lon: 79.5662 },
  shimla: { key: "shimla", name: "Shimla", lat: 31.1048, lon: 77.1734 },
  manali: { key: "manali", name: "Manali", lat: 32.2432, lon: 77.1892 },
  kullu: { key: "kullu", name: "Kullu", lat: 31.9579, lon: 77.1095 },
} as const satisfies Record<string, Town>;

export type TownKey = keyof typeof TOWNS;

/** Seedha Pass planned towns, west to east along the hills. */
export const PASS_TOWNS: readonly TownKey[] = [
  "manali",
  "shimla",
  "mussoorie",
  "rishikesh",
  "auli",
  "nainital",
];

/** Soft arcs joining the planned towns into one loop. */
export const PASS_ARCS: ReadonlyArray<readonly [TownKey, TownKey]> = [
  ["manali", "shimla"],
  ["shimla", "mussoorie"],
  ["mussoorie", "rishikesh"],
  ["rishikesh", "nainital"],
  ["nainital", "auli"],
  ["auli", "mussoorie"],
];

/** Event Radar sample events. Only the Winter Line Carnival has repo dates. */
export const RADAR_EVENTS: ReadonlyArray<{ key: string; name: string; town: TownKey; dates: string | null }> =
  [
    { key: "winter-line-carnival", name: "Winter Line Carnival", town: "mussoorie", dates: "25 to 30 Dec" },
    {
      key: "international-yoga-festival",
      name: "International Yoga Festival",
      town: "rishikesh",
      dates: null,
    },
    { key: "nanda-devi-mela", name: "Nanda Devi Mela", town: "nainital", dates: null },
    { key: "kullu-dussehra", name: "Kullu Dussehra", town: "kullu", dates: null },
    { key: "shimla-summer-festival", name: "Shimla Summer Festival", town: "shimla", dates: null },
  ];

/** Every marker for one layer, in list order. */
export function markersFor(layer: GlobeLayerKey): GlobeMarker[] {
  if (layer === "pass") {
    return PASS_TOWNS.map((key) => {
      const t = TOWNS[key];
      return {
        id: `pass-${t.key}`,
        layer,
        name: t.name,
        town: t.name,
        lat: t.lat,
        lon: t.lon,
        detail: PLANNED_TOWN,
        sample: false,
      };
    });
  }
  return RADAR_EVENTS.map((e) => {
    const t = TOWNS[e.town];
    return {
      id: `radar-${e.key}`,
      layer,
      name: e.name,
      town: t.name,
      lat: t.lat,
      lon: t.lon,
      detail: e.dates ?? DATES_TO_CONFIRM,
      sample: true,
    };
  });
}

/** Arc end points for a layer (Event Radar has none). */
export function arcsFor(layer: GlobeLayerKey): Array<readonly [Town, Town]> {
  return layer === "pass" ? PASS_ARCS.map(([a, b]) => [TOWNS[a], TOWNS[b]] as const) : [];
}

/** One line of text for the accessible list. */
export function markerText(m: GlobeMarker): string {
  return m.layer === "pass" ? `${m.name}, ${m.detail}` : `${m.name}, ${m.town}, ${m.detail}, ${SAMPLE}`;
}

/* ---------- Geometry ---------- */

export type Vec3 = readonly [number, number, number];

const RAD = Math.PI / 180;

/**
 * Point on a sphere of radius r, matching three.js SphereGeometry UVs with an
 * equirectangular texture (u = (lon + 180) / 360, north up).
 */
export function latLonToVec3(lat: number, lon: number, r = 1): Vec3 {
  const phi = (lon + 180) * RAD;
  const cl = Math.cos(lat * RAD);
  return [-Math.cos(phi) * cl * r, Math.sin(lat * RAD) * r, Math.sin(phi) * cl * r];
}

/**
 * Rotations that bring (lat, lon) to face a camera on +Z: spin the globe about
 * Y by `y`, then tilt the parent about X by `x`.
 */
export function focusAngles(lat: number, lon: number): { x: number; y: number } {
  const [px, , pz] = latLonToVec3(0, lon);
  return { x: lat * RAD, y: -Math.atan2(px, pz) };
}

/** Apply the parent X tilt after the Y spin, as the globe scene does. */
export function rotateYX(p: Vec3, y: number, x: number): Vec3 {
  const [px, py, pz] = p;
  const x1 = px * Math.cos(y) + pz * Math.sin(y);
  const z1 = -px * Math.sin(y) + pz * Math.cos(y);
  return [x1, py * Math.cos(x) - z1 * Math.sin(x), py * Math.sin(x) + z1 * Math.cos(x)];
}

/**
 * Points along the great circle from a to b, lifted off the surface by a soft
 * sine bump of height `lift` (relative to radius 1). Includes both ends.
 */
export function arcPoints(a: Town, b: Town, segments = 32, lift = 0.02, r = 1): Vec3[] {
  const p = latLonToVec3(a.lat, a.lon);
  const q = latLonToVec3(b.lat, b.lon);
  const dot = Math.min(1, Math.max(-1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2]));
  const omega = Math.acos(dot);
  const out: Vec3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    let v: Vec3;
    if (omega < 1e-6) v = p;
    else {
      const s = Math.sin(omega);
      const wa = Math.sin((1 - t) * omega) / s;
      const wb = Math.sin(t * omega) / s;
      v = [p[0] * wa + q[0] * wb, p[1] * wa + q[1] * wb, p[2] * wa + q[2] * wb];
    }
    const h = r * (1 + lift * Math.sin(Math.PI * t));
    out.push([v[0] * h, v[1] * h, v[2] * h]);
  }
  return out;
}

/** Shortest signed angle from `from` to `to`, in (-PI, PI]. */
export function angleDelta(from: number, to: number): number {
  const d = (((to - from) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI);
  return d - Math.PI;
}

/* ---------- Motion ---------- */

/**
 * CSS cubic-bezier timing (x1, y1, x2, y2) evaluated at progress t. The site
 * curve is cubic-bezier(0.22, 1, 0.36, 1) (FRONTEND_MASTER section 2).
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const bx = (s: number) => 3 * x1 * s * (1 - s) ** 2 + 3 * x2 * s * s * (1 - s) + s ** 3;
  const by = (s: number) => 3 * y1 * s * (1 - s) ** 2 + 3 * y2 * s * s * (1 - s) + s ** 3;
  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (bx(mid) < t) lo = mid;
      else hi = mid;
    }
    return by((lo + hi) / 2);
  };
}

export const siteEase = cubicBezier(0.22, 1, 0.36, 1);

/* ---------- Fallback choice ---------- */

export type DeviceHints = {
  reducedMotion: boolean;
  webgl: boolean;
  /** navigator.hardwareConcurrency, when known. */
  cores?: number;
  /** navigator.deviceMemory in GB, when known (Chromium only). */
  memoryGb?: number;
  /** Smaller screen side in CSS pixels. */
  screenMin: number;
};

export type FallbackReason = "reduced-motion" | "no-webgl" | "low-end";

/** Why the static map shows instead of the 3D globe, or null for the globe. */
export function fallbackReason(h: DeviceHints): FallbackReason | null {
  if (h.reducedMotion) return "reduced-motion";
  if (!h.webgl) return "no-webgl";
  if (h.memoryGb !== undefined && h.memoryGb <= 2) return "low-end";
  if (h.cores !== undefined && h.cores <= 4 && h.screenMin < 500) return "low-end";
  return null;
}

/** Device pixel ratio for the renderer, capped at 2. */
export function cappedDpr(dpr: number | undefined): number {
  if (!dpr || !Number.isFinite(dpr) || dpr <= 0) return 1;
  return Math.min(dpr, 2);
}

/* ---------- Static map frame and palette ---------- */

/** North India frame for the static map: [west, south, east, north] degrees. */
export const NORTH_INDIA_BOUNDS = [72, 25, 85, 35.5] as const;

/** Where each town label sits on the static map: side of the dot, and a nudge down. */
export const LABEL_POS: Record<TownKey, { side: "left" | "right"; dy: number }> = {
  manali: { side: "left", dy: 0 },
  kullu: { side: "left", dy: 0 },
  shimla: { side: "left", dy: 0 },
  mussoorie: { side: "left", dy: -4 },
  rishikesh: { side: "left", dy: 14 },
  auli: { side: "right", dy: 0 },
  nainital: { side: "right", dy: 4 },
};

/** The town key behind a marker, for label placement. */
export function townKeyOf(m: GlobeMarker): TownKey {
  const hit = (Object.keys(TOWNS) as TownKey[]).find((k) => TOWNS[k].name === m.town);
  return hit ?? "mussoorie";
}

/** Globe colours per site theme, taken from the World A tokens. */
export const GLOBE_PALETTE = {
  dark: {
    ocean: "#121214",
    land: "#3a3a3c",
    rim: "#4cc38a",
    pass: "#4cc38a",
    radar: "#f2b54e",
    arc: "#4cc38a",
  },
  light: {
    ocean: "#eceef1",
    land: "#7c7c81",
    rim: "#1e6b4e",
    pass: "#1e6b4e",
    radar: "#e8a33d",
    arc: "#1e6b4e",
  },
} as const;

export type GlobeTheme = keyof typeof GLOBE_PALETTE;
