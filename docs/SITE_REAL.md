# Seedha Site real mode brief (saved word for word, 12 October 2026)

FINAL FEATURE: SEEDHA SITE REAL MODE + HOTEL ADDRESSES, THEN PRODUCT READY
Work on branch "site-real" from master. Time box: 5 hours. Merge into
master and deploy only after every gate passes. No changes to money code
or locked numbers. Never push; I push. Never print secrets. Check
docs.claude.com for current model names, image input format, prompt
caching and pricing; do not guess. Save this brief to
docs/SITE_REAL.md and commit first.

TEAM (only the lead commits; max 3 background agents; own worktrees;
status files in docs/agent-reports/site-real/; summaries only)
WAVE 1 RESEARCH (read-only): R1 the existing Website screens (Site,
Packages, Google kit), /h/ hotel pages, storage, Claude client and D6
guard. R2 Next.js middleware for subdomains and cookie scoping.
WAVE 2 BUILD: B1 upload, storage and generation API (section 1 to 3).
B2 setup and review UI (section 4). B3 hotel addresses and sharing
(section 5).
WAVE 3 TEST: T1 API tests; T2 Playwright.
WAVE 4 REVIEW (read-only): V1 security and privacy; V2 cost and honesty;
V3 design and accessibility.
WAVE 5 FINISH (lead): section 7.

1. UPLOAD AND STORAGE (B1)
- Owner uploads 4 to 8 photos: JPEG, PNG, WebP, HEIC (convert), max
  10 MB each before processing. Resize to max 1024 px on the long side,
  compress to about 200 KB, strip all EXIF including location.
- Store photos and generated content per property in Postgres (or a
  Railway volume if clearly better; explain the choice). Production disk
  is ephemeral, so nothing may live only on local disk.
- Only the logged-in owner can upload, generate, edit or publish.

2. GENERATION (B1), LEAN BY DESIGN
- Inputs: the resized photos, the owner's description text, room types
  with prices typed by the owner, hotel name and town.
- One Claude call per generation with EVENT-style economy:
  SITE_GEN_MODEL env (a cheaper, capable model from the docs), short
  system prompt (under 150 words) marked for prompt caching if
  supported, small max_tokens, strict JSON only:
  description_en, description_hi, room_blurbs (per room, EN and HI),
  photo_order with captions (EN and HI, max 8 words each),
  why_book_direct (3 points, EN and HI), google_description (EN and HI,
  max 750 characters each). No prose, no markdown.
- Guard D6: reject any output containing rupee amounts, prices or
  numbers with 3 or more digits; fall back to template text for that
  field. Prices on the site come only from what the owner typed.
- Limits: max 3 generations per property per day, a monthly token cap
  (SITE_GEN_MONTHLY_TOKEN_CAP), store input/output tokens per run, show
  them in Settings with month-to-date totals. Without a key, keep the
  existing sample flow labelled "Sample".

3. VOICE INPUT (B1 API side none; B2 UI)
- Mic button using the browser's built-in speech recognition (hi-IN and
  en-IN) that fills the description box. Typed fallback where not
  supported. No audio is uploaded or stored.

4. SETUP AND REVIEW UI (B2)
- Website screen: replace "Start on WhatsApp" with "Build my site" and a
  small note "Coming soon: build on WhatsApp".
- Setup steps: photos, describe (mic or type), rooms and prices,
  Generate (with progress state), Review.
- Review: existing moods (Pine, Stone, Sky) and EN/HI toggle, every
  generated field editable, photo reorder, "Regenerate" (counts toward
  the daily limit, with a confirm "This uses AI credit").
- Publish: owner picks the address slug (prefilled from the hotel
  name); live preview before publishing; nothing is public until
  Publish.

5. HOTEL ADDRESSES AND SHARING (B3)
- SITE_ROOT_DOMAIN env (empty by default). When set, published sites
  are served at <slug>.<SITE_ROOT_DOMAIN> via Next.js middleware;
  otherwise at /h/<slug>. Locally, <slug>.localhost:3000 must work.
- Slug rules: lowercase letters, numbers, hyphens, 3 to 40 characters,
  unique, reserved words blocked (www, app, api, admin, mail, docs,
  status); renaming redirects the old slug for 30 days. Unknown or
  unpublished slugs show "This hotel site isn't live yet".
- After Publish show the address with Copy, "Share on WhatsApp" (a
  standard wa.me share link with a prefilled message, no WhatsApp API),
  and a QR code image the owner can download for the checkout slip.
- Branding on hotel pages: footer "Built with Seedha" and "Book direct ·
  Powered by Seedha" on the booking button; a Pro setting can hide them.
- Hotel pages are public and read-only, never trigger AI calls, and owner
  cookies are scoped to the app host only.
- docs/HOSTING.md gets a "Custom domain" section: buy the domain, add it
  and the wildcard in Vercel, the DNS records, set SITE_ROOT_DOMAIN on
  Vercel and Railway, redeploy, test.

6. TESTS (T1, T2) AND REVIEWS (V1 to V3)
- T1 (Claude mocked): prices come only from owner input; D6 rejection
  and template fallback; daily and monthly limits stop calls; token
  logging; upload type and size limits; EXIF stripped; owner-only
  access; slug rules, reserved words, uniqueness, redirect.
- T2 Playwright: build flow (upload, describe, rooms, generate mocked,
  edit, publish), public page at /h/<slug> and <slug>.localhost:3000,
  Copy and Share on WhatsApp link, QR download, the 8-step demo loop
  unchanged.
- V1 security and privacy, V2 cost and honest labels, V3 design and
  accessibility at 390 and 1440, light and dark. Fix every high and
  medium finding.

7. FINISH AND PRODUCT READY (lead)
- make check, e2e three times in a row, API suite on Postgres if
  possible, the 8-step loop on make demo-prod. Report actual output; if
  the network fails, say so and retry.
- Merge site-real into master, then master into deploy; rerun make
  check on deploy; fast-forward so master and deploy match.
- Reset demo data. Update README.md (features, real vs simulated),
  README-dev.md, docs/HOSTING.md and docs/progress.md.
- Reply with: what was built (one line each), gates (one line each),
  token use of one real generation if I run it (leave a blank line for
  it), new env variables for Railway and Vercel (names only), the
  1-minute live test, and end with exactly:
  "READY: safe to push deploy and master."
