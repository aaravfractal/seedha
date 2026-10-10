# P7 Public website: report

Worktree .worktrees/web (fe/web), uncommitted. Two agents (first stopped on an API error; second reviewed and finished).

## Files
- API: app/routers/public_sample.py (new), main.py (include), ratelimit.py (LIMITS["public_sample"] = 60/min),
  tests/test_public_sample.py (new, 9 tests), tests/test_route_auth.py (PUBLIC += GET /public/sample).
- Web: app/(website)/layout.tsx + page.tsx + careers/page.tsx; legal pages moved into app/(website)/ (about, contact,
  cookies, data-deletion, faq, privacy, security, terms); app/not-found.tsx (now wraps WebsiteFrame);
  components/website/* (WebsiteFrame, WebsiteHeader, WebsiteFooter, SiteTheme, CookieConsent, Hero, Metrics,
  Sections, Pricing, HomePage, hooks.ts, site.module.css); components/LegalPage.tsx; lib/website.ts (+test),
  lib/types-website.ts, lib/plans.ts STATEMENT_CLEANUP_RUPEES (+test). The old app/page.tsx redirect to /home is deleted.

## Endpoint
GET /public/sample: public, rate limited, 404 unless the property is the sample hotel, 409 before statements load.
Returns ledger KPIs, channel rows and both ranks (load_ledger, kpis_for, channel_out), repeat count and paid twice
(stored matches, else the matcher read-only: no writes, no LLM tie-break), Saturday move (saturday_move), growth
(Direct net ADR minus the top OTA by bookings, the only subtraction in the router) and top 8 guest cities as
counts. No names, phones or emails (tested).

## Checks (all pass)
- api: ruff check OK; ruff format 92 files OK; mypy 91 files no issues; pytest 370 passed.
- web: tsc OK (run `npx next typegen` first if .next is stale; LayoutProps); eslint 0 warnings; prettier OK;
  node --test lib/*.test.ts 49/49.

## Axe (@axe-core/playwright, throwaway script, deleted)
"/", /privacy, 404 at 1440 and 390, dark and light: 0 violations, with and without the cookie banner, and the
cookie dialog open. /terms /cookies /security /about /contact /faq /data-deletion /careers: 0 violations.
Fixed on the way: hero lede and 404 lede contrast over the glow in light, loading skeleton aria-label on a div,
careers page heading order, eyebrow below 13px, cookie banner link underline.
404 in this worktree reports duplicate-main landmarks only because this worktree still has the old root
AppChrome; with master's chrome-less root (simulated by unwrapping the DOM) it is 0 violations.

## Screens compared (dev server, webpack, scratch DB, all stopped and deleted)
Every section at 1440 dark and light, 390 light, 760 dark, 980 light; flip toggle (toast "MakeMyTrip drops from
1st to 5th" verified), cookie banner and dialog, phone menu, reduced motion (metrics show final values at once,
window has no tilt). Fixed: phone header overflowed at 390 (Devanagari hidden and smaller pill below 440px),
phone menu had no side padding, footer one long column on phone (now 2 columns), flip value column widths.
Remaining differences: guest map is a 2D city list with "3D view coming soon" (D13); no cursor-following glow;
Pro card is dark in light mode and light in dark mode (inverted card); Pulse cards are fixed sample copy.

## Numbers that differ from the design
- Net kept ₹47,33,012 (design ₹47,33,011); "Commission-free share 16.7%" with "Direct bookings 10.7%" (D1).
- "By bookings" ranks by room nights (the API's rank, same as the owner flip), so Travel agents (180) is 3rd and
  Direct (160) 4th; the design listed list revenue with Direct 3rd. Rows now show room nights in that mode so the
  order and the figures agree.
- Guest cities are the seed ledger's top 8 by stays (Meerut 80, Faridabad 76, ...), not the design's 6 cities with 1
  to 2 guests.
- Footer badges: "Guest consent logged", "No OTA scraping" with a check; "Two-step sign-in", "Encrypted at rest",
  "PCI DSS payment gateway" each tagged "Planned" (D8). Security page gained a "What is built and what is planned" list.

## For the lead (changes elsewhere)
1. Delete the interim layout.tsx files in app/about, privacy, terms, cookies, security, contact, faq, data-deletion
   on master, and the old app/page.tsx if master still has one (the (website) group owns "/").
2. e2e/a11y.spec.ts: add "/" and "/careers" to PUBLIC_PAGES. On "/" emulate reduced motion
   (page.emulateMedia({ reducedMotion: "reduce" })) or wait about 2 s: axe can catch hero words mid blur-in.
   Pages show the cookie banner on first visit; it passes axe.
3. e2e/security.spec.ts: add "/" to GUEST_PAGES (CSP check). No CSP change needed: no external scripts, fonts or
   images; the website theme boot script is inline like the existing one.
4. 404 copy kept ("This page is not here.", "Go to Seedha" now goes to "/", "Book a stay" to /link).
5. Links to /hotel/deodar-view and /agent-deck depend on P5; /demo, /login, /signup, /rate-card exist.
6. Cookie policy now lists three necessary cookies (adds seedha_cookies, the banner answer, 6 months).
7. Website theme uses the same seedha_theme cookie; the website defaults to dark when it is unset.
8. `apps/api/.venv` shows as untracked (symlink not matched by `.venv/` in .gitignore); do not commit it.
