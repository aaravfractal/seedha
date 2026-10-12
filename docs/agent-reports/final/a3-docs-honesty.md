# A3 Final docs and honesty audit (read-only, branch deploy at b33a218)

Measured: API tests collected 1004 (`pytest --collect-only`), web unit tests 181 (`node --test lib/*.test.ts`, all pass),
e2e 75 tests in 19 files (`playwright test --list`). Coverage and pylint scores were not re-run.

## README.md
- Pass: problem, features, real vs simulated table (testnet labelled, Local only), localhost-only run with
  make demo-prod and Direct beta login, demo numbers (1,500/3, ₹10,39,108, 1st to 5th ₹2,737, 12 and ₹41,800,
  DEODAR-RS26, ₹2,233 and ₹2,199, ₹4,283, ₹47,33,012 all asserted in tests/loop.spec.ts), roadmap all Planned,
  screenshots exist, no em dashes, no exclamation marks, no personal names.
- Fix: test counts (F1), "steps done" wording (F2), "SQLite now, Postgres later" (F3), Razorpay row (F4),
  no pointer to hosting (F12).

## README-dev.md
- Pass: sign-in rules, demo script steps and labels (all button texts found in code), demo-lan and demo-live
  safety, manual checklist steps 1 to 8, quality gates match Makefile check targets.
- Fix: Node version (F5), stale Polygon row (F6), "steps done" wording (F2), hosting variables missing (F7),
  command table missing targets (F10), proxy note stale (F11), proof-wallet "already run" (F14).

## docs/HOSTING.md
- Pass: railway.json start command and /health match apps/api/railway.json; .python-version 3.12 and
  requirements.txt exist; app.main:app exists (LazyApp, main.py:222); every variable name is read by
  config.py or webEnv.ts/contact.ts; 32-char minimum, demo-value and https checks match config.py:114-134;
  seed CLI (seed/load.py:209) refuses a non-empty DB (load.py:189) and registers DESK_DEVICE_KEY; reset curl
  matches POST /demo/reset with `Authorization: Bearer` (deps.py:57, site.py:356) and 2/min (ratelimit.py:45);
  /api/health is allowlisted (bff.ts:18); Vercel Node 24.x matches engines ">=24 <27"; npm ci / npm run build
  match package.json; proxy proof header explained and matches proxy_trust.py; docs off in production
  (main.py:112); rollback steps sensible.
- Fix: deploy order (F8, high), real-owner proof step impossible (F9).

## Honest labels (UI)
- Pass: Sample hotel badge (AppHeader.tsx:283), Sample/Illustration tags on Pro cards (pro/page.tsx:17-111),
  Sample pills and Illustration on Pulse, Planned tags on Seedha Pass, Event Radar, footer and roles,
  "Simulated UPI (test mode). No money moves." (LinkBooking.tsx:338), "Polygon Amoy testnet" (proofChain.ts:8),
  "Local only" (ProofChainCard.tsx:28), WhatsApp simulated copy (AccountTabs.tsx:70-71).
- Word grep (live, real-time, guaranteed, mainnet, certified, compliant): no real-time, guarantee, mainnet
  (only a "never mainnet" comment), certified or compliant in UI copy. "Try the live demo" (Hero.tsx:45,
  Pricing.tsx:226, demo/page.tsx:12) is acceptable: the subtitle says fictional sample hotel. "Your site is
  live" (Review.tsx:153) is followed by "(sample address)": acceptable. Settings "Live" chip: see F4, F13.
- Fix: Event Radar called Beta (F15).

## Findings

| id | sev | file:line | current text | proposed text |
|---|---|---|---|---|
| F1 | medium | README.md:117-118 | "950 pytest tests" ... "171 unit tests" | "1,004 pytest tests" ... "181 unit tests" (e2e 75 is current; re-check coverage 98% and pylint 9.97 after the final make check) |
| F2 | medium | README.md:98,107; README-dev.md:64-65,93; HOSTING.md:192,215 | "0 of 8 steps done" / "All 8 steps done" | "0 of 8 done" / "8 of 8 done" (StepTracker.tsx:21 renders `{n} of {total} done`; no "All 8" string exists; loop.spec.ts:11) |
| F3 | medium | README.md:55,63 | "SQLite now / Postgres later"; "SQLite for the hackathon, with the schema written so Postgres works later" | "SQLite locally, Postgres hosted"; "SQLite for local demos; Postgres via DATABASE_URL on the hosted demo (Railway), with the full API suite run on Postgres 16 in CI (.github/workflows/api-postgres.yml)" |
| F4 | medium | README.md:77; apps/api/app/main.py:75,143; HotelTabs.tsx:112-113 | "Simulated unless Razorpay test keys are set" | "Simulated UPI, labelled. Razorpay checkout is not built yet" (no Razorpay code exists; with keys /health and Settings would say "Live" for UPI payments while payment is still simulated: either keep payments "simulated" until checkout exists or label it) |
| F5 | medium | README-dev.md:13 | "Node 20+" | "Node 24 (24 to 26; apps/web/package.json engines \">=24 <27\")" |
| F6 | medium | README-dev.md:111 | "labelled \"not yet on a public chain\". The chain write itself is not built (docs/blockers.md B-001)" | "stored locally and labelled \"Local only\" with the reason. With PROOF_CHAIN_ID=80002 too, roots are written to the Polygon Amoy testnet (app/services/chain.py; B-001 resolved, D-098)" |
| F7 | medium | README-dev.md:99-123 | keys table covers only integrations; ends "for anything beyond a local demo" | add a "Hosted (Railway and Vercel)" paragraph: DATABASE_URL may be Postgres; SEEDHA_ENV=production; API_BASE_URL (web, falls back to API_URL); SEEDHA_HOSTED=1 (web); ALLOW_OWNER_ACCOUNTS, ALLOW_CLAUDE_FOR_DEMO, ALLOW_DEMO_PROOF_WRITES; PROOF_CHAIN_ID; DEMO_DATE; "see docs/HOSTING.md" |
| F8 | high | HOSTING.md:95-110,129-143,171-173; config.py:130-131 | Railway deploys in step 1 with `WEB_ORIGIN` "(after step 4)", then seeds via `railway ssh` in step 3 | With SEEDHA_ENV=production and no WEB_ORIGIN the API refuses to start ("WEB_ORIGIN must list the web app's https origin"), so the health check fails and step 3 has no running container. Reorder: generate the Railway domain (1.4), create and deploy the Vercel project (4), then set WEB_ORIGIN and PUBLIC_BASE_URL on Railway, deploy the API, then seed (3). Or say: "Set WEB_ORIGIN and PUBLIC_BASE_URL now to the Vercel URL you will use (https://<project>.vercel.app); the API will not start without them." |
| F9 | medium | HOSTING.md:220-222 | "sign in as a real owner, or set ALLOW_DEMO_PROOF_WRITES=1" | "set ALLOW_DEMO_PROOF_WRITES=1 on Railway for the test and remove it after" (a real owner cannot sign in on the hosted demo: the OTP sender is simulated and production never shows or logs the code, .env.example:34-38; OWNER_PHONES is not in the variable table) |
| F10 | low | README-dev.md:49-60; Makefile:27-38 | command table lacks setup, demo-prod, demo-lan, demo-live, proof-wallet, reset; `make help` lacks setup, e2e, firmware, proof-nightly | add the missing rows/lines |
| F11 | low | README-dev.md:250-251 | "In production, put a proxy in front of the web app that overwrites X-Forwarded-For." | "Hosted, the API trusts X-Forwarded-For only with the web server's X-Seedha-Proxy header (app/proxy_trust.py); see docs/HOSTING.md" |
| F12 | low | README.md:86-111,136-140 | no mention of the hosted demo | one line: "Hosting on Railway and Vercel: docs/HOSTING.md" |
| F13 | low | HotelTabs.tsx:23,120 | "Public proof chain" ... "Add keys in .env to switch a connection from simulated to live." | "Proof on Polygon Amoy testnet"; hosted: "Add keys in the host's variables (or .env locally)" |
| F14 | low | README-dev.md:214-215 | "(already run once; the key is in .env, never shown)" | "(run it once; it writes the key to .env and prints only the address)" |
| F15 | medium | website/pulse/PulseSection.tsx:65 | "See Event Radar (Beta)" | "See Event Radar (Planned)" (EventRadar.tsx:21 tags it Planned; README roadmap says planned) |
| F16 | low | HOSTING.md:14-53 | saved brief still headed "VERCEL (WEB) + RENDER (API) + NEON (POSTGRES)" | keep word for word but add "(superseded by the Railway change above)" after the heading |
| F17 | low | README.md:75,78 | testnet "when a funded testnet wallet and RPC are set"; Claude "when a key is set" | add "and PROOF_CHAIN_ID=80002"; add "for the owner (hosted and public-link visitors get the labelled sample)" |
| F18 | low | seed/load.py:190 | "database already has data; run make reset first" | in the container there is no make: "database already has data; reset it instead (make reset locally, POST /demo/reset hosted)" |
