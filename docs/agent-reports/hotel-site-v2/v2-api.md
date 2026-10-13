# V2-API: printable cards and QR routes

Helper V2-API, worktree `.worktrees/v2api`, branch `hsv2-api`. Not committed (the lead commits).

## What I built

- `apps/api/app/services/site_cards.py` (new): pure functions, no database.
  - `cards_pdf(data, kind)` builds the PDF with reportlab:
    - CR80 wallet card, 85.6 x 54 mm, front and back pages.
    - A6 in-room card, 105 x 148 mm, front and back pages.
    - A5 tent card, 210 x 148 mm, on one page (see decisions).
    - A final A4 page titled "Print colours". It lists each colour with its hex, its CMYK values, and what it is used for.
  - Every card page is the trim size plus 6 mm, so there is 3 mm of bleed on each side. Backgrounds run into the bleed. Crop marks sit in the bleed, 1 mm clear of the trim: a white 0.8 pt line under a 0.25 pt registration line, so they show on pine and on cream. The tent page also has fold ticks at its centre line.
  - All fills on the cards use `CMYKColor`. The CMYK values are converted from the brand hex by `cmyk_of`, a plain device conversion: pine C60 M0 Y25 K70, cream C0 M2 Y5 K4, stone C0 M3 Y8 K10, ink C6 M6 Y0 K88, grey C4 M4 Y0 K55, gold C0 M30 Y74 K9. The table page tells the owner to ask the printer for a proof.
  - QR codes use level H and a 4-module quiet zone. The QR is drawn in ink on a cream panel, and the panel is the quiet zone.
    - Drawn symbol sizes, without the quiet zone: wallet 20 mm (minimum 18), room 30 mm (minimum 25), tent 42 mm (minimum 40).
    - Targets are `<site url>?src=card-wallet`, `card-room` and `card-desk`. The tent card uses `card-desk`.
  - Card text comes only from existing site data: hotel name, location, tagline, display address, phone, WhatsApp, email, address, check-in and check-out times, nearby places with minutes, and good-to-know notes.
    - The gold perk line is the fixed sentence "Book direct: a welcome perk for returning guests". It has no amount.
    - Cards carry no prices, packages, reviews, ratings or awards, and the copy has no em dashes or exclamation marks.
  - The sample hotel's card pages each say "Sample card: fictional hotel" in small type (rule 11).
  - "Seedha" appears small on the wallet back, the room back and the tent's rear face. It is left off when `hide_branding` is on. The PDF author field is the hotel's name, never "Seedha".
  - `qr_svg(text)` and `qr_png(text)`:
    - SVG: one unit per module, quiet zone included, `crispEdges`, with the target URL in `<title>`.
    - PNG: black on white, drawn with Pillow from the encoder's module matrix, at least 1024 px (an integer number of pixels per module).
- `apps/api/app/routers/site_details.py`: three owner-only routes, using `OwnerDep` and `PropertyDep` like the others.
  - `GET /site/cards.pdf?kind=wallet|room|tent|all` (default `all`) returns `application/pdf`. The response has `Content-Disposition: attachment; filename="<slug>-cards-<kind>.pdf"` (for example `deodar-view-cards-wallet.pdf`) and `Cache-Control: no-store`.
  - `GET /site/cards/qr.svg?card=wallet|room|desk` returns `image/svg+xml`.
  - `GET /site/cards/qr.png?card=wallet|room|desk` returns `image/png`.
  - The query parameters are `Literal` types, so a bad or missing value gives 422. The card data comes from `routers.site.site_content(..., public=False)`, which is the owner's view and includes the site URL, `hide_branding` and details.
- `apps/api/tests/test_site_v2_cards.py` (new): 26 tests.
- `apps/api/tests/test_site_real_t1.py`: added the three new routes to `SITE_ROUTES`. That test already checks 401 without a token and 403 for demo or other subjects.
- `apps/api/tests/test_route_auth.py`: added `("POST", "/public/site/{slug}/scan")` to the known public set. **This fixed a failure that was already there**: the lead's foundation commit a042dd7 added the public scan route but did not classify it, so `test_every_owner_route_needs_the_owner_token` failed with a 422. I did not cause this failure; please check the fix is the classification you intended.

## Decisions

- **Tent layout:** one A5 landscape page, folded along its horizontal centre line into a tent. It has two identical 210 x 74 mm faces, each with its own 42 mm QR. The upper face is turned 180 degrees so both faces read upright once the card stands. Fold ticks are in the bleed at the centre line, and the colour page explains the fold.
- **Fonts:** I used the PDF built-in fonts: Times-Bold stands in for Cormorant headings and Helvetica is the body font. The repo has no Devanagari TTF (Mukta is bundled only as woff2, which reportlab cannot embed), and I downloaded nothing. **So the cards print no Hindi.** `printable()` drops any field the built-in fonts cannot draw, so nothing prints as boxes. If the hotel name cannot be printed, the display address is used instead.
- **Long names:** a hotel name (up to 60 characters) first shrinks to fit one line. If it still does not fit, it wraps onto two lines that grow upwards. A test checks that no character falls outside the trim with very long text.
- **QR library:** neither `segno` nor `qrencode` is installed, and `renderPM` is unavailable because there is no rlPyCairo or `_rl_renderPM`. So I used the encoder in `reportlab.graphics.barcode.qrencoder` directly. I read the installed source: `QRCode(None, QRErrorCorrectLevel.H)` gives the module matrix. PDF, SVG and PNG are all drawn from that one matrix: canvas rects, an SVG path, and Pillow.
- **QR decoding in tests:** no decoder is installed (no zbar, zxing or OpenCV). The tests instead check three things:
  - the PNG, sampled at each module centre, equals the encoder's matrix for the exact `?src=` URL, and its quiet zone is all light;
  - the error correction level read back from the symbol's own format-information bits is H;
  - the SVG `<title>` is the exact target URL.
- **Minimum size** is measured from the PDF: the bounding box of the ink rects on each QR page, using pdfplumber. It is at least 18, 25 or 40 mm and square.

## Check results (from apps/api)

- `ruff check .`: All checks passed.
- `ruff format --check .`: 165 files already formatted.
- `mypy app seed tests migrations/env.py`: no issues in 164 files.
- `pylint app seed migrations/env.py --fail-under=9.5`: 9.98/10. My files score 10.00; the remaining messages are in other modules.
- `pylint tests --disable=missing-function-docstring --fail-under=9.5`: 9.99/10.
- `bandit -c pyproject.toml -r app seed -q --severity-level medium`: exit 0, no issues.
- `pytest -q -p no:cacheprovider` (full suite, with `--cov`): exit 0, no failures. Total coverage is 98.40%, above the 85% required. `app/services/site_cards.py` has 99% coverage and `app/routers/site_details.py` has 100%. The new file `tests/test_site_v2_cards.py` has 26 tests and all pass.

## Left for others

- The browser preview and the download buttons belong to V2-OWNER (`components/site/cards/*`).
- If a Devanagari TTF is ever bundled (for example Mukta in TTF under its OFL licence), Hindi could be added to the cards with `registerFont`. Reportlab would also need shaping support for Devanagari conjuncts to print correctly, which needs checking first.
