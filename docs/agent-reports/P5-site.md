# P5 Seedha Site and World B: report

Worktree .worktrees/site (fe/site). Nothing committed. Servers stopped, scratch DB and temp scripts deleted.

## Files
API: app/services/site.py (package states, per-night extras, EN/HI sample copy, Google kit, slugify,
is_public), app/routers/site.py (new models, PATCH /site/packages/{key}, owner_name), NEW
app/routers/public_site.py, app/main.py (include), app/ratelimit.py (bucket "site" 60/60s),
tests/test_route_auth.py (2 PUBLIC entries), NEW tests/test_public_site.py (7 tests).
Web: app/(owner)/(screens)/site/page.tsx (rewritten), NEW components/site/{HotelSite,SetupFlow,Review,
PackagesTab,GoogleKit,WorldBMessage}.tsx, copy.ts, worldb.module.css, owner.module.css, print.module.css;
NEW app/hotel/layout.tsx + app/hotel/[slug]/page.tsx; app/rate-card/page.tsx (rewritten) + NEW layout.tsx;
NEW app/agent-deck/{layout,page}.tsx; NEW lib/types-site.ts, lib/fonts-worldb.ts; proxy.ts (+/agent-deck);
DELETED components/SitePreview.tsx. lib/bff.ts unchanged ("public/" already covers the new routes).

## Endpoints
- GET /site (owner): adds slug, sample, hotel_hi, location/tagline EN+HI, rooms with name_hi and detail,
  nearby list, gallery, contact (placeholder flag), owner_name, setup answers, google kit; packages carry
  nights, includes EN/HI, price, price lines, nightly_rate, state (pending/approved/skipped).
- PATCH /site/packages/{key} (owner) {state?, nights? 1..7}: skip, bring back, edit nights (asks for a
  fresh OK). Price = public room rate x nights + extras, computed in code; never below the room price.
  Stored as tokens in site_config.approved_packages ("wk:approved:3"); bare "wk" (old format) still reads.
- GET /public/site/{slug} (public, rate-limited): published site or the sample hotel only, approved
  packages only, no guest data (test asserts no guest name in the response). 404 otherwise.
- GET /public/site/{slug}/availability?check_in&nights&room_type (public, rate-limited): open, or
  reason past / too_far / full (uses link.free_room). Booking bar shows the closed state from this.

## Checks (all pass)
- api: ruff check OK; ruff format 92 files formatted; mypy no issues in 91 files; pytest 368 passed.
- web: tsc OK; eslint 0 warnings; prettier OK; node --test 42 pass.
- axe (wcag2a/aa, 21a/aa) at 390 and 1440: /site, /hotel/deodar-view (pine EN, sky HI, stone), /rate-card,
  /agent-deck: no violations (after fixing segmented-control contrast).
- Print: /rate-card prints exactly 1 A4 page; /agent-deck prints 6 pages 297x167 mm (named @page).

## Screenshots compared
owner-03/04/05, page-22..25 (empty, setup, review, live, packages, Google kit); hotel-site-01..05,
page-26/27 (hero, booking bar, rooms, packages, Hindi); rate-card-01/page-28; agent-deck-01, page-28..31.
Checked at 390, 760, 980, 1440; owner screen light and dark.
Remaining differences:
- Google fonts could not download in this sandbox (next/font timeouts), so screenshots show fallbacks;
  needs a networked build to confirm Cormorant/DM Serif/Outfit/Mukta rendering.
- Rooms list in API order (highest rate first: Family Suite, Deluxe, Standard); design shows Deluxe first.
  Booking bar default room is therefore Family Suite.
- Package cards say "Suggested from your bookings" instead of "AI suggestion": the reasons are computed
  from bookings, not written by AI (D8 honesty).
- "Download photos" is disabled with a note (only sample placeholders exist).
- Copy link copies the working /hotel/{slug} URL; the shown address deodarview.seedha.site is labelled
  "(sample address)". Deck slide 6 says "Advance by UPI" (design's "30% advance" policy not invented).
- Agent deck at 390 is a scaled 16:9 slide, so its text is small (by nature of a slide).
- Previews in Review are the real HotelSite rendered inert and scaled (container queries), not iframes.

## Numbers vs design
All prices from API and equal the design: rooms 4,300 / 6,200 / 3,400; packages 9,400 / 4,300 / 11,900.
Weekend reason now reads "Your weekends fill fastest: 49% of room nights start on a Friday or Saturday."
(computed); Monsoon "July and August are your emptiest months." (computed).

## For the lead
- Merge note: written against the old AppChrome; my /hotel, /rate-card, /agent-deck layouts render their
  own <main id="main" tabIndex={-1}> and import nothing from chrome, so they fit the new AppFrame setup.
- lib/types.ts still exports the old SiteData (now unused); delete it when convenient.
- e2e: a11y.spec covers /site already; consider adding /hotel/deodar-view and an e2e for
  setup -> review -> publish -> public site shows approved package.
- No globals.css or schema change needed. A real column for package decisions would be cleaner later.
