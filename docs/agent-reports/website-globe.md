# Website globe: report

## Files (all under apps/web)
- components/website/globe/WorldGlobe.tsx: public component (same exports: `GlobeLayer`, `WorldGlobeProps`, `WorldGlobe({ initialLayer, label })`). Toggle, viewport, marker list, mode choice, site theme.
- components/website/globe/GlobeCanvas.tsx: WebGL host (next/dynamic, ssr false). Creates a fresh canvas per mount.
- components/website/globe/scene.ts: three.js scene (globe shader, pine atmosphere, point markers, tube arcs, motion, dispose).
- components/website/globe/StaticMap.tsx: SVG fallback, d3-geo geoMercator fitted to North India.
- components/website/globe/land.ts: `world-atlas/land-110m.json` static import, `feature(topology, topology.objects.land)`.
- components/website/globe/globe.module.css: layout (container queries), toggle, list, map styles.
- lib/globe.ts + lib/globe.test.ts: towns, arcs, events, marker text, geometry, easing, fallback rule, DPR cap, palette (12 tests).

## Layers
- Seedha Pass: Manali, Shimla, Mussoorie, Rishikesh, Auli, Nainital, each "Planned town"; 6 arcs (Manali-Shimla, Shimla-Mussoorie, Mussoorie-Rishikesh, Rishikesh-Nainital, Nainital-Auli, Auli-Mussoorie). Pine markers.
- Event Radar (gold, every card says "Sample"): Winter Line Carnival, Mussoorie, 25 to 30 Dec (same as apps/api calendar.py and Sections.tsx); International Yoga Festival (Rishikesh), Nanda Devi Mela (Nainital), Kullu Dussehra (Kullu), Shimla Summer Festival (Shimla), all "Dates to confirm". No rupee figures.
- Toggle: two buttons with aria-pressed inside role=group "Map layer"; Tab, Enter/Space and Left/Right arrows work. An aria-live line announces "Showing Event Radar, 5 sample events."

## How it loads and falls back
- Nothing heavy loads up front. An IntersectionObserver (rootMargin 240px) on the viewport picks the mode once: `fallbackReason()` returns reduced-motion, no-webgl (test context, then released), or low-end (deviceMemory <= 2, or hardwareConcurrency <= 4 with a screen side under 500px). Globe mode imports GlobeCanvas (three) via next/dynamic; otherwise StaticMap.
- WebGL failure at creation or a lost context switches to the static map. Reduced motion turned on later also switches.
- Globe: sphere shader mixes ocean and graphite land from a canvas texture painted with d3 geoEquirectangular; fresnel rim plus a back-side pine atmosphere. Intro eases to North India over 2.6 s with cubic-bezier(0.22, 1, 0.36, 1), camera ends with the curved horizon above the Himalaya. Auto-rotate is a slow sway (about 9 degrees each way, 48 s period) so the markers stay in view; it stops on mouse hover or any pointer down and resumes 2.2 s after (4.4 s after touch). Drag rotates with pointer events and pointer capture; touch-action pan-y keeps page scrolling on phones. Hovering a list row enlarges its marker on the globe and the map.
- Light and dark: reads data-site-theme on #seedha-site (MutationObserver), recolours uniforms live; palette in lib/globe.ts mirrors the World A tokens.

## Measured (production build, `next build --webpack`, headless Chromium, ANGLE Metal, 1440x900)
- Globe chunks loaded after scroll, none before: three chunk 114.4 KB gz, land data plus topojson/d3-geo 29.9 KB gz, GlobeCanvas/scene 3.4 KB gz. Total 147.7 KB gzipped (budget 300 KB).
- Static map path: 31.4 KB gzipped (shared land chunk 29.9 + StaticMap 1.5).
- Frame rate with both globes on screen: 60.0 fps over 5 s; frame interval p50 16.7 ms, p95 16.7 ms, max 16.8 ms.
- Off-screen pause verified by counting WebGL draw calls: 540 per second on screen, 0 over 1.5 s scrolled away.

## Pausing, DPR, cleanup
- Render loop runs only while an IntersectionObserver on the canvas reports it visible and `document.hidden` is false (visibilitychange stops and restarts it; the clock resets so nothing jumps).
- `renderer.setPixelRatio(cappedDpr(devicePixelRatio))`, capped at 2 (unit tested).
- Unmount: cancels rAF, removes listeners and observers, disposes every geometry, the four materials, the land texture, then `renderer.dispose()` and `forceContextLoss()`, and removes the canvas.

## Test hooks (exact values)
- `data-testid="globe-toggle"` (group; buttons carry `data-layer="pass"|"radar"` and aria-pressed)
- `data-testid="globe-canvas"` (the canvas, aria-hidden; `data-layer` and `data-markers` = space-separated marker ids)
- `data-testid="globe-fallback"` (the SVG, aria-hidden; each marker `<g data-marker="...">`; land path has `data-land="true"`)
- `data-testid="globe-list"` (ul; each `<li data-marker="...">`)
- Root region: `role="region"`, `aria-label={label}`, plus `data-globe-mode="idle"|"globe"|"static"`, `data-globe-layer`, `data-globe-theme`.
- Marker ids: pass-manali, pass-shimla, pass-mussoorie, pass-rishikesh, pass-auli, pass-nainital, radar-winter-line-carnival, radar-international-yoga-festival, radar-nanda-devi-mela, radar-kullu-dussehra, radar-shimla-summer-festival.
- Playwright tip: scroll the region into view first; mode stays "idle" until then. With reducedMotion "reduce" the mode is "static".

## Map rule and network
- Only `world-atlas/land-110m.json` and `objects.land` are imported. No `countries-*` file, no `mesh`, no border strokes (land path has `stroke: none`) on the globe or the map.
- The JSON is bundled at build time. Screenshot runs recorded zero requests to any other origin; no fetch, no eval or new Function (GLSL is compiled by WebGL, which needs no CSP change).

## For the lead
- Nothing outside my files needs to change. CSP is fine as is.
- The component is self-contained and responsive (side-by-side list at 720px container width and up, stacked below). Sections only need `<WorldGlobe initialLayer="pass" label="..." />` and `initialLayer="radar"`.
- The old GuestMap footnote in Sections.tsx says "3D view coming soon"; the sections builder may want to update it.
