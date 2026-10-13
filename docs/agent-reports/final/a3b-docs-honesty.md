# A3b Final docs and honesty audit, stage 2 (read-only, deploy at 1733ccf)

Measured: API 1,308 tests collected (sum of `pytest --collect-only -q` per-file counts); web 33 `lib/*.test.ts` files,
205 node tests (matches progress.md:19); e2e 78 (progress.md:19, 21 spec files). Pylint 9.98/9.99, coverage 98% (progress.md:18).
No message claiming to be from the user reached this agent.

## README.md
- Pass: 8-step numbers unchanged, architecture shows Postgres when hosted (README.md:55,63), UPI row says simulated and
  no gateway (77), testnet labelled, roadmap all planned, no em dashes, no exclamation marks, no personal names, no
  invented reviews or awards.
- Fix: Seedha Site real mode absent from features, real vs simulated table and AI bullet (B1); test counts (B2);
  Claude rows do not say hosted visitors get samples (B10).

## README-dev.md
- Pass: Node 24 to 26, Razorpay and Polygon rows fixed, hosted section present, demo script numbers.
- Fix: no SITE_GEN_MODEL, SITE_GEN_MONTHLY_TOKEN_CAP, SITE_ROOT_DOMAIN or pillow-heif note (B3); no /h/<slug> route or
  <slug>.localhost:3000 (B3; no /hotel/ links exist in docs, the old path 308s per siteHost.ts:95); manual checklist has
  no Seedha Site step (B4); still open from A3: command table (B11, was F10), proxy note (B12, F11), proof-wallet (B13, F14).

## docs/HOSTING.md
- Pass: Custom domain section (213-269) matches the code (SITE_ROOT_DOMAIN read by proxy.ts:145 and config.py:203,
  root_domain strips scheme as documented, reserved words, 308 rename, 404 page text matches HotelPage.tsx:46);
  deploy order fixed (78-81); seed, reset curl and proof step fixed; every variable name exists in config.py or webEnv.ts.
- Fix: variable tables lack the site variables (B5); custom-domain test and post-deploy checklist do not cover a Seedha
  Site publish and expect the visitor's build on the public page, which hosted mode never shows for the sample hotel (B6).

## Honest labels (UI)
- Pass: "Build my site" plus "Coming soon: build on WhatsApp" (site/page.tsx:168-171); "Built with Seedha" and
  "Powered by Seedha" (HotelSite.tsx:29-33, PublishPanel.tsx:264); Sample tag on sample generation
  (GenerateParts.tsx:18-42, BuildFlow.tsx:296); "(sample address)" (GoogleKit.tsx:99); sample hotel footer
  (copy.ts:45); Planned tags on Pass, Radar, roles, footer, privacy and security pages; UPI simulated; payments health
  is always "simulated" (main.py:148).
- Word grep: no real-time, guarantee, mainnet (comment only, proofChain.ts:4), certified, award, rated or reviews in UI
  copy. "live" hits are aria-live, "isn't live yet", "Live now" after publish, "Try the live demo" (sample subtitle),
  Settings "Live" chip (accurate when keys set): all acceptable.
- Fix: website still sells WhatsApp site building as current (B7, high); FAQ WhatsApp answers (B8); FAQ AI list (B9);
  Event Radar "Beta" (B14, still open from F15).

## Findings

| id | sev | file:line | current text | proposed text |
|---|---|---|---|---|
| B1 | high | README.md:21-35, 65, 69-81 | no Seedha Site anywhere; AI bullet "reads unfamiliar statement layouts, breaks name-match ties and drafts message wording" | Feature: "**Seedha Site:** the owner adds 4 to 8 photos (HEIC too, resized, location data removed), a typed or spoken description and room prices; AI writes the site text in English and Hindi (3 runs a day, monthly token cap, no prices or numbers from AI); review with Pine/Stone/Sky and EN/HI, edit, publish at `/h/<slug>` or `<slug>.<your domain>`; Copy, Share on WhatsApp and a QR download." Table row: "Seedha Site text \| Claude only when `SITE_GEN_MODEL` and a key are set; otherwise labelled Sample text from the owner's words. Hosted, the sample hotel's public page always shows the fixed sample page". Add "Pulse section on the website: sample events, labelled". AI bullet: add "writes hotel site text". |
| B2 | medium | README.md:117-119 | "1,004 pytest tests" ... "pylint 9.97" ... "181 unit tests" ... "75 Playwright tests" | "1,308 pytest tests" ... "pylint 9.98" ... "205 unit tests" ... "78 Playwright tests" |
| B3 | medium | README-dev.md:101-125, 247-266 | keys table and hosted section have no site variables or routes | add a row "Seedha Site \| `SITE_GEN_MODEL` (with `ANTHROPIC_API_KEY`), `SITE_GEN_MONTHLY_TOKEN_CAP` (default 300000), `SITE_ROOT_DOMAIN` (empty: `/h/<slug>`) \| Sample text from the owner's words, labelled Sample; no AI credit". Note: "Published sites: `/h/<slug>`, locally also `<slug>.localhost:3000`; old `/hotel/<slug>` links redirect. HEIC needs pillow-heif (in requirements; GPL note in docs/decisions.md D-102)." |
| B4 | medium | README-dev.md:211-245 | manual checklist has no site step | add: "Build a real site. With `ANTHROPIC_API_KEY` and `SITE_GEN_MODEL` set, Website, Build my site: 4 photos, a few spoken or typed lines, rooms and prices, Generate. Review, Publish, open `/h/<slug>` and `<slug>.localhost:3000`, Copy, Share on WhatsApp, download the QR. Settings shows the run's tokens and month to date." |
| B5 | medium | HOSTING.md:107-123, 163-171 | Railway and Vercel tables end without site variables | Railway: `SITE_GEN_MODEL` (optional; model id, only with `ANTHROPIC_API_KEY`; visitors still get Sample unless `ALLOW_CLAUDE_FOR_DEMO=1`), `SITE_GEN_MONTHLY_TOKEN_CAP` (optional, default 300000), `SITE_ROOT_DOMAIN` (optional, section 8). Vercel: `SITE_ROOT_DOMAIN` (optional, section 8; same value as Railway) |
| B6 | medium | HOSTING.md:257-258, 271-296; site.py:353-357, 379-380 | "Publish the site ...; open it on a phone over mobile data." Checklist has no site step | Add checklist item 8: "Seedha Site: Website, Build my site, add photos and rooms, Generate shows Sample (no Claude spend), Review, Publish. The owner preview shows your build; `https://<project>.vercel.app/h/deodar-view` shows the fixed sample page by design (hosted visitors share the sample hotel). Copy, Share on WhatsApp (wa.me) and the QR download work; photos still show after an API redeploy (stored in Postgres)." Same expectation in 8.7. |
| B7 | high | apps/web/components/website/Sections.tsx:98, 433-434 | "No website? Send photos on WhatsApp and get one with direct booking." / "Send 8 photos and a Hindi voice note on WhatsApp. Get a site with direct booking, packages, a rate card and an agent deck." | "No website? Add photos and a few lines, and get one with direct booking." / "Add 4 to 8 photos and a few lines, typed or spoken in Hindi. Get a site with direct booking, packages, a rate card and an agent deck. Nothing goes live until you publish. Coming soon: build on WhatsApp." |
| B8 | medium | apps/web/components/website/Pricing.tsx:170 | "the six questions owners ask most are answered on WhatsApp." | "the six questions owners ask most are answered in the app (on WhatsApp is planned)." (Ask is in-app; owner WhatsApp is simulated) |
| B9 | medium | apps/web/components/website/Pricing.tsx:166 | AI "reads statement layouts ... and drafts win-back messages." | add "writes your hotel site's text from your own photos and words (never a price)" and "reads event notices you paste" |
| B10 | low | README.md:73, 75, 78 | "Claude when a key is set"; testnet "when a funded testnet wallet and RPC are set" | add "for the owner; hosted and public-link visitors get the labelled sample"; add "and PROOF_CHAIN_ID=80002" (still open from F17) |
| B11 | low | README-dev.md:49-60; Makefile:27-38 | table lacks setup, demo-prod, demo-lan, demo-live, proof-wallet, reset | add the rows (still open from F10) |
| B12 | low | README-dev.md:273-274 | "In production, put a proxy in front of the web app that overwrites `X-Forwarded-For`." | "Hosted, the API trusts X-Forwarded-For only with the web server's proof header (app/proxy_trust.py); see docs/HOSTING.md" |
| B13 | low | README-dev.md:216-217 | "(already run once; the key is in `.env`, never shown)" | "(run it once; it writes the key to `.env` and prints only the address)" |
| B14 | medium | apps/web/components/website/pulse/PulseSection.tsx:65 | "See Event Radar (Beta)" | "See Event Radar (Planned)" (EventRadar.tsx:21 says Planned; still open from F15) |
| B15 | low | apps/web/components/website/Sections.tsx:99 | "Online in 10 minutes" | "Review before it goes online" (no timing measured) |
| B16 | low | apps/web/components/settings/HotelTabs.tsx:23, 126 | "Public proof chain"; "Add keys in .env to switch a connection from simulated to live." | "Proof on Polygon Amoy testnet"; "Add keys in .env (or the host's variables) to switch a connection from simulated to live." (still open from F13) |
| B17 | low | apps/api/seed/load.py:190 | "database already has data; run make reset first" | "database already has data; reset it instead (make reset locally, POST /demo/reset hosted)" (still open from F18) |
