# V2-GLOBE report: location globe and local map

Helper V2-GLOBE, branch hsv2-globe, 13 October 2026. Nothing committed (the lead commits).

## Files

| File | What |
| --- | --- |
| `apps/web/lib/types-site-v2.ts` | `NearbyPlace`, `NearbyKind`, `NearbyMode`, `Geo`, `LocationProps` (match `app/services/site_details.py`) |
| `apps/web/lib/siteGlobe.ts` | Pure globe logic: start and end views, ease, view interpolation, d3 rotation and scale, marker visibility, DPR cap, accessible name, `GLOBE_BOX` |
| `apps/web/lib/siteGlobe.test.ts` | 7 node tests |
| `apps/web/lib/localMap.ts` | Pure local map logic: distance scale, bearing to x/y, label placement with collision avoidance, minutes text EN/HI, name fallback, icons per kind, copy, Open in Maps URL |
| `apps/web/lib/localMap.test.ts` | 15 node tests |
| `apps/web/components/site/v2/LocationGlobe.tsx` | Land-only canvas globe |
| `apps/web/components/site/v2/LocalMap.tsx` | SVG local map, place list, Open in Maps link |

`lib/globe.ts` already exists (the website's three.js globe), so the hotel globe logic lives in
`lib/siteGlobe.ts` to avoid mixing the two.

## Component API

Both are client components with a **default export** and the same props:

```ts
type LocationProps = {
  geo: { lat: number; lng: number } | null;
  nearby: NearbyPlace[];
  hotel: string;
  lang: "en" | "hi";
};
```

Lazy loading, from a client component:

```tsx
import dynamic from "next/dynamic";
import { GLOBE_BOX } from "@/lib/siteGlobe";

const LocationGlobe = dynamic(() => import("@/components/site/v2/LocationGlobe"), {
  ssr: false,
  loading: () => <div style={GLOBE_BOX} aria-hidden="true" />, // same box, so CLS stays 0
});
const LocalMap = dynamic(() => import("@/components/site/v2/LocalMap")); // SSR-safe, no browser APIs
```

Note for V2-PAGE: `ssr: false` is only allowed in client components, and code splitting from a
Server Component is not supported (Next docs, `01-app/02-guides/lazy-loading.md`), so put the
`dynamic()` calls in a small client wrapper. Only render the globe when `geo` is not null (it
returns null otherwise; the caller may show its own note).

### LocationGlobe

- Canvas, orthographic projection (`geoOrthographic`, `geoPath` from d3-geo), world-atlas
  `land-110m` `land` object only: no country borders, no graticule. Ocean stone #E6E0D4, land pine
  #1F4D3A, marker ink #1D1D1F with a cream ring, cream box. No gold.
- The land topology is a dynamic `import("world-atlas/land-110m.json")`, its own chunk, fetched
  only when the globe is 35 % in view (IntersectionObserver). Then it eases once over 1.8 s from a
  wide view (70 degrees west of the hotel, latitude x 0.35, zoom 1) to centred on the hotel at
  zoom 2.4 (ease-in-out cubic, longitude the short way round, zoom geometric).
- `prefers-reduced-motion: reduce`: no ease; it draws centred on the hotel at once (verified in
  the browser with Playwright `reducedMotion: "reduce"`: the frame 600 ms after scroll is already
  the final centred view).
- If the land chunk fails (offline), it shows the plain disc and the marker, centred.
- Fixed box: `aspect-ratio: 1 / 1`, `width: 100%`, `max-width: 440px`, round. Canvas DPR capped at 2;
  ResizeObserver redraws on resize.
- Accessible: the box is `role="img"` with `aria-label` "Map: where Hotel Deodar View is on the
  globe" (Hindi: "नक्शा: ग्लोब पर Hotel Deodar View की जगह"). Only the hotel name is used, no
  place names. The `nearby` prop is accepted for a shared signature and not used by the globe.

### LocalMap

- SVG, viewBox 360 x 300, `width: 100%`, `max-width: 560px`, `aspect-ratio` set, so no shift.
  No tiles, no key, nothing fetched.
- Hotel (ink dot and name) at the centre; each place is a pine dot with a cream glyph for its kind
  (9 kinds), in its bearing direction (0 = north, clockwise; a small N arrow, "उ" in Hindi). Lines
  from the hotel: dashed = walk, solid = drive; caption "Not to scale. Dashed line: walk. Solid
  line: drive." (Hindi too).
- Label: name (Hindi falls back to English; cut at 20 characters with "…" on the map only) and
  "5 min walk" / "10 min drive" or "5 मिनट पैदल" / "10 मिनट ड्राइव". Labels carry a cream halo so
  lines under them stay readable; a thin leader line is drawn when a label had to move away from
  its point.
- Accessible: the SVG is `role="img"` with "Local map: Hotel Deodar View at the centre and 4 nearby
  places, listed below"; the `<ul>` under it lists every place with its full name and time (the
  accessible version). "Open in Maps" is a plain link to
  `https://www.google.com/maps/search/?api=1&query=<lat>,<lng>` (new tab, `rel="noopener
  noreferrer"`, 44 px tall), shown only when `geo` is set. Empty `nearby` renders nothing.

## Distance scale (lib/localMap.ts)

1. Minutes to rough kilometres: walk 5 km/h (1 min = 0.08 km), drive 24 km/h on hill roads
   (1 min = 0.4 km). So 10 min walk = 0.8 km and 10 min drive = 4 km.
2. Radius = R_MIN + (R_MAX - R_MIN) x sqrt(km / farthest), R_MIN 46, R_MAX 118 (viewBox units),
   `farthest` = the farthest place on this map, at least 2 km (one short walk alone does not go to
   the outer ring). The square root keeps close places off the hotel when one place is far away.

## Label collision avoidance (lib/localMap.ts `placeLabels`)

Greedy, most crowded first (points nearest the centre). Each label tries candidate boxes (beside its
point on the side facing away from the centre, the other side, above, below, then a 3-unit grid
over the whole map) and takes the free one nearest its ideal spot. Free = inside the map with a
6-unit margin, not touching any placed label, the hotel name, the hotel dot, the north arrow or any
place dot. If nothing is free, dots stop counting; the last resort is the clamped ideal box.
Tests: the sample places (EN and HI) sit beside their own points with no overlaps and no covered
dots; three crowded sets of 8 places (same direction with long English and Hindi names, all round
at 600 min, all near north) with a 43-character hotel name never overlap each other, the hotel name
or the north arrow and never leave the map. Because the viewBox scales with the box, "inside the
viewBox" means no overflow at 390 px; Playwright measured `scrollWidth` 390 at 390 px and 1440 at
1440 px.

## JS size (method and numbers)

Method: a throwaway client page (deleted afterwards) loaded both components with `next/dynamic`
behind a button, below a 900 px spacer. Production build (`npx next build`, Turbopack) served with
`next start`. Playwright recorded every script request: requests after page load and before the
click were the baseline; requests after the click are the components' chunks; requests after
scrolling the globe into view are the land chunk. Sizes are the files in `.next/static/chunks`,
gzip measured with Node `zlib.gzipSync` level 9.

| Chunk | When | Raw | Gzip |
| --- | --- | --- | --- |
| LocationGlobe component | on render | 3,329 B | 1,851 B |
| d3-geo (orthographic, path, clip, rotation) + topojson-client `feature` | on render | 22,721 B | 8,661 B |
| LocalMap component + lib/localMap | on render | 7,279 B | 3,405 B |
| world-atlas land-110m topology | when the globe is in view | 55,362 B | 20,895 B |
| **Globe total** (component + d3/topojson + land) | | **81,412 B (79.5 KB)** | **31,407 B (30.7 KB)** |
| **Both components total** | | **88,691 B (86.6 KB)** | **34,812 B (34.0 KB)** |

Target was under 300 KB extra JS: the globe is 79.5 KB raw, 30.7 KB gzip. Nothing loads on first
paint unless the caller renders the components; the land data loads only on scroll.

## Screenshots (light, checked by eye, not committed)

390 px and 1440 px, EN and HI, plus a crowded 8-place map and a mid-ease globe frame. Findings
fixed during the pass: labels touching their own dot (gap raised, own dot now an obstacle), a label
over the north arrow (arrow is now an obstacle), lines crossing labels (cream halo). Known limit:
with 8 places inside about 30 degrees and every name 20 characters long, one label can end up over
the dot cluster (the no-dots fallback); it never overlaps another label or leaves the map.

## Checks (real output, from apps/web)

```
npx next typegen > /dev/null && npx tsc --noEmit        -> TSC_OK
npx eslint . --max-warnings=0                           -> ESLINT_OK
npx prettier --check . --log-level warn                 -> PRETTIER_OK
node --test lib/*.test.ts                               -> tests 227, pass 227, fail 0
node scripts/audit-check.mjs                            -> npm audit gate passed: production 0 high/critical; dev 5 high (allowlisted, reviewed).
npx next build                                          -> build completed (route table printed)
```

`git status` at the end shows only the seven new files above and this report (plus the
pre-existing untracked `apps/api/.venv`). The scratch route was removed before the final checks.
