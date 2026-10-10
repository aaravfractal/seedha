# Accessibility and performance review (master, runtime pass 2)

Reviewer: a11y/perf agent, read-only. Date: 2026-10-11. Tools: Playwright chromium + @axe-core/playwright
(from apps/web/node_modules), throwaway scripts (deleted).

## Status: public half done at runtime; owner half BLOCKED again (API down)

- Web :3000 now serves every route (A1 fixed: fonts are local).
- **The FastAPI service on :8000 is not running** (nothing listens on 8000; `.env` API_URL=http://localhost:8000;
  the only uvicorn is on :8507, a different checkout). `POST /api/auth/demo` returns
  `502 api_unreachable`, so Direct beta login cannot sign in, `/upload` sample data cannot load, and
  `/otp` cannot be reached (send code also calls the API). Waited 4+ min; it did not come up. I was told not to
  start servers. Result: every owner screen (/home ... /onboard, /desk, /link), the shell (header, sidebar,
  ⌘K, notifications, account), flip/UPI/proof/desk/site/inbox states, owner reduced-motion and /home,/flip
  time-to-interactive are **not measured**. Restart the API (`make dev` or uvicorn on :8000) and resume me.
- Done: 11 public routes (/, /privacy, /careers, /hotel/deodar-view, /rate-card, /agent-deck, /login,
  /signup, /plans, /link/DEODAR-RS26, 404) x light/dark x 1440/980/760/390 = 88 axe runs; best-practice at
  1440 light; tap targets, computed fonts and overflow at 390 and 1440; keyboard walk (40 Tabs per page,
  10 pages); cookie dialog trap; reduced motion; dev perf. Note: "/" live flip and /link/DEODAR-RS26 rendered
  their error state ("Try again") because of the API outage, so their happy paths are unscanned.

## Findings

| id | sev | page/state | selector | problem | measured | fix (file) |
|---|---|---|---|---|---|---|
| A1 | fixed | every page | `lib/fonts.ts` | Google Fonts fetch broke dev server | all routes 200 now | done (local Mukta) |
| A2 | fixed | /login /signup | `.betaChip` | was 12px | 13px; no computed text <13px on public pages | done |
| A3 | fixed (static) | /upload | `.type` | was 12px | 13px in CSS; runtime unverified (API) | done |
| A4 | fixed (static) | /site, /approvals | `.bub .foot` | was 12px | 13px in CSS | done |
| A5 | fixed (static) | /site preview | `.hs .foot` | was 11px | 13px in CSS | done |
| A6 | partly fixed | inbox, cookie dialog | `role="switch"` | now used on inbox "Away" and cookie dialog switches; runtime keyboard check of inbox switch pending | 2 files | keep using shared pattern for new toggles |
| A7 | open (low) | /home insight | `InsightBanner` button (`app/(owner)/home/parts.tsx:48`) | HI/EN switch state only via label | static | `Segmented` with `aria-pressed` like /site |
| A8 | fixed (static) | ⌘K | `.paletteInput:focus-within` | ring added (3px accent) | Shell.module.css:482; runtime pending | done |
| A9 | fixed (static) | dialogs | `useDialogFocus.ts` | Tab now pulls escaped focus back | code read; cookie dialog verified at runtime | done |
| A10 | fixed | Desk | `.printBtn:focus-visible` gold ring | rule removed | static | done |
| A11 | medium | `/` cookie banner -> Choose -> Escape or Cancel | `components/website/CookieConsent.tsx:48` | Banner unmounts while the dialog is open (`banner && !dialog`), so focus cannot return to "Choose"; after Escape focus lands on `<body>` | activeElement = body | Keep banner mounted with `inert`/`hidden` while dialog is open, or focus the banner's Choose button in an effect when the dialog closes and the banner is still due |
| A12 | medium | website pages at 390 (/, /privacy, /careers, 404) | footer columns `.footCol a`, `.linkBtn` (`components/website/site.module.css:1758`) | Dense secondary links below 44px | 33px tall (24 links + Cookie settings) | `padding: 12px 0` (or `min-height: 44px; display:inline-flex; align-items:center`) |
| A13 | medium | website bottom bar at 390 | `.bottomLinks a` (Privacy/Terms/Security) (`site.module.css`, WebsiteFooter.tsx:108) | Below 44px | 21px tall | same padding as A12 |
| A14 | medium | app-frame pages at 390 (/rate-card, /agent-deck, /login, /signup, /plans, /link) | `footer.site-footer nav.inner a` (`app/globals.css:713`) | Footer links below 44px | 21px tall, 26-95px wide | `.site-footer a { display:inline-flex; min-height:44px; align-items:center }` |
| A15 | low | /login, /signup, /plans, /rate-card, /agent-deck | `header.site-header .iconbtn` theme button (`app/globals.css:318`) | Below 44px | 40x40 | `min-width/min-height: 44px` |
| A16 | low | /plans, `/` pricing | `.toggle button` (`globals.css:780`), pricing billing segmented (site.module.css) | Segmented buttons below 44 | 40px tall | `padding: 11px 18px` / `min-height: 44px` |
| A17 | low | website and app-frame headers | brand link `header ... a.brand` | Below 44 | 31px tall | `min-height: 44px` on the brand link |
| A18 | low | `/` live flip error, /link error | "Try again" `button.btn.small` | Below 48 (primary recovery action) | 41px / 40px | use full `.btn` (48px) for the retry action |
| A19 | low | /plans | `.toggle button { transition: all .3s }` (`globals.css:785`) | `all` also animates outline-color, so the focus ring fades in from ink to accent over 300ms (measured #6E6E73/#1D1D1F on first frame) | 300ms | `transition: background-color .3s, color .3s, box-shadow .3s` |
| A20 | low (bp) | /plans | `.plan:nth-child(1) > h3` | axe heading-order (h1 -> h3) | 1 node | use h2 for plan names |
| A21 | low (bp) | /link/DEODAR-RS26 error state | `html` | axe page-has-heading-one: error view has no h1 | 1 | give the error card an h1 |
| A22 | low (static) | header popovers | `AppHeader.tsx:93,190` | Notifications and account popovers trap focus (`useDialogFocus`) but are `role=dialog` without `aria-modal` | static | add `aria-modal="true"` or stop trapping (non-modal popover) |

Counts: open 4 medium (A11-A14), 9 low (A7, A15-A22), A6 partly fixed; fixed 8 (A1-A5, A8-A10; A3-A5 and A8
verified statically only). axe WCAG 2.1 A/AA violations on public pages: **0**
(88 runs, light and dark, 4 widths).

## Measurements (public pages)

- axe WCAG A/AA: 0 violations on all 11 routes x 2 themes x 4 widths, including the cookie banner state on "/"
  and the 404. Best-practice: 2 (A20, A21).
- Skip link is the first Tab stop on website (`/`, /privacy, 404), World B (`/hotel/deodar-view`), guest
  (`/link/DEODAR-RS26`) and app-frame (/login, /signup, /plans, /rate-card, /agent-deck) pages.
- Focus ring: 378 Tab stops walked; every stop `:focus-visible` with a 3px solid outline (or the 3px
  `:focus-within` field ring on phone inputs). Ring contrast vs background: pine #1E6B4E on #FBFBFD 6.22,
  on #FFF 6.43, on #F5F5F7 5.9; dark #4CC38A on #0B0B0C 8.88, on #1C1C1E 7.6; World B pine #1F4D3A on
  #F7F6F2 8.9. All >= 3:1. Only exception is the transient A19.
- Cookie dialog: `role=dialog aria-modal=true`, focus moves in, 4 controls of which the 2 switches are disabled;
  Tab and Shift+Tab x7 each never left the dialog; Escape closes; focus return fails (A11).
- Computed font-size < 13px: 0 elements on every public route at 390 and 1440.
- Horizontal overflow at 390: none on any public route, light or dark.
- Reduced motion (emulated reduce): 0 running animations and 0 elements with non-zero animation/transition
  duration at t=80ms on /, /hotel/deodar-view, /login, /plans. Hero blur-in: with reduce every word is
  opacity 1 / blur(0) at 150ms; without reduce words are still opacity 0 / blur(14px) at 150ms.
- Perf (next dev, Turbopack, cold context): "/" first load 966 KB JS transfer over 20 files, of which dev-only
  framework: next-devtools 248 KB, next client 195 KB, react-dom 179 KB (866-1027 KB decoded). Page chunks:
  /login 15 KB (148 KB decoded), /hotel/deodar-view 12 KB (102 KB), /link 10 KB (82 KB). DCL 42-64 ms,
  load 63-202 ms. Long tasks: none over 200 ms (max 75 ms on the cold "/").

## Fine

- Global ring rule `:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px }` holds at runtime
  in light, dark and World B.
- Website, World B, guest and auth pages: no contrast, name, label, landmark or ARIA errors in either theme.
- Cookie dialog uses `role=switch` + `aria-checked`, disabled switches are skipped by the trap.
- Reduced motion fully instant on public pages, including the hero blur-in (Framer Motion honours it).
- No horizontal scroll at 390; no text under 13px.

## Not yet checked (needs the API on :8000)

axe on /home, /upload, /flip, /repeat, /scenario, /approvals, /savings, /ask, /proof, /pro, /site, /inbox,
/assistant, /my-place, /desk, /link, /otp, /onboard x themes x widths; states (flip "By money kept",
notifications, account menu, ⌘K, UPI sheet, proof dialog, Desk after Show QR, site Review tab, inbox thread);
header/sidebar/palette keyboard walk and dialog traps; Segmented/switch keyboard; ⌘K input ring; tap targets,
fonts and overflow on owner screens; reduced motion for screen enter, flip glide, count-ups, slip, sheets;
/home and /flip time to interactive, owner JS chunks and long tasks. Happy paths of "/" live flip and
/link/DEODAR-RS26.
