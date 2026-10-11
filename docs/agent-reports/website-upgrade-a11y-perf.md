# Website upgrade: accessibility and performance review

Read-only review of the shared globe, Seedha Pass, Event Radar and the legal pages against
docs/WEBSITE_UPGRADE.md sections 2 and 7. Target: production build on http://localhost:3000
(`make demo-prod`). Scripts and screenshots: scratchpad `review-a11y/` (audit.cjs, contrast.cjs,
lt.cjs, results.json). Playwright Chromium; axe-core 4 injected from apps/web/node_modules.

## Measured numbers

| Check | Result |
|---|---|
| Globe mode before scroll | both regions `idle`; 13 scripts loaded, none contain three.js (`WebGLRenderer` absent) |
| New JS after scrolling to both globes | 5 chunks. Transferred 162,013 B (158.2 KB, incl. headers). Gzip -9 of bodies: 156,675 B (153 KB). Budget 300 KB: pass |
| Largest chunk | three.js 482,681 B raw, 119,664 B gz (121,038 B transferred); land/topojson/d3-geo 30,430 B gz; the rest 6.6 KB gz |
| Requests to non-localhost origins | 0 (whole home page, load and scroll) |
| Render loop, globe on screen (2 s, SwiftShader) | 80 rAF, 720 draw calls |
| Scrolled off screen (2 s) | 0 rAF, 0 draw calls |
| Tab hidden via visibilitychange (2 s) | 0 rAF, 0 draw calls; resumes on visible (45 rAF / 1 s) |
| Frame rate, GPU (ANGLE Metal, Apple M5, 1440x900, 300 frames) | 60.0 fps, p50 16.7 ms, p95 16.8 ms, max 16.8 ms |
| Frame rate, software GL (SwiftShader) | 45.4 fps, p95 33.4 ms (CI only, not a laptop figure) |
| Long tasks on globe init | laptop: 1 x 55 ms; 390 px mobile emulation, 4x CPU throttle: 69 ms + 242 ms |
| DPR cap | deviceScaleFactor 3: canvas 1174 px for 587 CSS px, ratio 2.00; at 390 px DPR 3: ratio 2 |
| Layer toggle x60 | WebGL buffers created 840, deleted 840 (no leak); textures unchanged (10/0) |
| List hover x60 (setActive) | 62 buffers created, 0 deleted (small leak, see A-3) |
| JS heap after the loops | 15.2 MB |
| Reduced motion (390, touch) | both regions `static`, 0 canvases, 2 fallback SVGs, 0 running animations, no three.js chunk requested |
| Low-end rule | 390 px phone with 4 cores: `static`; 8 cores: `globe` |
| Touch scroll over canvas (390, synthesized touch gesture of 300 px) | page scrolled 301 px; canvas `touch-action: pan-y` |
| Keyboard | Tab moves Seedha Pass -> Event Radar button, Enter selects, ArrowLeft goes back; focus ring 3px solid pine; focus leaves the region after 2 Tabs (no trap); no wheel listener (no scroll trap) |
| Text list vs markers | list `pass-manali ... pass-nainital` equals canvas `data-markers`; canvas and its host `aria-hidden="true"` |
| Touch targets in the new sections | toggle buttons 125x44 and 120x44; axe `target-size` clean on /, /privacy, /data-deletion at 390 |
| axe (wcag2a, 2aa, 21aa, best-practice) | 0 violations on /, /privacy, /terms, /cookies, /security, /data-deletion at 390 and 1440, light and dark (24 runs). Incomplete items only for text over the canvas/SVG (checked by hand below) |
| Hand contrast, light | Planned pill 5.56, list meta 5.07, notes/body/footnote 4.91, map labels 14.48, toggle (pressed) 16.83 |
| Hand contrast, dark | Planned pill 9.48, list meta 6.61, notes 8.16, map labels 17.18, hint 7.03 |
| Headings | h2 Seedha Pass after features; Event Radar is h3 inside the Pulse h2; no skipped levels (axe heading-order passes) |

## Findings

| id | sev | file:line | problem | suggested fix |
|---|---|---|---|---|
| A-1 | high | components/website/globe/scene.ts:63-64, 393-394; :135 | The globe auto-sways forever (48 s period) and the marker halos pulse forever. Movement starts by itself, lasts over 5 s and sits beside other content, so WCAG 2.2.2 (Pause, Stop, Hide) needs a way to stop it. Hover pauses it for mouse users only; keyboard and screen-reader users have no control. Reduced-motion users are covered by the static map. | Stop the sway (and freeze `uTime`) after the intro plus one short sway of 5 s or less, or add a visible "Pause motion" button in the toggle row (aria-pressed). Also stop it while focus is inside the region (`focusin`). |
| A-2 | medium | components/website/globe/globe.module.css:123-137 | The "Drag to turn the globe" hint is #6e6e73 on 72% #f5f5f7 glass. Over light ocean it is about 4.6:1, but in light mode the globe's land (#7c7c81) passes behind it at 390 px and while the globe sways, which gives about 3.4:1 (#6e6e73 on #d3d3d6), under 4.5:1. aria-hidden does not exempt visible text. | Use `--ink` for the hint text, or make the glass opaque (`--bg2`) in light mode. |
| A-3 | low | components/website/globe/scene.ts:428-431 | `setActive` attaches a new `BufferAttribute` on every list hover. The old GL buffer is never deleted (60 hovers: 62 buffers created, 0 deleted). It is small but grows without limit. | Keep one `aSize` attribute and write into its array, then set `needsUpdate = true`. |
| A-4 | medium | components/website/globe/scene.ts:142-143 | The land texture is `min(4096, maxTextureSize)`, which gives 4096x2048 on phones too. That is about 32 MB GPU memory plus mipmaps for each globe, and the home page creates two. The 4096 canvas fill and the upload also cause a 242 ms long task on a 4x-throttled phone profile. | Size the texture from canvas width x DPR (for example 2048 below 600 CSS px or when cores <= 6), or share one texture or renderer between both instances. |
| A-5 | low | components/website/globe/WorldGlobe.tsx:171-173 | The region's `aria-label` stays at its initial value ("Seedha Pass planned towns") after the user switches it to Event Radar, so the landmark name no longer matches its content. The list label updates correctly. | Use a neutral label such as "Seedha map: planned towns and sample events", or derive the label from `layer`. |
| A-6 | low | components/website/globe/WorldGlobe.tsx:228-234 | Highlighting a marker from the list works on mouse hover only. List rows cannot take focus, so keyboard users cannot do it. The list carries all the information, so this is not a failure. | Optional: give rows `tabIndex={0}` with `onFocus`/`onBlur` calling `setActive`, or leave as is. |
| A-7 | low | lib/globe.ts:228-234 | The fallback rule ignores `navigator.connection.saveData`. It also treats every desktop with 4 cores or fewer as capable, which is fine. The phone rule only fires when cores <= 4, and most mid-range Android phones report 8 cores. Those phones load 120 KB gz of three.js and a 4096 texture (see A-4). | Add `saveData === true` as a reason for the static map. Consider `screenMin < 500 && dpr >= 3 && memoryGb <= 4` as low-end. |

## Not issues (checked)
- Canvas, canvas host and fallback SVG are all aria-hidden. Every marker has a list row with name, town, dates or "Planned town" and a "Sample" tag. The polite live line announces layer changes.
- Toggle: real buttons with aria-pressed, `aria-controls` on the list, 44 px height, Enter, Space and arrows work, visible 3 px focus ring.
- The `.reveal` rise and toggle transitions are disabled under reduced motion. No running animations remain on the page in that mode.
- The fallback map draws only the `data-land` path with `stroke: none`. Arcs are the only stroked paths.
- Legal pages: one h1, the draft notice has role=note, and axe is clean in all 4 viewport and theme combinations.
