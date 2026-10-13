# Hotel mini-site brief (saved word for word, 13 October 2026)

FEATURE: HOTEL MINI-SITE INSIDE SEEDHA + CARD QR, THEN DEPLOY LIVE
Branch "hotel-minisite". Time box 4 hours. Save this brief to
docs/HOTEL_MINISITE.md and commit first.

HARD RULES
- No changes to money code or locked numbers. Never print secrets.
- No invented ratings, reviews, customers or awards. Prices only from
  owner input. Public pages never call AI.
- Copy: no em dashes, no exclamation marks.
- I approve pushing to GitHub for this task only, and only in the
  DEPLOY step below, after every gate passes.

SPEED AND TOKEN RULES
- Reuse what exists: /h/<slug> page, site photos, Seedha Site data,
  rooms and packages, the land-only globe, Seedha Link, the QR
  generator. Do not rebuild anything that already works.
- Plan once: write a 15-line plan with the exact file list per agent,
  then build. No exploratory reading beyond those files; use grep and
  line ranges instead of opening whole large files; never re-read a file
  you just wrote.
- Max 3 background agents, each owning a narrow, non-overlapping file
  list, so they run in parallel without merge conflicts.
- Agents return summaries under 15 lines; status files under 30 lines
  in docs/agent-reports/minisite/. No pasting code or logs into
  messages; point to files instead.
- Tests: mock every external call; each agent runs only the tests for
  its files; the full make check runs once at the end.
- No new dependencies unless essential (log why). No screenshots or
  Lighthouse until the final pass.
- Keep the session lean: commit after each agent merge and update
  docs/progress.md, so a fresh session can resume if needed.

WHAT TO BUILD
1. MINI-SITE at /h/<slug> inside the main Seedha web app (same domain,
   slim Seedha header: "Hotel Deodar View on Seedha"), mobile first:
   - Hero: photo, hotel name, tagline, town, "Book directly", WhatsApp.
   - At a glance: number of rooms, room types, check-in and check-out,
     starting price ("From ₹4,300 a night", owner-set).
   - Rooms: photo, name, size (sq ft, owner-entered), beds, max guests,
     2 features, owner-set price, "Book" through Seedha Link.
   - Amenities: owner picks from a fixed icon list; show 12, expand.
   - Location: the shared land-only globe (no border lines) easing to
     the hotel's coordinates when the section enters view, then an SVG
     local map from owner data (pin, nearby places with walk or drive
     times), address, "Open in Maps" (plain link, no API key). Reduced
     motion or no WebGL: static map only. Globe lazy-loaded.
   - Ratings (real only): verified guests (booked direct via Seedha Link
     or checked out via the Desk) get a one-time rating link (1 to 5
     stars plus an optional short comment). Show average and count only
     when at least 3 ratings exist; otherwise "New on Seedha, no ratings
     yet". Owner can hide abusive comments but not edit stars.
   - Gallery, house rules, contact, footer, sticky mobile "Book
     directly" bar, EN and HI toggle.
   - Perk ribbon when opened with ?src=card-*: "Scanned our card? Book
     direct for free breakfast." (perk from the hotel's settings).
2. OWNER EDITORS (Website screen): rooms (size, beds, max guests),
   amenities, nearby places, house rules, contact, latitude and
   longitude.
3. CARD QR: on the Website screen, "Card QR" for
   <PUBLIC_BASE_URL>/h/<slug>?src=card-wallet (plus card-room and
   card-desk), error correction H, 4-module quiet zone, download as SVG
   and PNG at print resolution.
4. SCAN COUNTS: visits per src per day only; no cookies, IP or device
   data; "Card scans this month" on the Website screen.
5. PERFORMANCE: static per hotel, revalidated on publish; responsive
   images; largest content under 2.5 s on slow 4G; globe under 300 KB
   extra JS; Lighthouse mobile 90+ (scores in
   docs/agent-reports/minisite/lighthouse.md); per-hotel title,
   description, Open Graph image, schema.org Hotel JSON-LD (no ratings
   until real).
6. SAMPLE DATA: fill Hotel Deodar View with room sizes, beds, amenities,
   nearby places and coordinates (Mall Road, Mussoorie), labelled
   sample, zero ratings. Reset demo data restores it.
7. Database changes as reversible migrations that also run on Postgres.

AGENTS
- A1 (API): fields, migrations, editor endpoints, verified-guest
  ratings, scan counts, QR endpoint, tests.
- A2 (web page): mini-site sections and states, EN/HI, perk ribbon,
  SEO.
- A3 (location and owner UI): globe and SVG map, Website screen
  editors, Card QR panel.
Then one read-only reviewer (security, privacy, honesty, accessibility,
performance). Fix high and medium findings.

GATES (all must pass)
make check, e2e once, the API suite on Postgres, the 8-step demo loop on
make demo-prod, Lighthouse mobile 90+. Report real output.

DEPLOY (only if every gate passed)
1. Record the current deploy commit as ROLLBACK_COMMIT.
2. Merge hotel-minisite into master, then master into deploy; rerun
   make check on deploy.
3. git push origin master:main and git push origin deploy.
4. Watch the Railway and Vercel deployments until both succeed (Railway
   runs migrations on start).
5. Verify live: /health on the API and through the web app; open
   https://seedha-demo.vercel.app/h/deodar-view at mobile size; run the
   8-step loop against the hosted URLs; then reset the hosted demo data
   using the hosted OWNER_API_TOKEN from Railway (never print it).
6. If any live check fails: revert deploy to ROLLBACK_COMMIT, push it,
   confirm the previous version is live again, and tell me what failed.

FINISH
Reply with a 6-line summary, Lighthouse scores, the live mini-site URL,
the QR download path, scan-count check, and either
"LIVE: deployed and verified" or "ROLLED BACK" with the reason.

---

# Plan (lead)

Base: branch hotel-site-v2 (094f093), which already has the V2 /h/<slug>
page, site details (amenities, nearby, how to reach, good to know, contact,
geo, card perk), card PDFs and QR (SVG/PNG, level H, 4-module zone), scan
counts, the land-only globe and SVG map, owner editors and SEO. Its last API
fix commit (6d20ff1, photo variants and migration 0016) is unverified: A1
verifies or fixes it first. Deltas only:

- A1 API: room details (size_sqft, beds, max_guests, 2 features, photo) in
  site details keyed by room name; sample values; card QR URL uses
  PUBLIC_BASE_URL/h/<slug>; verified-guest ratings (migration 0017
  site_rating: one-time token per direct booking or Desk checkout, 1..5
  stars, comment <= 200, hidden flag; public summary only when >= 3; owner
  list and hide); rating links on the Seedha Link confirmation and the Desk
  checkout slip (no message is sent). Files: app/services/site_details.py,
  site_cards.py, site_photos.py, new services/site_ratings.py,
  routers/site_details.py, public_site.py, new routers/ratings.py,
  link and desk slip hook lines, main.py, models.py, migrations 0016/0017,
  seed sample, tests.
- A2 web page: slim "<Hotel> on Seedha" header, At a glance, room cards with
  size, beds, guests, features and Book, ratings block and states, house
  rules label, perk ribbon wording, rating page app/rate/[token]. Files:
  components/site/v2/{HotelSiteV2,copy,hotel.module.css}, new
  components/site/v2/{AtAGlance,RoomCards,Ratings}.tsx, app/h/[slug]/*,
  app/rate/[token]/*, lib/hotelSiteV2.ts, lib/types-hotel-site.ts, e2e
  hotel-site-v2 spec.
- A3 owner UI: room details editor, ratings moderation (hide comment),
  "Card QR" panel (SVG/PNG downloads, per card), Card scans this month
  kept; globe and map reused, static map when reduced motion or no WebGL.
  Files: components/site/details/*, components/site/cards/*, new
  components/site/ratings/*, lib/siteDetails.ts, lib/types-site-v2-owner.ts,
  components/site/v2/LocationGlobe.tsx (no-WebGL fallback only),
  e2e/site-details.spec.ts.
- Then reviewer R, fixes, gates, deploy as briefed.
