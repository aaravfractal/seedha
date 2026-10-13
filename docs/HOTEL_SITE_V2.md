# Hotel Site V2 + cards brief (saved word for word from docs/OVERNIGHT.md section E, 13 October 2026)

E. STAGE 3: HOTEL SITE V2 + CARDS (only if stage 2 passed)
Branch hotel-site-v2. Save this section as docs/HOTEL_SITE_V2.md.
design/hotel-site/ and design/hotel-cards/ do not exist yet; design from
these specs with the Pine mood: pine #1F4D3A, cream #F5F1E8, stone
#E6E0D4, ink #1D1D1F, grey #6E6E73, gold #E8A33D for the perk only;
Cormorant Garamond 600 headings, Inter body, Mukta Hindi.
1. Site at /h/<slug> and <slug>.SITE_ROOT_DOMAIN: hero (photo, name,
   tagline, place, "Book directly", WhatsApp); perk ribbon when
   ?src=card-*; sticky booking pill; why book direct; rooms and packages
   with owner-set prices only; amenities from a fixed list of 40 icons
   (show 12, expand); gallery; honest empty reviews; land-only globe (no
   border lines) easing to the hotel, then an SVG local map with nearby
   places and times plus "Open in Maps" (plain link, no API key); how to
   reach; good to know; contact; footer; sticky mobile bar; EN/HI
   toggle; offline page via a small service worker.
2. Owner editors: amenities, nearby places, how to reach, good to know,
   contact.
3. Performance and SEO: static per hotel, revalidated on publish;
   responsive AVIF/WebP images; per-hotel title, description, Open
   Graph image, canonical, schema.org Hotel JSON-LD (no review markup),
   sitemap; mobile slow-4G LCP under 2.5 s, CLS under 0.1; globe under
   300 KB extra JS, lazy; Lighthouse mobile 90+ on all four scores.
4. Cards: "Print cards" generates PDFs for CR80 wallet (front and back),
   A6 in-room (front and back) and A5 tent card from hotel data; QR to
   the site with ?src=card-wallet, card-room or card-desk; level H, 4-
   module quiet zone, minimum 18/25/40 mm; 3 mm bleed, crop marks, CMYK
   table page; Seedha small on backs; browser preview; QR as SVG and
   PNG.
5. Scan counts per card type per day, no cookies, IP or device data;
   "Card scans this month" on the Website screen.
6. Public pages never call AI; strict headers and CSP; rate limits;
   input validation.
7. Tests (API, PDF, Playwright at 390 and 1440, EN and HI, Lighthouse
   saved to docs/agent-reports/hotel-site-v2/lighthouse.md), reviews,
   fixes, gates. Merge into master and deploy only if everything
   passes; otherwise leave it on hotel-site-v2 with the reason.

---

# Implementation contract (lead, for the helpers)

Every helper builds against this contract. Only the lead commits. Money:
room and package prices are the existing owner-typed or computed values; no
new money code. Public pages never call Claude.

## API (owner: helper V2-API)

Migration `0015_hotel_site_v2` (after `0014_site_real_mode`):

- `site_details`: id, property_id (unique FK), details_json Text, updated_at.
- `site_card_scan`: id, property_id (FK, index), card String(8)
  (`wallet` | `room` | `desk`), day Date, count Integer;
  unique (property_id, card, day). No IP, cookie, user agent or device data.

`SiteDetails` (Pydantic, strict, `extra="forbid"`, every string stripped,
length capped, no HTML: reject `<` and `>`):

```
amenities: list[AmenityId]            # unique, <= 40, ids from AMENITIES (fixed 40)
nearby: list[NearbyPlace]             # <= 8
  name_en str 1..60, name_hi str 0..60,
  minutes int 1..600, mode "walk" | "drive",
  kind "viewpoint"|"temple"|"market"|"waterfall"|"trek"|"lake"|"station"|"airport"|"other",
  bearing int 0..359                  # direction from the hotel, for the SVG map
how_to_reach: list[ReachItem]         # <= 6
  mode "road" | "rail" | "air", text_en 1..200, text_hi 0..200
good_to_know: list[Note]              # <= 8; text_en 1..160, text_hi 0..160
check_in "HH:MM", check_out "HH:MM"
contact: phone str (digits, +, spaces; <= 16), whatsapp (same), email (<= 120,
  simple pattern), address_en 0..200, address_hi 0..200
geo: {lat -90..90, lng -180..180} | null
```

`AMENITIES`: 40 fixed ids, each with en and hi labels, defined once in
`app/services/site_details.py` and mirrored in `apps/web/lib/amenities.ts`
(a test checks both lists match).

The sample hotel has fixed sample details (Mussoorie, geo 30.4598, 78.0664;
the four existing NEARBY places; labelled sample contact placeholders). In
production (`sample_locked`) the public page always shows the fixed sample
details, never a visitor's edits.

Routes:
- `GET /site/details`, `PUT /site/details` (owner; PUT replaces, validates).
- `GET /public/site/{slug}` adds `details: SiteDetailsOut` (same shape, plus
  each amenity's labels; contact falls back to empty strings, never the
  sample number for a non-sample hotel). Owner `GET /site` adds it too.
- `POST /public/site/{slug}/scan` body `{"card": "wallet"|"room"|"desk"}` ->
  204; increments today's (hotel's business date) row; rate limit bucket
  `site_scan` (30 a minute per client). Stores nothing about the visitor.
- `GET /site/scans` (owner) -> `{month: "YYYY-MM", total: int,
  by_card: {wallet, room, desk}, by_day: [{day, wallet, room, desk}]}`.
- `GET /site/cards.pdf?kind=wallet|room|tent|all` (owner) -> PDF built with
  reportlab from hotel data: CR80 wallet 85.6x54 mm front and back, A6
  in-room front and back, A5 tent card; 3 mm bleed, crop marks, a final
  CMYK colour table page; QR level H, 4-module quiet zone, minimum
  18 mm (wallet) / 25 mm (room) / 40 mm (tent); QR target
  `<site url>?src=card-wallet|card-room|card-desk`; "Seedha" small on backs
  (hidden when hide_branding).
- `GET /site/cards/qr.svg?card=...` and `/site/cards/qr.png?card=...` (owner).

## Web (helpers V2-PAGE, V2-GLOBE, V2-OWNER)

- Pine mood tokens for the V2 hotel page: pine #1F4D3A, cream #F5F1E8, stone
  #E6E0D4, ink #1D1D1F, grey #6E6E73, gold #E8A33D (perk only). Headings
  Cormorant Garamond 600 (bundled), body Inter (bundle woff2 + OFL in
  lib/fonts, next/font/local), Hindi Mukta (bundled).
- V2-PAGE owns `app/h/[slug]/*`, `components/site/v2/*` (except Globe/Map),
  `app/h/[slug]/opengraph-image`, sitemap, robots, the service worker and
  offline page, and the scan ping (`?src=card-*` -> one POST, then the perk
  ribbon).
- V2-GLOBE owns `components/site/v2/LocationGlobe.tsx` and
  `components/site/v2/LocalMap.tsx` (props: `geo`, `nearby`, `hotel`, `lang`;
  lazy loaded, land-only, no borders, under 300 KB extra JS, reduced motion
  skips the ease).
- V2-OWNER owns `components/site/details/*` (editors), `components/site/cards/*`
  (Print cards with browser preview, PDF and QR downloads) and "Card scans
  this month" on the Website screen.
