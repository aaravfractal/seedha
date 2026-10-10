# Progress

Autonomous build, M1 to M11. Instructions: docs/AUTONOMOUS.md. Rulings:
docs/rulings.md. Decisions: docs/decisions.md. Needs: docs/needs-from-aarav.md.

## Final summary (10 October 2026)

**All 11 milestones passed.** `make check` is green end to end: API, web,
e2e, history secret scan, firmware native tests and the ESP32 build.

ruff 0 · pylint 9.99 (app) / 9.98 (tests) · mypy 0 · coverage 98.99% (money 100%) · bandit 0 · pip-audit 0 · tsc 0 · eslint 0 · npm audit 0 high · e2e 7/7

- Perk codes (10 Oct, item 9 approved, D-076): new codes carry a random
  part (DEODAR-RS26-7KQ2); the demo codes DEODAR-NG26 and DEODAR-RS26 are
  kept for the sample hotel only; Seedha Link shows no guest name until a
  booking accepts the code.
- Tests: API 309, web unit 18, Playwright 7 (green 3 runs in a row),
  firmware native 5.
- All locked numbers hold in tests, the API and the browser: ₹10,39,108
  paid to channels; ₹15,71,988 lost vs list price; ₹47,33,012 net;
  MakeMyTrip 1st to 5th (₹2,737); 10.7% and 16.7%; 1,500 rows with 3
  flagged; 12 repeat guests ₹41,800; Neha's slip ₹2,678; DEODAR-RS26 →
  ₹2,233 avoided, ₹2,199 net; September MMT ₹1,09,542.
- `make demo` works from a fresh clone with only `.env.example` copied
  (about 3.5 minutes); the 8-step loop passed against it. How to run it and
  the demo script are in `README-dev.md`.
- Simulated and labelled until keys arrive: Claude, WhatsApp, Razorpay UPI,
  the Polygon proof write.

**Needs Aarav** (docs/needs-from-aarav.md): confirm D-001 (agent GST); keys
for Claude, WhatsApp (plus an approved template), Razorpay and Amoy; Desk
hardware; the teammate's name and the legal emails; and deleting
`~/.cache/pre-commit`, which is still there (item 10).

**Rule breach to know about** (B-003): during M8, PlatformIO wrote about
20 MB to `~/.platformio`, outside the repo. Aarav deleted it on 10 Oct.
Firmware builds and pre-commit runs now stay inside the repo.

**Still blocked**: B-001, the testnet write (`eth-account` will not install
here). The fallback stores the Merkle root locally and says so in the UI.

---

## M1 Foundation — passed

**Built**
- Monorepo: `apps/api` (FastAPI, SQLAlchemy 2, Alembic, SQLite), `apps/web`
  (Next.js 16 App Router, TypeScript strict, Tailwind 4), root Makefile
  (`setup seed seed-full test check dev demo`), `.env.example` with every
  integration empty (simulated), `.gitignore`, pre-commit (local hooks),
  detect-secrets baseline.
- Money core `app/money.py`: integer paise, half-up rupee rounding per line
  (ruling 1), GST 18%, UPI fee rule, "paid to channels" and "lost vs list
  price" (ruling 2), Indian formatting. Ledger service with an explicit date
  range (default 1 Apr to 30 Sep 2026), direct bookings % and commission-free
  share % (ruling 3), RevPAR, both rankings.
- Data model: all 15 CLAUDE.md tables plus pipeline_step; DB CHECK
  constraints for the net formula and the saving formula; the guest table has
  no contact column (rule 4 by structure). Initial Alembic migration with a
  drift test against the models.
- Deterministic seed generator (`seed/generate.py`) and loader: the 1,500
  statement lines with 3 flagged, 152 history stays (12 planted 2025 first
  stays), 14 in-house stays on the demo date (Neha, Rahul, Arjun + 11).
  The generator refuses to write unless every locked total is exact.
- Row checks (`services/checks.py`): payout within Rs 1, GST missing, GST not
  18%, commission on a cancelled stay; TDS/TCS are credits in the payout check
  only (rule 2).
- API: `/health` (shows simulated modes), `/property`, `/pipeline`,
  `/pipeline/{flip|rep|slip}/seen`; owner bearer auth; one JSON error shape.
- Web: design tokens from the prototype (light, dark, AA contrast), sticky
  glass nav (Pipeline, Owner, Desk, Guest, Plans), owner sidebar, theme
  toggle without flash, toast, loading/error/empty states, owner login with a
  signed httpOnly cookie, `/api/*` proxy that adds server-only tokens to an
  allowlist of API paths, `proxy.ts` page guard, Pipeline home with the live
  8-step tracker. Screens for later milestones show a labelled "being built"
  card (no dead buttons).

**Tests**: API 79 passed, 0 failed. Web unit 12 passed, 0 failed.

**Code quality**: ruff 0 · pylint 10.00 · mypy 0 · coverage 99.5% (money 100%) ·
bandit 0 · pip-audit 0 · tsc 0 · eslint 0 · npm audit 0 high in production
(5 dev-only, one reviewed advisory, D-012) · e2e n/a until M6

**Numbers checked** (from the database, by tests and by hand from the CSV)
- Paid to channels Rs 10,39,108; lost vs list price Rs 15,71,988
- Total net Rs 47,33,012; list revenue Rs 63,05,000
- Net ADR: MakeMyTrip Rs 2,737, Booking.com Rs 3,119, Agoda Rs 2,598,
  travel agents Rs 3,420, walk-in Rs 4,500, direct Rs 4,283
- MakeMyTrip net Rs 16,96,642 (line-item rounding, ruling 1 test)
- MakeMyTrip 1st by room nights, 5th by money kept
- Direct bookings 10.7%; commission-free share 16.7%; 16.5% of list paid
- RevPAR list Rs 1,566 → net Rs 1,176
- 1,500 rows, 3 flagged (MM48213, BK55320, AG77102), 1,497 counted
- 12 repeat guests, Rs 41,800 paid twice
- Neha's Booking.com stay Rs 4,000 − 600 − 612 − 110 = Rs 2,678 kept
- Monthly: Jul 150 and Aug 140 room nights below every other month; every
  line sums to its 6-month total; MakeMyTrip September paid Rs 1,09,542
- Desk activity outside the window leaves every total unchanged

**Issues found in self-review and fixed**
- My first ruling-1 test example could not tell the two rounding rules apart;
  replaced with the MakeMyTrip channel case (Rs 16,96,642 vs Rs 16,96,641).
- GST test used a loose tolerance; now exact 18% per row plus exact contract
  commission on all 1,663 passing rows.
- `format_inr` had an unreachable branch; simplified (money code 100% covered).
- Makefile assumed GNU Make 3.82; macOS has 3.81. Rewritten.
- Hidden toast peeked at the bottom edge; theme button wrapped alone on
  phones. Both fixed and re-screenshotted at 390 px and 1440 px.
- Removed an unused `counts_in_ledger` property and an unused schema reset.

**Simulated (missing keys)**: Claude, WhatsApp, Razorpay, Polygon Amoy (all
reported by `/health`).

**Commit**: e733e4c

---

## M2 Statement upload and parser — passed

**Built**
- `POST /statements` (one file per request, real progress), `GET /statements`,
  `GET /statements/samples`, `POST /statements/samples/{i}` ("Use sample
  statements"), `POST /statements/rows/{id}/review` (keep out / count it).
- Parser recognises five layouts by their content, not file name: MakeMyTrip
  payout PDF (pdfplumber tables), Booking.com payouts (xlsx), Agoda statement
  (csv), travel agent register (xlsx), hotel register (xlsx, walk-in and
  direct). Amounts like "4,200.00", "₹ 4,200", "(802.00)" become paise.
- Unknown layouts go to Claude (`claude-opus-5` via `CLAUDE_MODEL`, streamed,
  strict JSON schema, amounts copied as printed). Every returned amount must
  appear in the file or the row is flagged `not_in_source` (D-019). Without a
  key the owner sees a clear "needs Claude (simulated mode)" message.
- Ingest: duplicate file (same SHA-256) is "already read"; duplicate lines
  (same channel + reference) are skipped; one shared booking builder for seed
  and upload (D-024). Guards: 10 MB, type checked against bytes, xlsx unpacked
  size limit (zip bombs), PDF page limit.
- Six deterministic sample files written from the canonical rows; a test
  regenerates them and requires byte-for-byte equality.
- Web Upload screen as in the prototype: drop zone, sample button, choose
  files, per-file progress and row counts, "1,500 rows matched. 3 need a
  look." with each flagged row's reason and review buttons, "See my real
  money". Empty, loading and error states. Checked in a browser at 1440 px
  (light) and 390 px (dark): no console errors, no horizontal scroll.

**Tests**: API 135 passed, 0 failed. Web unit 12 passed, 0 failed.

**Code quality**: ruff 0 · pylint 10.00 · mypy 0 · coverage 99% (money 100%) ·
bandit 0 · pip-audit 0 · tsc 0 · eslint 0 · npm audit 0 high in production
(dev allowlist D-012) · e2e n/a until M6

**Numbers checked**
- Six sample files through the real upload path: 410 + 412 + 214 + 96 + 180
  + 188 = 1,500 rows; 3 flagged: MM48213 ("Payout ₹3,120, but list minus
  deductions is ₹3,240"), BK55320 ("GST on commission line missing"),
  AG77102 ("Commission charged on a cancelled stay")
- After upload the ledger reads paid to channels ₹10,39,108, net ₹47,33,012,
  1,500 room nights (identical to the seed path)
- Every one of the 1,500 parsed lines equals its canonical row field by field
- Accepting AG77102 adds exactly ₹802 to paid to channels
- Uploading the same file twice, or the same lines in a re-saved file, adds 0

**Issues found in self-review and fixed**
- Grounding merged adjacent CSV cells into one number and wrongly flagged a
  correct Claude row; tables are now grounded per cell, PDFs with a
  grouping-aware regex (1,23,456 and 123,456).
- Decimal normalisation treated 123456.50 and 123456.5 as different.
- Zip-bomb and huge-PDF inputs were not bounded; both now refused with tests.
- Excel sample files changed hash on every run (openpyxl save time); pinned.
- Make dev restarted the API without reload; now `--reload` in dev only.

**Simulated (missing keys)**: Claude (unknown layouts only), WhatsApp,
Razorpay, Polygon Amoy.
**Commit**: 5886448

---

## M3 Ledger and the flip — passed

**Built**
- `GET /ledger/channels?start&end`: per channel room nights, stays, list
  revenue, discount, commission, GST, fees, net kept, paid to channels, lost
  vs list price, list and net ADR, kept share; totals; direct bookings %,
  commission-free share %, share paid to channels, RevPAR list and net, both
  rankings, counted and excluded rows, and a true Hindi/English insight
  (D-025). `GET /ledger/monthly` (per channel per check-in month).
- Flip screen: Hindi insight with "Show in English" toggle; "By bookings / By
  money kept" with a measured FLIP reorder (Web Animations, 700 ms spring,
  reduced-motion respected); rank, room nights, lost vs list price, kept per
  room, kept-share bar; pine ring on the busiest channel after the flip;
  computed toast; "Show the maths" per row (D-027); four stats with ruling 2
  and 3 sub-lines; footnote with counted/excluded rows. Empty state before
  upload, loading and error states. Marks pipeline step "flip".

**Tests**: API 148 passed, 0 failed. Web unit 12 passed, 0 failed.

**Code quality**: ruff 0 · pylint 10.00 · mypy 0 · coverage 99% (money 100%) ·
bandit 0 · pip-audit 0 · tsc 0 · eslint 0 · npm audit 0 high in production
(dev allowlist D-012) · e2e n/a until M6

**Numbers checked** (API, tests and browser)
- Paid to channels ₹10,39,108; lost vs list price ₹15,71,988; net ₹47,33,012
- MakeMyTrip ₹2,737 and Direct ₹4,283 per room; MakeMyTrip 1st by bookings,
  5th by money kept (browser order after toggle: Walk-in, Direct, Travel
  agents, Booking.com, MakeMyTrip, Agoda)
- Direct bookings 10.7%, commission-free share 16.7%, 16.5% paid, RevPAR
  ₹1,566 → ₹1,176; 1,497 rows counted, 3 kept out
- Monthly sums equal totals; July 150 room nights; MakeMyTrip September paid
  ₹1,09,542
- Flip interactive 0.27 to 0.51 s after navigation (dev server)

**Issues found in self-review and fixed**
- The prototype's insight sentence is false for the data; replaced by a
  computed one (D-025).
- Gold highlight conflicted with "gold only for money saved" (D-026).
- A fifth stat broke the four-stat grid; folded into a named sub-line.
- Monthly endpoint duplicated the paid-to-channels formula; now reuses the
  ledger's line items.

**Simulated (missing keys)**: none used by M3.

**Commit**: 38d7634

---

## M4 Repeat guests and Saturday move — passed

**Built**
- Matcher (`services/matcher.py`): normalised names and cities, rapidfuzz
  Jaro-Winkler with surname/first-name gates (D-030), blocking by surname
  initial, Claude tie-break only between 0.60 and 0.80 (simulated without a
  key). Stored as `repeat_match` (migration 0002); scanning is idempotent and
  keeps owner decisions.
- `GET /repeat` (scan + list), `POST /repeat/{id}` confirm/dismiss. A match is
  confirmed only by the owner (ruling 7) and never touches consent.
- Saturday move (`services/scenario.py`, in the 100%-coverage money set):
  `GET /scenario/saturday?rooms=N`, `POST /scenario/saturday` to record
  Accept / Not now (`scenario_decision`).
- Screens: Repeat guests (stats, list with "x% sure", "Not new demand",
  Confirm / Not them, "Showing 3 of 12" with "Show all 12", for-your-eyes-only
  note) and Saturday move (computed channel, room stepper, three stats,
  Accept / Not now, honest "Seedha does not change your OTA settings" note).

**Tests**: API 187 passed, 0 failed. Web unit 13 passed, 0 failed.

**Code quality**: ruff 0 · pylint 10.00 · mypy 0 · coverage 99% (money 100%,
now including scenario) · bandit 0 · pip-audit 0 · tsc 0 · eslint 0 · npm audit
0 high in production (dev allowlist D-012) · e2e n/a until M6

**Numbers checked**
- 12 repeat guests, ₹41,800 commission paid twice (API, browser)
- Matches equal the planted answer key exactly; no false positives among
  1,500 statement lines and 152 history stays
- Rahul S. ₹3,480 at 92%; Neha Gupta ₹3,120; A. Verma family ₹4,060 (65%,
  in the tie-break band)
- Saturday move: Agoda ₹2,598 vs direct ₹4,283 per room; 6 rooms = +₹10,110;
  4 rooms = +₹6,740
- Matching leaves the consent table empty (ruling 7)

**Issues found in self-review and fixed**
- First matcher version suggested 823 false pairs (same surname, different
  person); added surname and first-name gates measured on real name pairs.
- Most-recent-first ordering buried the matches needing judgement; now
  least certain first.
- Repeat list was cramped at 390 px; stacks on phones.

**Simulated (missing keys)**: Claude tie-break (score alone is used).

**Commit**: fb9b55a

---

## M5 Desk, consent and slips — passed

**Built**
- Migration 0003: `desk_command` queue, `consent_token` (hash only),
  `booking.checked_out_at`. Seed registers the front-desk box from
  `DESK_DEVICE_KEY` (hash only).
- Owner desk API: `GET /desk/state`, `POST /desk/checkin {room}` (10-minute
  one-use consent link, QR command), `POST /desk/checkout {room}` (perk code,
  slip, print command), `GET|POST /desk/close-slip`.
- Device API (X-Device-Key): `GET /desk/poll`, `POST /desk/ack`.
- Public consent: `GET|POST /public/consent/{token}`; explicit `agree: true`
  only (rule 5), Indian mobile check, salted SHA-256 fingerprint, proof
  pending, Desk turns green with a chime.
- Slips from stored lines (ruling 4): Neha ₹4,000 − 600 − 612 − 110 =
  ₹2,678; walk-in "Booked directly. Hotel kept ₹3,400"; 9 PM close slip.
- Web: Desk simulator that is a real device client (polls every 2 s, QR via
  `qrcode`, ring, OK screen, printer paper animation), guest phone showing
  the real consent page, `/consent/[token]` page (number + unticked box,
  button disabled until both), brand-only header on guest pages.

**Tests**: API 214 passed, 0 failed. Web unit 13 passed, 0 failed.

**Code quality**: ruff 0 · pylint 10.00 · mypy 0 · coverage 99% (money 100%,
now money.py, ledger.py, scenario.py, slips.py) · bandit 0 · pip-audit 0 ·
tsc 0 · eslint 0 · npm audit 0 high in production (dev allowlist D-012) ·
e2e n/a until M6

**Numbers checked**
- Neha's slip (API and printed paper in the browser): Room (via Booking.com)
  ₹4,000, Discount −₹600, Commission −₹612, GST on commission −₹110, Hotel kept
  ₹2,678, code DEODAR-NG26
- Arjun walk-in slip: no commission or GST lines, code DEODAR-AM26
- Close slip: 14 rooms sold, gross ₹58,800, direct bookings 21%
- Locked ledger totals unchanged after check-in, consent and checkout

**Issues found in self-review and fixed**
- First close-slip code had a broken savings query; rewritten and tested.
- Next 16 prerender errors on the consent route; Suspense boundaries added.
- "No data yet" on the Saturday move logged a console 422; now a 200 with
  `available: false`.
- Money coverage dropped below 100% when slips joined the set; tests added.

**Simulated (missing keys)**: none needed; the Desk box is simulated in the
browser until hardware exists (M8).

**Commit**: 9988246

---

## M6 Win-back, Seedha Link and savings — passed

**Built**
- Messages: drafts created at checkout or at consent-after-checkout only for
  active consents (ruling 7), one per perk code (DB unique), Claude wording
  checked against code/link/STOP/no-money rules with a template fallback;
  `GET /messages`, approve-and-send (consent re-checked), reject, and a
  labelled "simulate reply" for the demo. Simulated WhatsApp sender; Cloud API
  sender (request shape checked against Meta's docs, version configurable).
- STOP: webhook `GET|POST /webhooks/whatsapp` (verify token, HMAC signature),
  STOP variants withdraw consent, block drafts, log an opt-out event without
  the number.
- Seedha Link: `GET /public/link?code=`, `POST /public/link/book` (public rate
  x nights, room availability, atomic one-time redemption, simulated UPI).
- Savings: original channel's contract rate + 18% GST − UPI fee, stored with
  the rate (ruling 5); `GET /savings`. `savings.py` is in the 100% money set.
- Web: Approvals (consent time, proof chip, bubbles, approve/reject, open as
  guest, simulated STOP), sidebar badge, Seedha Link (owner demo in a phone
  frame and the guest page `/link/[code]`, UPI bottom sheet), Savings with a
  gold count-up and the full breakdown.
- Playwright e2e of the full 8-step loop + code reuse, on its own API,
  database and production build; in `make check`; green 3 runs in a row.

**Tests**: API 253 passed, 0 failed. Web unit 13 passed. e2e 2/2 (x3).

**Code quality**: ruff 0 · pylint 10.00 · mypy 0 · coverage 99% (money 100%:
money, ledger, scenario, slips, savings) · bandit 0 · pip-audit 0 · tsc 0 ·
eslint 0 · npm audit 0 high in production (dev allowlist D-012) · e2e 2/2

**Numbers checked**
- Rahul DEODAR-RS26, ₹8,600 (2 nights Deluxe at ₹4,300): commission ₹1,892 +
  GST ₹341 = ₹2,233 avoided, UPI fee ₹34, net ₹2,199 (API, e2e, browser)
- Neha (Booking.com 18%) would give ₹1,827 avoided, ₹1,793 net (unit test)
- Second use of a code: 409, savings stay at one row
- Matched-but-unconsented guests: no draft, no send (ruling 7 test)
- After STOP: drafts blocked, approve refused, opt-out event recorded

**Issues found in self-review and fixed**
- Drafting on GET made 8 drafts for 2 guests when two screens loaded at once;
  now event-driven + unique constraint.
- The code check passed when the code appeared only inside the link.
- A text replacement silently missed the checkout hook (caught by tests).
- Alembic's logging config silenced SIMULATED warnings after migrations.
- UPI sheet showed below the form on phones; now a fixed, hidden-until-open
  bottom sheet.
- e2e servers started before global setup, so the API held a stale database.
- Stale Turbopack dev cache hid new CSS (dev only, documented).

**Simulated (missing keys)**: WhatsApp sends and inbound (labelled), UPI
payment (labelled), Claude wording (template used).

**Commit**: 4d76701

---

## M7 Proof and Ask — passed

**Built**
- Proof: Merkle tree over consent fingerprints (root, path, verify),
  `POST /proof/bundle` ("Write tonight's proof"), `make proof-nightly` /
  `python -m app.jobs nightly-proof` for cron, `GET /proof` overview,
  `GET /proof/consents/{id}` re-verifying the path against the root on every
  view. Chain write is simulated (B-001), labelled in the UI.
- Erasure service: salt and number removed, published fingerprint kept but
  unlinked, message texts blanked (used by the M10 data-deletion page).
- Ask: six fixed questions computed by code (ledger, repeats, savings, close,
  recent OTA payouts with sample payout terms); Claude may only reword with
  identical numbers; Hindi with an English toggle.
- Web: Proof screen (stats, write button, bundles, check a consent) and proof
  dialog (timeline, live "Matches. Not changed.", copy fingerprint),
  opened also from the Approvals proof chip; Ask chat with six chips.

**Tests**: API 271 passed, 0 failed. Web unit 13 passed. e2e 2/2.

**Code quality**: ruff 0 · pylint 10.00 · mypy 0 · coverage 99% (money 100%) ·
bandit 0 · pip-audit 0 · tsc 0 · eslint 0 · npm audit 0 high in production
(dev allowlist D-012) · e2e 2/2

**Numbers checked** (Ask equals the ledger)
- "Pichle mahine MakeMyTrip ko kitna diya?" → September ₹1,09,542, equal to
  the ledger for 1 to 30 Sep
- "Sabse accha channel kaunsa?" → Walk-in ₹4,500, online Direct ₹4,283
- "Kitne guest do baar..." → 12 guests, ₹41,800
- "Aaj ka close" → 14 rooms, gross ₹58,800, direct bookings 21%
- "Direct se kitna bacha?" → ₹2,199 after Rahul's coded booking
- Merkle: every leaf of 1 to 5-leaf trees verifies; a swapped fingerprint fails

**Issues found in self-review and fixed**
- First Ask phrasing check had a broken boolean; rewritten as one rule.
- /proof highlighted both Proof and Pro in the sidebar and top nav.
- Appended CSS not picked up by the dev cache (again); CSS is now rewritten,
  not appended.

**Simulated (missing keys)**: public chain write (B-001), Claude phrasing.

**Commit**: d5967a3

---

## M8 Desk firmware — checkpoint (see completion below)

Done and tested:
- `firmware/seedha-desk`: PlatformIO project (ESP32, Arduino). Core library
  `lib/desk_core` (command dispatch, dedupe of re-sent commands, bounded
  offline ack queue, ESC/POS framing, UTF-8 to ASCII for screen and printer)
  with 5 native Unity tests under `-Wall -Wextra -Werror`: all pass.
- Contract: `apps/api/tests/test_firmware_contract.py` records a real
  `/desk/poll` sequence (check-in, consent, checkout) into
  `test/fixtures/poll.json`; the native tests replay it.
- `tools/mock_server.py` bench server, tested by
  `apps/api/tests/test_firmware_mock_server.py` (drives show_qr, set_ring,
  print_slip; refuses a wrong key).
- `src/main.cpp`: TFT (ILI9488 via TFT_eSPI flags on CLAUDE.md pins), QR,
  NeoPixel ring, ESC/POS on UART2, buzzer, debounced reprint button,
  HTTPS polling every 2 s with CA verification (plain HTTP only for a bench
  `http://` base), acks retried after outages. `secrets.h` gitignored,
  `.example` committed. API slip text is now ASCII-only for the printer.
- Makefile: `setup-firmware`, `check-firmware` (native tests + device build),
  `firmware`.

Not yet done: the ESP32 device build has not completed. The espressif32
6.10.0 platform download broke mid-way (BrokenPipe, then stalled while the
Mac slept). Next step: retry `pio run -e seedha_desk`, fix any compile
warnings in Seedha code, then commit M8.

## M9 Polish for demo — passed

**Built**
- Seedha Site: API `/site` (stage, Pine/Stone/Sky, EN/HI, package approval,
  publish) with computed package prices and data-based reasons; web setup
  chat, review with live phone preview, publish, share on WhatsApp, and a
  printable rate card (`/rate-card`).
- Pro cards from `/pro` (audit claim computed, samples labelled), Plans with
  yearly/monthly (unit-tested), Settings (connections, demo reset, log out).
- Every owner screen has loading, empty and error states; guest pages have
  their own header; sidebar and nav highlight correctly.

**Tests**: API passing (see M10 for the count after both). Web unit 15.

**Numbers checked**: packages ₹9,400 / ₹4,300 / ₹11,900; plans ₹1,249,
₹2,083, ₹3,333 yearly per month and ₹1,499, ₹2,499, ₹3,999 monthly; Pro
audit ₹802 (AG77102) and +₹118 when a line is ₹100 over contract.

**Issues found in self-review and fixed**: create-on-read race on site
settings (500 on first load); `make seed` deleting the database under a
running API; `.sub-title` applying only to h3; Turbopack dev cache serving
stale CSS and layouts (dev only; cleared on `make dev`).

**Commit**: 1cc4f46 (checkpoint) and the combined M9/M10 commit below.

## M8 Desk firmware — passed (completed in M11)
The device build was blocked by PlatformIO downloads (B-002). In M11 it
downloaded into a repo-local PlatformIO folder, and after turning off
TFT_eSPI's touch-pin notice (the board has no touch panel) `pio run -e
seedha_desk` succeeded with zero warnings: RAM 14.5%, flash 74.8%. The 5
native tests pass. Not tested on real hardware (needs-from-aarav item 6).

---

## M10 Static and legal pages — passed

**Built**
- Pages: /about (D6, team with the [Hospitality teammate] placeholder),
  /privacy (DPDP Act 2023 / Rules 2025: data, purposes, legal basis,
  retention, rights incl. STOP and erasure, OTA contacts never used, only
  fingerprints public, processors, [grievance officer name] and
  [contact email]), /terms (subscription, owner approves every message, no
  lower public rates, acceptable use, liability, Indian law, Dehradun
  courts), /cookies (two necessary cookies, no banner and why),
  /data-deletion (working form), /security ([security email]), /contact
  (plan noted from Plans), /faq (10 answers from CLAUDE.md facts), custom
  404, 500 and global error pages.
- Draft notice and last-updated date on every legal page; Hindi key points
  toggle on Privacy, Terms and Delete my data; footer on every page.
- API `POST /public/data-deletion` with erasure via the M7 service, same
  answer whether or not it matched, request log without personal data
  (migration 0006).

**Checked in a browser** at 1440 px (light) and 390 px (dark): every page
200 (404 page returns 404), notice present on the six legal pages, footer
with 8 links, no horizontal scroll, deletion form round trip works.

**Tests**: API 283 passed. Web unit 15 passed.

**Simulated / placeholders**: contact, grievance and security emails;
hospitality teammate name (needs-from-aarav.md items 7 and 8).

**Commit**: combined "M9 completion and M10" commit (see git log).

## M11 Final hardening — passed

**Security**
- Route auth sweep: every operation in the API schema is classified; all
  owner routes answer 401 with no token, a wrong token or the device key;
  Desk routes need the device key (D-072).
- Rate limits (D-071): consent 20/min, link page 30/min, link booking
  10/min, data deletion 5/min per client, each with a ceiling across all
  clients; owner login 10 per 15 min. 429 with Retry-After. Checked live:
  the 11th wrong passcode and the 6th deletion request are refused.
- Body caps: WhatsApp webhook 256 KB before the signature check; the BFF
  refuses bodies over 11 MB before buffering (statement limit is 10 MB).
- Web security headers: CSP (no eval in production), frame-ancestors self
  (the Desk simulator frames the consent page), nosniff, referrer policy,
  permissions policy, no X-Powered-By.
- Input validation reviewed: every request body has bounded fields or
  literals; consent tokens are length-checked by the service. CORS allows
  only WEB_ORIGIN (the browser only talks to the BFF anyway).
- Secret scan of history: `make secrets-history` checks all commits (0 found; scanner shown
  to catch planted AWS and GitHub keys). `.env` never committed.
- Audits: pip-audit 0; npm audit 0 high in production dependencies.
- Residual risk recorded, not changed: guessable perk codes (D-075,
  needs-from-aarav item 9).

**Accessibility** (D-073): axe WCAG 2.1 A/AA on all 27 pages, light and
dark, 1440 and 390 px: 0 violations after fixing the Pro tag contrast in the
active phone nav pill (dark). Added a skip link; the UPI sheet and the proof
dialog now take focus, keep Tab inside, close on Escape and return focus.

**Speed** (D-074): flip interactive about 190 ms cold, 85 ms warm on the
production build (limit 1,000 ms); re-rank 5 ms (limit 300 ms).

**Fresh clone**: cloned to a temp folder, copied `.env.example` to `.env`,
`make demo`: installed, seeded, built and served in about 3.5 minutes. The
8-step loop spec passed against it (₹10,39,108; MakeMyTrip 1st to 5th;
12 guests ₹41,800; DEODAR-RS26 → ₹2,233 avoided, +₹2,199 net) and Ask
answered September ₹1,09,542.

**README-dev.md**: how to run, commands, demo script, keys and what is
simulated, layout, quality gates, security notes, troubleshooting.

**Playwright**: 7 tests (loop, code reuse, security headers, login lockout,
axe sweep, keyboard, flip speed): the full suite passed 3 runs in a row
(7/7 each, about 2.1 minutes per run).

**Firmware**: the ESP32 device build now succeeds with zero warnings (M8
closed, B-002 resolved). PlatformIO is kept inside the repo from now on;
it had written to `~/.platformio` during M8 (B-003).

ruff 0 · pylint 9.99 (app) / 9.98 (tests) · mypy 0 · coverage 98.98% (money 100%) · bandit 0 · pip-audit 0 · tsc 0 · eslint 0 · npm audit 0 high · e2e 7/7

## Item 9: perk code format — passed (10 October 2026)

**Built** (D-076): codes are PREFIX-INITIALS+YY plus a 4-character random
part from 31 symbols (no 0/O, 1/I/L), drawn with `secrets`; clashes draw
again. DEODAR-NG26 and DEODAR-RS26 are kept, only when the property is
sample data. `/public/link` no longer returns the guest's name; the booking
confirmation does, only when the booking accepted the code ("Booked. Thank
you, Rahul ji."). Arjun's sample code (walk-in) now has the random part;
the seed's informational code column was regenerated to match.

**Tests**: `tests/test_perk_codes.py` (alphabet, format, demo codes kept on
the sample hotel, other sample guests and real hotels get the random part,
taken demo code falls back, reissue is stable, collisions retry and can run
out, the longest code fits the column, no name on the link page for valid
or unknown codes, name only after a coded booking). Updated: the walk-in
checkout, win-back flow and loop e2e now expect no name before booking.

**B-003**: `~/.platformio` deleted by Aarav (confirmed). `~/.cache/pre-commit`
is still present; commits now use a repo-local `PRE_COMMIT_HOME`.

ruff 0 · pylint 9.99 (app) / 9.98 (tests) · mypy 0 · coverage 98.99% (money 100%) · bandit 0 · pip-audit 0 · tsc 0 · eslint 0 · npm audit 0 high · e2e 7/7

---

# Frontend build (docs/AUTONOMOUS_FRONTEND.md, FRONTEND_MASTER.md, AGENT_TEAM.md)

## Setup — done (10 Oct 2026)
- Kit unzipped (3e02986); handoff text pages 38 to 58 rendered and
  transcribed (`design/handoff-text/HANDOFF_TEXT.md`), gallery pages 2 to 37
  catalogued (`GALLERY.md`), 33 video frames catalogued (`VIDEO_SCREENS.md`).
- `docs/frontend-gap.md` (cb7e000).
- Foundation (d84eeba): World A tokens in globals.css (D-077 contrast),
  Mukta via next/font (D-078), framer-motion 14.1.0, npm cache in
  `.cache/npm`, Next telemetry off.
- D9 data (e7621c7): four earlier coded bookings, ₹12,600 (D-080). API 313
  tests pass.

## Merged (10 Oct 2026)
- P3 Front desk and Guest (c118d90) + follow-ups (04b6388): Desk test print
  API, handoff QR copy (firmware fixture and native test updated), checkout
  without consent (D-081), CSS modules fixed (D-082: the Turbopack Tailwind
  rule had turned every *.module.css global).
- P4 Auth (WhatsApp OTP simulated, sign up, onboarding, Direct beta login,
  migration 0007) + follow-ups (f0bda9f): full navigation after sign-in
  (D-083), e2e signs in with Direct beta login, OTP lockout e2e.
- P1 App shell and Overview (GET /overview) + follow-ups (4c726fc):
  contrast fixes found by axe, proxy for the five placeholder routes.
- P2 Owner screens (scenario undo, draft edit, proof states, season in
  review, 8 AM line) + follow-ups and layouts by route group (11c15df,
  D-084, D-085).
- After each merge: API, web, e2e 7/7 green; firmware native + device build
  green.

- Security review (15 findings) fixed in ff16894 (D-086); Saturday undo
  on Overview (Q1); shared draft rules web/API; Mukta and World B fonts
  bundled (D-087); /link stays a guest page.
- P6a Guest inbox and Assistant (migration 0008) merged + follow-ups
  (1d04c4d): one web-address guard, every erasure deletes inbox texts.
- P5 Seedha Site and World B merged (b75e826), P7 Public website merged
  (965938d): website frame, interim legal layouts removed, World B layouts
  suspend inside main.
- Quality and accessibility fixes (0224e7a, e4b2b5e and the next commit):
  13px floor, focus ring and trap, theme-aware colours, one format/channel
  helper set, services no longer import routers, 44px footer links, cookie
  dialog focus return, functional e2e for sign-up and owner flows (10 e2e
  tests green), public sample always served, API start migrates the DB.
- Ideas: docs/ideas.md (5 proposals). Building only the approved three
  within 2 h each (Recover, Split the Commission minimal, Score minimal).

## Running
- P6b Calendar, Billing, Settings (fe/settings); ideas builder (fe/ideas);
  design QA and accessibility reviewers re-running the owner pass (their
  first runs could not reach the API).
- Next: merge P6b and the ideas, fix review findings, P8 only if time
  allows, then P9 (3 x Playwright, make check, demo-prod, summary).
