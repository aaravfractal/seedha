# V2-OWNER report: Hotel details editors, Print cards, Card scans

Branch hsv2-owner (worktree .worktrees/v2owner), on top of a042dd7. Not committed (the lead commits).

## What was built

Two new tabs on the Website screen (`app/(owner)/(screens)/site/page.tsx`), next to the existing
Site, Packages and Google kit tabs (those are unchanged and still work; site-build.spec.ts passes):

1. **Hotel details** (after "Site"). One form, one Save ("Save hotel details") that PUTs the whole
   object to `/site/details`:
   - Amenities: the fixed 40 in six groups, searchable (English, Hindi or id), checkboxes with
     English and Hindi labels, "N of 40 chosen" count. Saved in the API's fixed order.
   - Nearby places: up to 8; name EN/HI, minutes, on foot/by car, kind select (9 kinds), direction
     as an 8-point compass (3x3 buttons, hotel in the middle) plus a "Degrees from north" numeric
     fallback; move up/down, remove, add.
   - How to reach: up to 6; road/rail/air select, EN/HI text.
   - Good to know: check-in and check-out times (`type="time"`, HH:MM) plus up to 8 EN/HI lines.
   - Contact: phone, WhatsApp, email, address EN/HI. Map position: latitude/longitude text inputs
     with range validation (both or neither); no map API.
   - Client checks mirror `SiteDetailsIn` (letters counted as code points, required/optional,
     `<`/`>` refused, phone digits/spaces/leading +, <= 16, email pattern, HH:MM, whole minutes
     1..600, bearing 0..359, list caps). On Save with errors: a focused error summary
     ("Fix these 2 to save: Nearby place 1, name in English: Use plain text without < or >.")
     plus inline errors with aria-invalid; no request is sent.
   - The API's 422 `details` (`{field, problem}`) are mapped to plain words and shown the same way.
   - Sticky save bar: "Not saved" / "All changes saved" / "Saving", Undo changes; toast on success;
     beforeunload warning while unsaved; the tab stays mounted once opened so a tab switch keeps
     edits. "Sample facts" tag while `details.sample` is true.
2. **Print cards** (after "Packages"):
   - "Card scans this month" (GET `/site/scans`): total, per card (Wallet card, In-room card,
     Desk tent card), per-day bar list (days with scans only). Empty state: "No scans yet this
     month. ...". Loading and error states. Privacy note (counts only).
   - Previews in HTML/SVG at true aspect ratio from hotel data: wallet front/back (CR80 85.6x54,
     rounded 3.18 mm corners), in-room front/back (A6), desk tent card (A5). Pine mood colours,
     Cormorant headings, Mukta body. "Sample" tag on sample data, "Seedha" small on backs unless
     `hide_branding`. No prices, reviews, ratings or awards; no em dashes or exclamation marks.
   - QR previews rendered client-side with the installed `qrcode` package (`QRCode.create`, level H,
     4-module quiet zone, drawn as one SVG path) for `<site url>?src=card-wallet|card-room|card-desk`;
     preview sizes stay above the 18/25/40 mm minimums. The target URL is shown under each card.
   - Downloads: "Download all cards (PDF)" and one PDF per kind (`/api/site/cards.pdf?kind=...`),
     "QR as SVG" / "QR as PNG" per card (`/api/site/cards/qr.svg|png?card=...`). They are real
     links with `download`; JS fetches first, checks the Content-Type, and shows the API's message
     (or "This download is not ready on the server yet." on a bare 404) instead of saving a broken file.
   - Notice when the site is not live yet.

UI copy is English with Hindi fields (the screen's existing pattern: English owner UI, Hindi data).

## Files

New:
- `apps/web/lib/amenities.ts`: the 40 amenities (ids, en, hi), generated from the Python list.
  Contract says this file mirrors the API; a node test reads `site_details.py` and checks both match.
  If V2-API also creates it, keep one copy (content is identical to the Python source).
- `apps/web/lib/types-site-v2-owner.ts`: details, 422 problems, scans, card kinds.
- `apps/web/lib/siteDetails.ts`: pure helpers (draft <-> API, validation, 422 to plain words,
  amenity groups/search, compass, card URLs and specs, scan bars, QR path).
- `apps/web/lib/siteDetails.test.ts`: 15 node tests.
- `apps/web/components/site/details/`: DetailsEditor, AmenitiesEditor, NearbyEditor, ReachEditor,
  NotesEditor, ContactEditor, fields.tsx, detailsApi.ts, details.module.css.
- `apps/web/components/site/cards/`: CardsPanel, CardFaces (incl. QrSvg), ScansPanel, download.ts,
  cards.module.css.
- `apps/web/e2e/site-details.spec.ts`.

Changed:
- `apps/web/app/(owner)/(screens)/site/page.tsx`: two tabs, details editor mounting.
- `apps/web/app/api/[...path]/route.ts`: **BFF change**: exports `PUT` (same `forward` as the other
  methods, so same owner session, same-origin check, body cap and allowlist). Before this, PUT
  /site/details returned 405. No allowlist change needed: `site/*` was already owner, and
  `cards.pdf`, `qr.svg`, `qr.png` pass the safe-segment check. Binary responses already stream
  (`upstream.body`) with `content-type` and `content-disposition` forwarded.
- `apps/web/lib/bff.test.ts`: tests that site/details, site/scans, site/cards.pdf,
  site/cards/qr.svg and qr.png are owner routes, and that route.ts exports GET, POST, PUT, PATCH, DELETE.

## Checks (apps/web, real output)

- `npx next typegen && npx tsc --noEmit`: pass
- `npx eslint . --max-warnings=0`: pass
- `npx prettier --check . --log-level warn`: pass
- `node --test lib/*.test.ts`: tests 222, pass 222, fail 0
- `node scripts/audit-check.mjs`: "npm audit gate passed: production 0 high/critical; dev 5 high (allowlisted, reviewed)."
- `npx next build`: pass

e2e on a scratch config (web 3031, API 8031, own db file; real config untouched; scratch config removed afterwards):
- `e2e/site-build.spec.ts`: 2 passed.
- `e2e/site-details.spec.ts`:
  - edits amenities and a nearby place, saves, reloads, sees them: passed
  - invalid input (client summary, no PUT sent), real API 422 through the proxy's PUT, and a 422
    shown in plain words next to the box: passed
  - Print cards: previews, QR targets, no prices, wallet aspect ratio, scans empty state all pass;
    then **fails as expected** on `GET /api/site/cards.pdf?kind=all` -> 404, because the cards
    PDF and QR routes (helper V2-API) are not in this worktree. The test asserts the contract
    (200, application/pdf, attachment, `%PDF-`, QR svg/png types, browser download). It needs
    V2-API's work merged to pass.
  - 390 and 1440, light and dark: no sideways scroll and zero axe WCAG 2.1 AA violations on both
    tabs: passed (run alone, since the serial suite stops after the expected 404). Two contrast
    issues found by this test were fixed (Hindi label on ticked chips, "Seedha" on card backs).

## Known gaps

- PDF/QR downloads depend on V2-API's routes; until then the UI shows "This download is not ready
  on the server yet." and the Print cards e2e fails at the download step.
- Card previews are a close picture of the cards, not a render of the PDF; the exact PDF layout is
  V2-API's. The tent card preview shows one face of the A5 sheet.
- The preview QR is generated in the browser from the same URL the contract gives the API; it is
  not fetched from qr.svg (so the preview works before the API route exists).
- Owner UI labels are English only (the Website screen has no Hindi UI toggle); Hindi is for fields.
- `lib/amenities.ts` may also be created by V2-API; the lead should keep a single copy.
