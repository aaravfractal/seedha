# Progress

Autonomous build, M1 to M11. Instructions: docs/AUTONOMOUS.md. Rulings:
docs/rulings.md. Decisions: docs/decisions.md. Needs: docs/needs-from-aarav.md.

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
