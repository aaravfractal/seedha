# R2 review: design, accessibility, copy honesty, function (Hotel Site V2)

Reviewer R2, 13 October 2026. Checkout: detached `hotel-site-v2` at `eafd3b4` (worktree `.worktrees/v2rev2`). No product code changed.

## How I tested

- API on 127.0.0.1:8042 with its own `r2.db` (alembic upgrade, `seed.load`). Env came from `.env.example` the same way the e2e config builds it: `SEEDHA_DEMO=1`, test secrets, AI/WhatsApp/Razorpay/proof keys empty, `WEB_ORIGIN=http://localhost:3042`.
- Web: `next build`, then `next start` on 3042 with `API_URL=http://127.0.0.1:8042`.
- I deleted `r2.db` and stopped both servers at the end.
- Playwright scripts (scratchpad only) covered:
  - viewports 390 x 844 and 1440 x 900
  - colour schemes light and dark
  - EN and HI
  - axe with tags wcag2a, wcag2aa, wcag21a, wcag21aa and wcag22aa
  - sideways scroll, tap targets under 44 px, clipped and overflowing elements, the order of the h2s, the fonts that loaded, keyboard focus, `reducedMotion` reduce and no-preference, offline via `context.setOffline`
  - the owner Website tabs: edit, save and reload; error summary; PDF and QR downloads; scans count
- PDF pages were rendered to PNG with pdfplumber in the API venv.

## Summary

The public page is in good shape on the hard checks:
- Every section in the brief is present and in the brief's order.
- 0 axe violations in any of the 8 combinations (390/1440, light/dark, EN/HI).
- No sideways scroll and no tap target under 44 px on the hotel page.
- No clipping.
- Fonts load and resolve correctly: Cormorant 600, Inter 400/600, Mukta 400/600/700 for Hindi.
- The perk ribbon appears only for a valid `?src=card-*`. `card-x` gives no ribbon. The visit sends one scan POST and `src` is then removed from the address.
- Amenities show 12, then expand to 20 (all the sample hotel has).
- The globe is land only with no borders, eases to the hotel, and with reduced motion is already centred at 500 ms.
- The local map shows places and times, plus "Open in Maps" (new tab, 44 px).
- The offline page works from the service worker.
- Prices are exactly the API's paise / 100: 620000 is shown as ₹6,200, 430000 as ₹4,300, 340000 as ₹3,400.
- No em dashes, exclamation marks, reviews, ratings or awards in any new file.

The main problems:
- **Honesty of the perk promise.** The ribbon and the cards promise a perk that the page cannot deliver.
- **Owner preview versus the public page.** The owner never sees V2. The owner can also pick moods that V2 ignores.
- **The cards' PDF does not match its browser preview.** The colour also prints as teal rather than pine.

## Findings

| id | severity | where | problem | concrete fix |
| --- | --- | --- | --- | --- |
| R2-1 | high | `apps/web/components/site/v2/copy.ts:16,54` (perk ribbon); `apps/api/app/services/site_cards.py:76` (`PERK_LINE` on wallet front, room front, tent) | The ribbon says "Book your next stay directly here and enjoy a returning-guest perk". The cards say "Book direct: a welcome perk for returning guests". But a guest who scans and books through the page goes to `/link` with no perk code. Seedha Link then records "No perk code, so no saving is claimed" (`app/(app)/link/page.tsx:30-32`), so nothing gives the guest a perk. Perks exist only through the owner-approved WhatsApp code (CLAUDE.md rules 6 and 7), so this implies a feature that does not exist. | Change the wording so it promises nothing automatic. Ribbon EN: "Thank you for staying with us. Book your next stay directly with the hotel. Returning guests get a perk from the owner." Ribbon HI to match. Card `PERK_LINE`: "Book direct with the hotel next time". Alternatively, keep the promise only once there is a real path: the owner sets a card perk and Seedha Link applies it from the `src`. |
| R2-2 | high | `components/site/Review.tsx:260` (owner preview uses V1 `HotelSite`); `components/site/v2/HotelSiteV2.tsx` (ignores `site.mood`) | The owner's preview on the Website screen is V1, while `/h/<slug>` is V2. In practice: (a) the owner never sees the amenities, globe, map, how to reach, good to know, contact or perk they edit in "Hotel details". (b) Review still offers Pine/Stone/Sky, but V2 always renders Pine, so a hotel that picks Stone or Sky publishes something other than what it approved. (c) For the sample hotel the Site tab is the empty "Build my site" state, and no screen links to `/h/deodar-view` at all. This is confusing at the exact moment of "check every line, then publish". | Smallest fix: in `Review.tsx`, render `HotelSiteV2` in place of `HotelSite`. It takes a `HotelSitePayload`, and owner `GET /site` already includes `details`. Wrap it in a non-interactive container with `inert` so the scan ping, the service worker and the booking form stay off. Hide the mood switch until V2 supports moods, or make V2 honour `site.mood`. Add an "Open your site" link (`site.url`) to the Website header and to the Hotel details save bar. |
| R2-3 | medium | `apps/web/lib/siteDetails.ts:417`, `components/site/cards/CardFaces.tsx` versus `apps/api/app/services/site_cards.py` | The Print cards preview is not what prints. Specifically: <br>- **Tent card:** the preview is portrait "A5, 148 x 210 mm" with one face. The PDF is A5 landscape, folded into two 210 x 74 mm faces (shot `pdf-p4.png`). <br>- **In-room card:** the preview puts the QR on the back. The PDF puts the QR on the front, and the back has stay, nearby, good-to-know and contact text (`pdf-p2.png`, `pdf-p3.png`). <br>- **Wallet card:** the preview front has the Hindi name. The PDF has no Hindi. <br>- **Headlines differ:** "Book direct next time" versus "Scan to book direct", and "Come back and book direct" versus "Your next stay, booked direct". <br>- **Fonts:** the preview uses Cormorant; the PDF uses Times-Bold and Helvetica. | Make one layout source the truth. Quickest: render the preview from the PDF itself, either as an `<object>`/`<iframe>` of `/api/site/cards.pdf?kind=…` or as PNGs rendered server-side per page. Otherwise, change the tent spec to 210 x 148 landscape with two faces, move the room QR to the front, drop the Hindi from the preview while the PDF cannot print it, and use the same headline strings, ideally from one shared constant. |
| R2-4 | medium | `apps/api/app/services/site_cards.py:182` `cmyk_of` | Pine #1F4D3A becomes "C60 M0 Y25 K70" by naive device conversion. Rendered (pdfium via pdfplumber), the cards come out teal (about #13575A), not pine (`pdf-p0.png`, `pdf-p2.png`, `pdf-p4.png`). Real presses go the same way: no magenta means no warm cast. The browser preview shows true pine, so the owner approves one colour and prints another. Ink at K88 also prints the QR modules as a dark grey (#3C3C44 rendered). | Hand-pick print values instead of computing them. Pine about C80 M35 Y75 K40 (check against a coated-stock proof). Cream about C3 M4 Y10 K0. Gold about C5 M40 Y85 K0. Draw QR modules in K100 (or a rich black 40/30/30/100) for scan contrast. Keep the "ask for a proof" note. |
| R2-5 | medium | perk ribbon `hotel.module.css:288` over hero `.chip` | When the ribbon shows (`?src=card-*`), it sits over the "Sample photo" chip at the top right (shots `perk-390-en.png`, `perk-390-hi.png`). So the sample label (rule 11) is hidden on exactly the screens that scanned guests see. | Move the ribbon below the header inside the hero but under the chip (for example `top: 56px`), or limit its width so the chip stays clear. Alternatively, place the chip bottom-right when a perk is shown. |
| R2-6 | medium | `apps/web/app/sitemap.ts:31`; `app/h/[slug]/page.tsx` metadata; JSON-LD | The fictional sample hotel is in the sitemap and indexable, with schema.org `Hotel` JSON-LD: name "Deodar View", Mall Road Mussoorie, a geo position and 20 amenities. The JSON-LD carries no sample label (only the address string says "(sample address)"). Search engines could list a hotel that does not exist, which is at odds with rule 11. | For `site.sample`, set `robots: { index: false, follow: false }`, leave it out of `sitemap.ts`, and skip the JSON-LD (or keep JSON-LD only for non-sample hotels). |
| R2-7 | low | `hotel.module.css:61-64` | The focus ring is gold on the hero and the mobile bar. The brief keeps gold "for the perk only". It is visible (3 px, good contrast on pine), but it uses the reserved colour. | Use cream `#F5F1E8` for the focus outline on dark surfaces. Keep pine on light surfaces. |
| R2-8 | low | `components/site/v2/HotelSiteV2.tsx:331,372,739` | "Book" means different things. The header pill and the mobile bar's Book scroll to the booking form, but the hero "Book directly" jumps straight to Seedha Link with default dates and the first room. A guest pressing the most visible button skips choosing dates and room. | Point the hero "Book directly" at the `#book` form as well, or label it "Book directly: choose dates". |
| R2-9 | low | `HotelSiteV2.tsx:448` | On the Hindi page the main submit button reads in English: "Book direct · Powered by Seedha". The lang attribute is correct, but a Hindi-only reader has no Hindi label on the one button that books. | Use `c.bookShort` ("बुक करें") as the main label and keep "Powered by Seedha" small after it. |
| R2-10 | low | `apps/web/lib/localMap.ts:283` versus `components/site/v2/copy.ts` `openInMaps` | The Hindi link label is "मैप्स में खोलें" in LocalMap and "मैप में खोलें" in the page copy. Only one shows at a time, but the strings drift. | Keep one string, and import it from `copy.ts` or from `localMap.ts`. |
| R2-11 | low | local map label placement (`location-*.png`) | The "30 min drive" label under Kempty Falls sits on the drive line from the hotel to Kempty Falls. The halo keeps it readable, but it reads as struck through. | Add a place's own line segment as an obstacle in `placeLabels`, or nudge labels away from their own line. |
| R2-12 | low | globe first frame | When the section scrolls in quickly, the first frames show a blank stone disc with the marker near the edge (full-page shot `crop-390-light-en-3.png`), until the land chunk arrives. | Draw the start frame centred on the hotel at zoom 1 while the land loads. Better: prefetch the land chunk once the section is near (`rootMargin` 100%), as the component chunk already is. |
| R2-13 | low | `apps/api/app/services/site_cards.py:496` | The room-card back reads "Check-in 12:00  Check-out 11:00", and the double space is lost in the PDF text, so it prints as one run-on line (`pdf-p3.png`). | Use two lines, or "Check-in 12:00 · Check-out 11:00" (the preview's form). |
| R2-14 | low | owner tabs at 390 (`crop-owner-Hotel_details-390-light-0.png`) | The five tabs scroll sideways inside their bar. "Print c…" is cut and "Google kit" is off screen, with no scroll hint. | Wrap the tabs onto two rows under 480 px, or add an edge fade and `scroll-snap`. |
| R2-15 | low | Hotel details save | After saving the sample hotel, the toast says "Saved. Only you see it until you publish." But the public sample page (which is reachable at `/h/deodar-view`) keeps showing the fixed sample details, by design. The owner cannot see their saved nearby place anywhere, because the preview is V1 (see R2-2). | Once R2-2 lands, the preview shows the saved details. For the sample hotel, also add "The public sample page keeps the fixed sample facts." |
| R2-16 | info | public page | There is no dark theme on the public page; it is always light Pine. Dark-scheme runs were identical and axe-clean. This is acceptable for a hotel brand page; noted only because the task asked. | None needed. |

## Checks that passed

- **Section order at 390 and 1440, EN and HI:** hero (place, name, tagline, Book directly, WhatsApp), Book your stay, Why book direct, Rooms, Packages (an honest "coming soon" for the sample), Amenities, Photos (labelled sample), Guest reviews ("No reviews yet."), Location (globe, then map, list and Open in Maps), How to reach, Good to know, Contact (with a placeholder note), footer ("Sample hotel. All details are fictional." / "Built with Seedha").
- **Sticky parts:** the header stays at top 0 after scrolling, with the Book pill at 1440. Under 720 px the mobile bar (Call / WhatsApp / Book) is a 72 px grid and is hidden at 1440. The page reserves bottom padding for it.
- **axe (WCAG 2.0/2.1/2.2 AA):** 0 violations on the public page in all 8 combinations, and on the owner Site, Hotel details and Print cards tabs in light and dark at both widths.
- **Keyboard:** "Skip to content" exists. Focus outlines are 3 px solid on every stop I checked, including the EN/HI buttons (`aria-pressed`), the hero links and the form inputs.
- **Hindi:** Mukta 700 headings and Mukta 400 body render correctly, conjuncts look right (व्यू, ट्रेन, घंटा), and nothing is clipped. The hotel name switches to देवदार व्यू.
- **Offline:** with the network off, a reload shows the name, place, phone, WhatsApp, address, the sample label and "Try again", in both languages.
- **Owner Hotel details:**
  - I ticked Yoga, added a fifth place "Bhatta Falls" by compass (W, 270 degrees) and saved. After a reload both were still there.
  - Minutes 0 gives the summary "Fix this to save: Nearby place 5, minutes: Use 1 to 600 minutes." and sends no PUT.
  - The demo reset restored the sample.
- **Print cards:**
  - Scans after visiting `?src=card-room` (twice) and `?src=card-wallet` read: total 3, wallet 1, room 2, desk 0, all on 13 Oct.
  - The PDF (all, wallet, room, tent) and QR (SVG, PNG for each card) downloads return 200 with the right types and `attachment` file names. The UI button downloads `deodar-view-cards-all.pdf`.
  - The PDF has 3 mm bleed (pages measure 91.6 x 60 mm and 111 x 154 mm), crop marks, "Sample card: fictional hotel" on every card page, "Seedha" small on the backs, no prices, and a colour table page.
  - The QR on the tent sits on a cream panel, with the upper face rotated 180 degrees for the fold.

## Screenshots

All are in `/private/tmp/claude-501/-Users-aaravsharma-Projects-seedha-real/9d04038f-5044-4db6-bda6-66bccd7b848a/scratchpad/r2/shots/` (scratchpad, not committed):

- **Public page:** `public-{390,1440}-{light,dark}-{en,hi}-{top,full,mid}.png` and crops `crop-{390,1440}-light-{en,hi}-N.png`
- **Perk:** `perk-390-en.png`, `perk-390-hi.png`
- **Amenities and focus:** `amenities-expanded-390.png`, `focus-1.png`, `focus-6.png`
- **Globe and map:** `location-reduce-t500.png`, `location-reduce-t3000.png`, `location-no-preference-t500.png` (mid-ease), `location-no-preference-t3000.png`, `location-390-en.png`, `location-390-hi.png`
- **Offline:** `offline-390.png`
- **Owner screens:** `owner-{Site,Hotel_details,Print_cards}-{390,1440}-{light,dark}.png`, `owner-details-edited.png`, `owner-details-error.png`, `owner-cards-1440.png`
- **PDF pages:** `pdf-p0.png` (wallet front), `pdf-p1.png` (wallet back), `pdf-p2.png` (room front), `pdf-p3.png` (room back), `pdf-p4.png` (tent), `pdf-p5.png` (colour table)
