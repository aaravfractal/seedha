# Lighthouse: hotel site V2 (/h/deodar-view)

Reviewer R3 (performance and SEO), 13 October 2026, checkout `hotel-site-v2` at `eafd3b4`.

## Status

| Case | URL | Runs | Status |
|---|---|---|---|
| A. Sample hotel, no owner photos (gradient hero, sample text) | http://localhost:3043/h/deodar-view | 3 | Done |
| B. Sample hotel's own build published with 4 owner photos | http://localhost:3043/h/deodar-view | 0 | **Not measured** (see below) |

Case B is not measured. The 4 photos were uploaded and the build was published through the API
(4 JPEGs, 1024 x 683, about 130 KB each). The public payload then listed the photos. The web
page is prerendered at build time and cached by tag. Publishing straight on the API does not
revalidate that tag (only the BFF proxy does), so the page needed a rebuild. The
session's permission classifier refused the rebuild, so the "with photos" runs were not taken.
To finish case B: repeat the publish steps, rebuild (`npx next build`) and rerun the 3 runs.
Or publish through the web BFF so `revalidateTag` runs. What a JPEG hero is expected to cost
is estimated in r3-perf.md (R3-1).

## Environment and method

- Machine: Apple M5, macOS 26.5.1, Node v26.8.1.
- Lighthouse 13.5.0 (`npm install --no-save lighthouse` in this worktree's `apps/web`;
  package.json and package-lock.json unchanged), Chrome for Testing 156 (Playwright's
  chromium-1248) through `CHROME_PATH`, `--headless=new`.
- Default mobile config: form factor mobile, 412 px screen, simulated throttling
  (RTT 150 ms, 1.6 Mbps down, 4x CPU slowdown, i.e. Lighthouse's "slow 4G").
  Categories: performance, accessibility, best-practices, seo.
- App: API `uvicorn app.main:create_app --factory` on 127.0.0.1:8043 with its own SQLite
  (`r3.db`, `alembic upgrade head` + `python -m seed.load`), and web `next build` +
  `next start --port 3043`. Environment as in `apps/web/playwright.config.ts`:
  `.env.example` values, test secrets, `SEEDHA_DEMO=1`, all integrations empty
  (`ANTHROPIC_API_KEY`, WhatsApp, Razorpay, proof), `WEB_ORIGIN=http://localhost:3043`,
  `API_URL=API_BASE_URL=http://127.0.0.1:8043`.
- Local server: TTFB is about 10 ms, so the scores reflect the page's own weight under
  simulated throttling. They do not include hosting latency (Vercel + Railway). The real hosted
  LCP will be the same or worse.
- 3 back-to-back runs, median per value.

## Case A results (sample hotel, no photos)

| Run | Time (UTC) | Performance | Accessibility | Best Practices | SEO | FCP | LCP | TBT | CLS | Speed Index |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 02:02:42 | 84 | 100 | 100 | 100 | 2.12 s | 4.07 s | 89 ms | 0 | 3.08 s |
| 2 | 02:02:54 | 85 | 100 | 100 | 100 | 2.11 s | 4.05 s | 90 ms | 0 | 2.11 s |
| 3 | 02:03:05 | 85 | 100 | 100 | 100 | 2.11 s | 4.04 s | 80 ms | 0 | 2.11 s |
| **Median** | | **85** | **100** | **100** | **100** | **2.11 s** | **4.05 s** | **89 ms** | **0** | **2.11 s** |

Target: 90+ on all four, LCP < 2.5 s, CLS < 0.1.
**Missed: Performance (85) and LCP (4.05 s).** Accessibility, Best Practices, SEO and CLS pass.

Total transfer 470 KiB: fonts 238 KB (51 %), JS about 185 KB, CSS 44 KB, HTML 11.7 KB, no images.
The LCP element is the hero tagline `p.tagline` (text). Observed (unthrottled) LCP = FCP = 161 ms,
so the 4 s is the simulated cost of the bytes on the critical path.

### Top opportunities and diagnostics (run 2)

| Audit | Value | Detail |
|---|---|---|
| Render-blocking requests | est. 1,350 ms | 3 CSS files: `2t7lioc3dlvfq.css` 21 KB (99.6 % unused on this page: owner-app module CSS such as scrim, sheet, monthField, flow/steps), `1lb36r8sv33xa.css` 8 KB (Tailwind/global), `24uh1y4ex6aul.css` 4 KB (hotel CSS + font faces) |
| Network dependency tree | longest chain | document -> `2t7...css` -> `mukta_devanagari_600/700` (67 KB + 69 KB, VeryHigh priority) |
| Reduce unused JavaScript | 50 KiB | `3umdxiosfhr4i.js` (74 KB, 38 % unused), `2ea8o60fzu2ds.js` (45 KB, 52 % unused) |
| Reduce unused CSS | 20 KiB | `2t7lioc3dlvfq.css` |
| Legacy JavaScript | 14 KiB | polyfills for Array.prototype.at/flat/flatMap, Object.fromEntries/hasOwn, trimStart/End in `3umdxiosfhr4i.js` |
| Preloaded fonts | 102 KB | Cormorant 24 KB, Inter variable 49 KB, Mukta Latin 400 + 600 29 KB. **Mukta Latin is not used by the V2 page** (it comes from the `/h` layout's World B fonts) |
| Max potential FID | 140 ms | |
| label-content-name-mismatch (a11y, not weighted) | fail | language button shows "EN" with `aria-label="English"` (and "हि" / "हिन्दी") |
| Image delivery, LCP discovery, font-display, document latency, third parties | pass / n.a. | no images; `font-display: swap` everywhere; TTFB 9 ms; no third parties |

### Indicative experiments (1 run each, `--blocked-url-patterns`)

These show which fixes move LCP. They are not a substitute for measuring the fixed build.

| Blocked | Perf | FCP | LCP |
|---|---|---|---|
| none (median above) | 85 | 2.11 s | 4.05 s |
| Mukta Devanagari + Mukta Latin fonts | 91 | 1.51 s | 3.30 s |
| + the owner-app CSS chunk `2t7lioc3dlvfq.css` | 94 | 1.06 s | 3.01 s |
| + all JS (no hydration) | 94 | 2.11 s | 2.86 s |

Lantern's simulation is noisy with blocked requests (blocking all JS raised FCP), so read these
as direction only. Removing the unused fonts and the owner CSS is worth about 1 s of LCP and
brings Performance above 90. LCP below 2.5 s also needs the JS and font weight cut further
(r3-perf.md).
