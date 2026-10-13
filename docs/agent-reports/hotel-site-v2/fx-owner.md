# FX-OWNER report: owner-side fixes for Hotel Site V2

Worktree `.worktrees/fxowner`, branch `hsv2-fx-owner`, base `hotel-site-v2` eafd3b4. Not committed (the lead commits).

## Findings and changes

| finding | change |
| --- | --- |
| e2e rate limit (site-details signed in 6 times) | `e2e/site-details.spec.ts` signs in once: `beforeAll` makes one context and page, signs in and resets; every test uses that page; `afterAll` resets with it and closes. No limit changed. |
| R2-2 owner preview was V1 | `Review.tsx`: new exported `SitePreview` renders `HotelSiteV2` (from `components/site/v2/HotelSiteV2.tsx`) inside the existing inert, scaled phone and computer frames, fed by `ownerPreviewSite()` (lib/siteDetails.ts) from owner `GET /site` (which carries `details`): approved packages only, in the public shape; `published` = `live`. `preview` is passed as a spread (`{...{ preview: true }}`) so it builds before and after FX-PAGE's prop lands. Pine/Stone/Sky switch removed (V2 is Pine only); EN/HI kept ("Language guests see first"). Website header now has "Open your site" (new tab, 44 px, sr-only "(opens in a new tab)") to `site.url` when the site is live or it is the sample hotel. The sample hotel at the empty stage shows the V2 preview under "Build my site", with a local EN/HI preview switch (not saved). Saving Hotel details reloads the site so the preview shows the new facts. |
| Card perk | `card_perk_en`, `card_perk_hi` in `SiteDetailsIn`, the draft, `fromDraft` (trimmed) and `validateDraft` (0..100 letters, plain text). New `components/site/details/PerkEditor.tsx`, block "Card perk", help text "Shown on your printed cards and when a guest scans one. Leave empty if you offer none." Labels "Card perk in English" / "Card perk in Hindi (optional)"; 422 field names mapped. |
| Validation mirror (R1-10) | `textError` refuses line breaks ("Keep this on one line."), control and format characters (bidi, zero-width; `\p{Cc}\p{Cf}`), and a required field with no letter or number. Phone: ASCII digits, spaces, one leading + (unchanged regex, now tested against superscript and Arabic-Indic digits). Email: `^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$`. Text areas drop Enter and turn pasted line breaks into spaces. |
| R2-3 card previews | New pure `lib/cardLayout.ts` ports the PDF layout from `apps/api/app/services/site_cards.py` (same positions in points, Times bold / Helvetica via metric twins, colours, words, `printable()` cp1252 rule, heading fit and wrap). `CardFaces.tsx` draws each face as an SVG (`role="img"`, its printed words plus "QR code to <url>" as the label). Room QR on the front; room back "Check-in from HH:MM" and "Check-out by HH:MM" on separate lines; tent is one A5 landscape sheet with two identical faces, the upper turned 180 degrees, a dashed fold line (caption says it is not printed); no Hindi on any card; perk line = `card_perk_en` in gold, else "Book directly with the hotel" (cream on pine, pine on cream). `cardUrl` now builds the QR target exactly as the API's `card_url` (no added `/`), so the preview QR is the printed QR. CARD_SPECS tent: "A5 landscape, 210 x 148 mm, folds to 210 x 74 mm". Print cards says "Cards print in English only." and states the perk line in use. |
| R2-14 tabs at 390 | `SectionTabs` in the site page: the tab bar scrolls inside itself (never the page) with scroll-snap, a fade on the side that has more tabs (`data-more-left/right`), and the chosen tab scrolled into view horizontally only (reduced motion: no smooth scroll). |
| R2-15 sample toast | `savedNote()`: for the sample hotel, "Saved. The hosted public sample page keeps its fixed sample facts." (true locally too: it names the hosted page). Others unchanged. |

## Files

Changed: `app/(owner)/(screens)/site/page.tsx`, `components/site/Review.tsx`, `components/site/owner.module.css` (tabs, title row, open link), `components/site/cards/CardFaces.tsx`, `components/site/cards/CardsPanel.tsx`, `components/site/cards/cards.module.css`, `components/site/details/DetailsEditor.tsx`, `components/site/details/fields.tsx`, `lib/siteDetails.ts`, `lib/siteDetails.test.ts`, `lib/types-site-v2-owner.ts`, `e2e/site-details.spec.ts`.
New: `components/site/details/PerkEditor.tsx`, `lib/cardLayout.ts`, `lib/cardLayout.test.ts`.

## Tests added

- siteDetails: hidden characters and line breaks; ASCII-only phone; strict email; card perk optional/100 letters/trimmed/field names; QR target equals API `card_url`.
- cardLayout: room QR on the front and two-line stay times; tent one landscape sheet, two identical faces, upper turned, both QRs `card-desk`; no Devanagari on any card; perk in gold vs neutral line; the preview's words appear verbatim in `site_cards.py`.

## Checks (apps/web, real output)

- `npx next typegen && npx tsc --noEmit`: pass
- `npx eslint . --max-warnings=0`: pass
- `npx prettier --check . --log-level warn`: pass
- `node --test lib/*.test.ts`: tests 267, pass 267, fail 0
- `node scripts/audit-check.mjs`: "npm audit gate passed: production 0 high/critical; dev 5 high (allowlisted, reviewed)."
- `npx next build`: pass
- e2e (`site-details.spec.ts`, `site-build.spec.ts` on a scratch config, web 3061 / API 8061): **not run**. My launch used `timeout`, which macOS lacks (exit 127, nothing started), and the deadline left no time for the 4+ minute rerun. The scratch config was deleted. Expect `site-details` test 1 (save) to fail in this worktree until FX-API's `card_perk_*` fields are merged (the API forbids extra fields); run both specs after the merge.

## Depends on the other fixers (for the lead)

- FX-API: until `card_perk_en/hi` are in `SiteDetailsIn`, this worktree's API refuses the PUT (extra fields forbidden), so "save details" fails here; after the merge it passes. The neutral line "Book directly with the hotel" and "Check-in from / Check-out by" are mirrored from the contract, not yet in `site_cards.py`; add them to the `cardLayout.test.ts` words check once FX-API lands. Gold perk on the cream room front is about 1.9:1 contrast (gold on pine about 4.5:1): hard to read in print; consider the band or pine text.
- FX-PAGE: `preview` prop must also stop `document.title` changes, and V2 uses viewport media queries, so the 390 px phone frame shows the desktop layout on a wide screen (V1 used container queries). V2's `<main id="main">` duplicates the app's `#main` inside the preview (and inside `app/h/layout.tsx` on the public page).
