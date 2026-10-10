# Design QA review (partial: API was down)

Date: 11 Oct 2026. Reviewer: design QA agent (read-only). Branch: master.
Screenshots: `docs/agent-reports/design-qa/` (only the cited ones are kept).

## Blocker: the API on :8000 was not running

The dev log (`make dev`) shows uvicorn exiting at start with
`[Errno 48] Address already in use`; afterwards nothing listened on :8000 for the
whole session (checked four times). Every `POST /api/auth/demo` returned 502, so
Direct beta login failed and no owner screen could be opened. Per the brief I did
not start or stop servers. Consequences:

- Not reviewed (need login or API data): /home, /upload, /flip (both modes),
  /repeat, /scenario, /approvals (empty and after Desk consent), /savings, /ask,
  /proof, /pro, /site (3 tabs), /inbox, /assistant, /desk, /link/DEODAR-RS26 and
  the UPI sheet, /hotel/deodar-view (all moods and Hindi), /rate-card, /agent-deck.
- /rate-card and /agent-deck are behind the owner session (`apps/web/proxy.ts`
  lines 37 to 38), so they redirect to /login when signed out.
- The marketing page renders Metrics, FlipExplainer, GrowthCalculator and GuestMap
  only when `GET /public/sample` succeeds (`components/website/HomePage.tsx`), so
  those four sections (video marketing-02, 04 to 07; handoff page-04, page-05)
  could not be compared.

Re-run this review after `make dev` comes up cleanly (free port 8000 first).

## /login and /signup (handoff page-07; page-08)

Shots: `login-light-1440.png`, `login-dark-390.png`, `signup-light-1440.png`.

| id | sev | difference | intentional? | fix | file |
|---|---|---|---|---|---|
| L1 | medium | Background glows are clipped to a box (hard edges visible at x≈180, x≈1260 and y≈848 at 1440); the reference glow is full-bleed behind the whole page | no | make `.stage` full-bleed (e.g. `width:100vw; margin-inline:calc(50% - 50vw)`) or put the glow on a fixed layer outside AppFrame's max-width `main` | `app/(app)/login/auth.module.css` (`.stage::before`) |
| L2 | medium | Auth pages show the app header (logo + theme toggle) and the app footer link row; the reference auth screen is a bare stage with only "‹ Back to website", logo and card | partly (D-084 puts sign-in inside AppFrame) | give auth routes a bare frame (no header or footer), or at least drop the duplicate logo in the header | `app/(app)/layout.tsx`, `components/AppFrame.tsx` |
| L3 | low | "‹ Back to website" sits on one line (reference wraps it, a defect); ours is correct | yes (gallery notes the wrap as a defect) | none | |
| L4 | low | Card has a visible 1px border; reference card is borderless with a soft shadow only | no | drop border in light mode, keep shadow `0 1px 2px rgba(0,0,0,.04), 0 8px 28px rgba(0,0,0,.06)` | `auth.module.css` (`.card`) |
| L5 | low | Extra divider "or sign in with your number" between beta card and number field | not in a decision; reads well | keep or remove; record in decisions if kept | `app/(app)/login/page.tsx` |
| L6 | low | At 390 dark the glow shows as two vertical stripes left and right of the card | no | same fix as L1 | `auth.module.css` |
| L7 | low | Sign up card matches copy exactly; adds Terms and updates checkboxes and a disabled "Create account" (pale pine). Disabled pill contrast is low but legible | yes (consent rules) | none | |

## / public website (video marketing-01, 03, 08 to 12; handoff page-02, page-03, page-06)

Shots: `sec-web-00.png` (dark hero), `sec-web-01.png`, `sec-web-06.png` (pricing, dark),
`sec-weblight-09.png` (footer, light), `sec-web390-00.png`.

| id | sev | difference | intentional? | fix | file |
|---|---|---|---|---|---|
| W1 | high | With the API unreachable the hero product window shows developer copy "The sample figures could not load. Seedha API is not reachable. Is it running?" and four whole sections silently disappear. A public visitor should never see this | no | public page: show a friendly fallback ("Sample figures are loading. Try again.") and bundle a static copy of the sample figures so Metrics, Flip explainer, Growth and Guest map still render | `components/website/HomePage.tsx`, `components/website/Hero.tsx`, `app/api/[...path]/route.ts` line 71 (message) |
| W2 | medium | Hero H1 wraps to two lines at 1440 ("Know what / you really keep."), about 120px; the reference sets it on one line (about 110px across ~1400px) | no | lower the desktop clamp max (e.g. `clamp(48px, 7.4vw, 112px)`) and allow one line at >=1280 | `components/website/site.module.css` (hero title) |
| W3 | medium | Light theme footer is a black band; the reference footer is light (white page, grey links, green glow) | no | footer uses page tokens in light, dark only in dark theme | `components/website/WebsiteFooter.tsx`, `site.module.css` |
| W4 | low | Header logo has the pine app tile before "Seedha सीधा"; reference marketing header is wordmark only | no decision; logo spec allows the tile | optional: wordmark only on website header | `components/website/WebsiteHeader.tsx` |
| W5 | low | Hero blur-in: final state matches; first-frame stagger not verified in still shots | n/a | none | |
| W6 | low | Pricing Pro card is white in dark theme (inverted); in light the reference Pro card is black. Feature lists differ from the reference ("Direct True Cost", "VCC Line and Agent Khata", "Group Displacement", "AI packages, rate card PDF, agent deck, Google kit" are missing) and the note "The Desk is included with yearly plans." is missing | lists partly D8 (no claims for unbuilt features) | add the Desk note if true; record the trimmed list in decisions.md | `components/website/Pricing.tsx` |
| W7 | low | Footer: reference links "Pitch deck", "Design system", "Desk and guest", "Security review" absent; we add "About", "Contact", "Delete my data" | probably intentional (pages that exist) | record in decisions.md | `WebsiteFooter.tsx` |
| W8 | low | Badge row shows "Two-step sign-in", "Encrypted at rest", "PCI DSS payment gateway" with "Planned" chips | yes (D8) | none | |
| W9 | low | Cookie banner on phone covers about 40% of the first screen (hero CTAs partly hidden) | no | compact phone layout: one line of copy, buttons in a row | `components/website/CookieConsent.tsx` |
| W10 | low | Dark-first with light switch, marquee strip, window dots #FF5F57/#FEBC2E/#28C840 match | yes (D14, P7) | none | |

## /privacy

Shot: `privacy-light-1440.png`. No reference image. Uses the website header and
footer, key points card, "Hindi mein dikhao". Same footer as W3 (dark band in light
theme) and the cookie banner overlaps the first section. No other issues seen.

## /hotel/deodar-view (handoff page-26, page-27; video hotel-site-01 to 05)

Shot: `hotel-pine-light-1440.png`. Only the error state rendered: Cormorant title
"This page did not load." with "Seedha API is not reachable. Is it running?".

| id | sev | difference | intentional? | fix | file |
|---|---|---|---|---|---|
| H1 | medium | A guest-facing hotel page shows the developer error string | no | guest copy: "This page is resting. Please try again in a minute." and hide the API wording | `app/hotel/[slug]` error UI, `app/api/[...path]/route.ts` |
| H2 | n/a | Moods pine, stone, sky and `?lang=hi` not reviewable | blocked | re-run | |

## /rate-card, /agent-deck (handoff page-28 to 31; video rate-card-01, agent-deck-01)

Shot: `ratecard-light-1440.png` (redirects to /login). Not reviewable while signed
out; owner-only by design in `proxy.ts`. Re-run after login works.

## Owner app and guest screens

Blocked (see top). References to use on re-run: Overview page-09, page-10 and
owner-01, 06 to 10; Upload page-11; Money kept page-11, page-12 (older tab-pill
shell: compare content only); Repeat page-12; Saturday move and Approvals page-13;
Savings and Ask page-14; Assistant page-15; Proof and Pro page-16; Inbox page-18,
owner-02; Desk page-19 to 21, desk-01, desk-02; Link page-22; Site page-22 to 25,
owner-03 to 05. Pages 02 to 06, 09, 10 and 19 contain design-tool chrome; pages 10
(Fig 12) to 17 show the older shell with tab pills.

## Top gaps found (this partial pass)

1. W1 high: public site shows "Seedha API is not reachable. Is it running?" and drops
   four sections when the API is down; ship static sample figures as a fallback.
2. H1 medium: hotel site (guest-facing) shows the same developer error.
3. W2 medium: hero H1 wraps to two lines at 1440; reference is one line.
4. W3 medium: footer is dark in the light theme; reference footer is light.
5. L1 medium: auth background glow clipped to a box with hard edges.
6. L2 medium: auth pages carry the app header and footer; reference is a bare stage.
7. W9 low: cookie banner covers the hero on phones.
8. W6 low: pricing lists and the "Desk included with yearly plans" note differ.
9. L4 low: auth card border instead of shadow-only.
10. W7 low: footer link set differs; record the intentional set in decisions.md.

Environment note for the lead: `make dev` lost the API at start (port 8000 in use),
so 21 of the 27 requested screens are unreviewed. Re-run once the API is up.
