# Progress

Autonomous build, M1 to M11. Instructions: docs/AUTONOMOUS.md. Rulings:
docs/rulings.md. Decisions: docs/decisions.md. Needs: docs/needs-from-owner.md.


## Open work: FINAL MASTER (docs/FINAL_MASTER.md), 12 October 2026

**Seedha Site real mode** (docs/SITE_REAL.md, branch `site-real`)
- Done: brief, deploy merged in, R1/R2 research, groundwork 0dadc4b
  (migration 0014, Pillow, mic permission, env vars); B1 photos and
  generation API merged (fe46efc); HEIC via pillow-heif 1.8.1 and
  SITE_GEN_MODEL=claude-haiku-5-5 suggestion merged (1697c2f); D-102 and
  the saved final master brief (1a7838e).
- B2 DONE, uncommitted in `.worktrees/sb2` (branch `site-sb2`, base 1a7838e),
  state of 13 Oct 2026: tsc, eslint --max-warnings=0, prettier, node tests
  (194/194) and audit-check all pass (the earlier Review.tsx type error is
  fixed). Not yet viewed in a browser. Status file:
  `.worktrees/sb2/docs/agent-reports/site-real/b2.md`. Files (apps/web):
  modified app/(owner)/(screens)/site/page.tsx, settings/page.tsx,
  app/api/[...path]/route.ts, components/site/Review.tsx; deleted (staged)
  components/site/SetupFlow.tsx; new components/site/{BuildFlow,
  PhotoPicker, MicButton, RoomsEditor, GenerateParts, ReviewEditors,
  PublishPanel (STUB)}.tsx, buildApi.ts, build.module.css,
  components/settings/AiUsage.tsx, lib/{siteBuild, proxyHeaders}.ts (+ tests),
  lib/types-site-build.ts, docs/agent-reports/site-real/b2.md.
- B3 IN PROGRESS, uncommitted in `.worktrees/sb3` (branch `site-sb3`, base
  1a7838e, no status file yet): modified api config.py, ratelimit.py,
  routers/public_site.py, routers/site.py, tests/test_route_auth.py, web
  app/hotel/[slug]/page.tsx, app/hotel/layout.tsx, HotelSite.tsx,
  worldb.module.css, lib/types-site.ts, proxy.ts; new api services/slug.py,
  tests/test_site_publish.py, web app/h/, components/site/{PublishPanel,
  SiteAddress}.tsx, publish.module.css, lib/siteHost.ts (+ test). Relaunch B3
  from this list: finish, run its checks, write b3.md.
- Merge order: commit B2 and B3 in their worktrees, merge both into
  site-real; take B3's components/site/PublishPanel.tsx over B2's stub
  (same signature: default export, props { hotelName }). Then make check.
- Next: merge B2 and B3, T1/T2 tests, V1 to V3 reviews, merge into master.

**Part 2 (open fixes):** a. done (41e91de, D-103): step 6 ticks only for
the loop's own Desk-consented guest, no direct slip/seen, reset reloads the
Overview. b. checked: statement rows (original file not kept, sha256 only),
photos (site_photo bytes) and invoices (rebuilt from rows) all live in the
database; nothing on local disk. c. checked (answer in the READY report).

**Event discovery** (docs/EVENT_DISCOVERY.md, branch `event-discovery`)
- Done: brief (03740b5); web UI merged (1390eb2): Scan now, cooldown and
  forced-rescan confirm, Suggested events queue, Found by AI events, scan
  settings and usage.
- In progress, stopped early: EV-API in `.worktrees/ev-api` (branch
  `ev-api`, uncommitted): config, models, jobs, calendar and events edits,
  new services/event_scan.py, routers/event_scan.py, tests/test_event_scan.py
  and migration 0014_event_scan.py. Its migration number collides with
  site-real's 0014: renumber or add an Alembic merge revision when the two
  branches meet.
- Not merged into master or deploy until the owner says so.

**Worktrees (13 Oct 2026):** main checkout on `deploy` (4757dd3, clean);
`.worktrees/site` site-real (this file); `.worktrees/sb2` site-sb2 (B2 done,
uncommitted); `.worktrees/sb3` site-sb3 (B3 in progress, uncommitted);
`.worktrees/ev-api` ev-api (uncommitted, migration 0014 collision);
`.worktrees/evd` event-discovery (1390eb2, clean). Every worktree also shows
an untracked apps/api/.venv symlink (ignore it).

**Next steps:** 1) finish B3; 2) commit and merge B2 and B3 into site-real;
3) T1 API and T2 Playwright tests; 4) V1 to V3 reviews and fixes; 5) gates,
merge into master, then FINAL_MASTER Parts 3 to 5 and the READY report.

**Final readiness** (docs/FINAL_READINESS.md, branch `deploy`): steps 1 and 2
done (merges, three audits, every high and medium finding fixed; latest
4757dd3). Steps 3 to 5 (gates, branch alignment, READY report) are folded
into the Seedha Site finish.

**Open worktrees:** `.worktrees/evd` (event-discovery), `.worktrees/ev-api`,
`.worktrees/site` (site-real), `.worktrees/sb2`, `.worktrees/sb3`. The
main checkout is on `deploy`.

## Polish build (12 October 2026, in progress)

Brief: docs/POLISH_BUILD.md. Decision D-100. Status files:
docs/agent-reports/polish/.

- **Research:** R1 rooms and Pro (one night of room data only: added six
  sample nights after 30 Sep, locked totals untouched); R2 inbox and invoice
  (seeded consents must not mark the Desk step; reportlab already present).
- **Migration 0012** (lead): consent.seeded, owner_settings.room_gst_bps,
  stay_invoice, guest_memory.
- **Built and merged:** rooms API (7 nights, per-room ledger detail with
  initials only, if-direct illustration, side-effect-free slip); room board
  on Overview (sheet, filters, 7-night scrubber, "Direct bookings" label);
  stay invoice (GST included, numbered per FY, PDF, preview panel, room GST
  setting); guest inbox (8 seeded consented threads, simulate incoming
  message, topic drafts with invoice attach, profile column); interactive
  Pro page with ten live card views and their API.
- **e2e:** 58/58 on master after the merges.
- **Wave 3 tests merged:** T1 added 43 API cases (rooms sweep over every
  board night, invoices for all 1,443 finished stays at five GST rates,
  consent and D6 guards, reseed, Pro views recompute); T2 added 17
  Playwright tests (room board against the API, inbox flows and PDF
  download, Pro calculators, axe on every new screen). No real bugs.
- **Wave 4 reviews and fixes:** privacy and security (1 high: per-thread
  guest simulation worked on a real hotel; fixed: sample-only, limited,
  stored as simulated; 1 medium: Desk printing unthrottled; fixed: 6 a
  minute and laptop-only in a public demo); honesty and copy (1 high: no
  visible Sample hotel badge; fixed; 14 medium fixed, except three Pulse
  lines that are the owner's exact brief copy); design and accessibility
  (1 high: the invoice slot pushed Send out of reach; fixed with a one-row
  slot and a preview dialog; 4 medium fixed).
- **Gates:** make check passes except the perf spec while this Mac is under
  heavy load from other apps (load average 10 to 18); the same spec fails
  the same way on the commit before the polish build, so it is the machine,
  not the code. To be re-run when the load drops.

## Pulse section redesign (12 October 2026)

Brief: docs/PULSE_SECTION.md. Reports: docs/agent-reports/pulse-r1.md,
pulse-b1.md, pulse-b2.md, pulse-section.md (review).

- Scroll story on desktop (pins from 1040x720): season timeline Oct 2026 to
  Jan 2027 with a pine progress line, a decision card per sample event with
  a channel rail (flip motion, Held back with a lock, favoured on top) and a
  22-room illustration; click, arrow keys, Home and End, Play season.
- Under 1040px or short screens: month strip with snap chips and swipe.
  Reduced motion: a plain list of six cards.
- Event Radar now sits once, after Pulse, with a "See Event Radar (Beta)"
  link. Shared data and copy in apps/web/lib/pulse.ts (Agoda is the
  lowest-net channel on the sample data).
- Measured: about 6 KB gzipped extra JS (budget 40), 60 fps while pinned,
  layout shift effectively 0, axe clean in both themes. Review found 0 high,
  2 medium (fixed: card cut off at 980 to 1040 wide and short windows;
  hover contrast in light theme).

## Live features (11 October 2026, in progress)

Brief: docs/LIVE_FEATURES.md. Decisions D-097 to D-099. Status files:
docs/agent-reports/live/.

- **Wave 1 research done:** R1 chain (eth-account from wheels, B-001
  resolved), R2 tunnel (cookie, origin, reset and PUBLIC_BASE_URL
  findings), R3 events (schema, guard, data model).
- **Wave 2 build merged:** B1 Amoy proof writer (chain-ID guard, balance
  floor, receipt check, `make proof-wallet`), B2 proof UI (chain card,
  bundle states, explorer link, Settings low-balance notice), B3 Desk kiosk
  at /desk/device, B4 `make demo-lan` and `make demo-live` (LAN cookie fix,
  reset only from the laptop in public mode), B5 Event Radar Lite API
  (owner-pasted notices, Claude with a code guard, sample without a key),
  B6 Calendar UI (Add events, From your sources, plan toggle, simulated
  morning preview). PUBLIC_BASE_URL now drives every guest link.
- **Testnet wallet created** (key in .env only); funding and the first live
  write are the owner's manual steps (README-dev.md checklist).
- **Wave 3 tests merged:** T1 added 100 safety tests (chain guard, key never
  leaked, decoded signed tx, events injection and URL refusal, public-mode
  reset and PUBLIC_BASE_URL); T2 hardened the e2e specs (kiosk QR origin,
  proof states, events persistence, smoke and axe on new screens). No real
  bugs found; 35/35 e2e twice on spare ports.
- **Wave 4 reviews and fixes:** security (3 medium fixed: public-demo
  visitors never spend Claude credits or testnet POL; demo-lan gets fresh
  secrets), honesty (4 medium fixed), design and accessibility (2 high, 3
  medium fixed: QR fits a landscape phone, slip never clipped). Demo
  reliability review (V4) runs after the polish build.
- **Next:** finish gates, email rewrite (waiting on the owner's no-reply
  address).

## Website upgrade and privacy clean-up (11 October 2026)

Brief: docs/WEBSITE_UPGRADE.md. Decisions D-091 to D-096. Reports:
docs/agent-reports/website-{globe,sections,privacy}.md and
website-upgrade-{design-qa,a11y-perf,privacy-legal}.md.

- **Built.** Seedha Pass section (Planned, Phase 3) and Event Radar inside
  Pulse (Pro, Planned, Sample). They share one land-only 3D globe with a
  Pass / Radar toggle, a text list, a Pause motion button and a static
  North India map for reduced motion, no WebGL or low-end phones.
- **Globe numbers.** About 150 KB gzipped extra JS when scrolled to
  (budget 300), lazy, 60 fps on a laptop GPU, zero draw calls off screen,
  DPR capped at 2, no requests to other origins, no border lines.
- **Privacy.** Real names removed from repo files (git history untouched),
  team named by roles, needs file renamed to docs/needs-from-owner.md, PDF
  author metadata replaced. lib/personal-data.test.ts scans every tracked
  file and file metadata against SHA-256 hashes only.
- **Legal and contact.** Privacy, terms, cookies, security and data
  deletion are marked drafts with a last-updated date; contact addresses
  come from PUBLIC_*_EMAIL and show "Contact details will be published
  before launch." while unset. New Open Graph image and icon.
- **Reviews.** Every high and medium finding from the design QA, a11y and
  performance, and privacy and legal reviews is fixed (D-096).
- **Gates.** make check passes (pylint 9.97/9.98, coverage 98%, web 86/86
  tests, secret scan 0 in 77 commits, firmware 5/5 and build SUCCESS).
  Playwright 24/24 three runs in a row. The 8-step loop passed on make
  demo-prod, and the demo data was reseeded.

## Frontend build: final summary (11 October 2026)

**Phases done.** P1 app shell and Overview, P2 owner screens, P3 Front desk
and Guest, P4 sign in and onboarding (MUST); P5 Seedha Site and World B, P6
Guest inbox, Assistant, Calendar, Billing, Settings, P7 public website
(SHOULD); P8 My Place as a 2D view (stretch; 3D not built, D13); P9 polish
and verify. Plus the three approved ideas (Seedha Recover, Split the
Commission, Direct Booking Score; D-089) and fixes for every high and
medium finding from the security, code quality, accessibility and design QA
reviews (D-086, D-087, D-090; reports in docs/agent-reports/).

**Checks (make check, 11 Oct):**
ruff 0 · pylint 9.97 (app) / 9.98 (tests) · mypy 0 · coverage 97.90% (money 100%) · bandit 0 · pip-audit 0 · tsc 0 · eslint 0 · npm audit 0 high · e2e 11/11

Playwright passed 3 runs in a row (11/11 each). The history secret scan
found 0 in 62 commits. Firmware: 5/5 native tests, device build SUCCESS.
`make demo-prod` serves a production build (no dev badge), and the 8-step
loop spec passed against it.

**Screens matching.** Every handoff screen in the phases matches, apart
from intentional differences (API numbers, D1 labels, contrast-safe text
colours, Sample labels, "Planned" security claims); see
docs/SCREEN_COMPARE.md. Not built: the 3D My Place hotel (2D instead) and
the pitch deck (not in the phases). Remaining polish is the low-severity
rows in review-design-qa.md and review-a11y-perf.md.

**Blockers.**
- B-001: the Polygon testnet write is still simulated.
- B-003: `~/.platformio` (about 20 MB, from 9 Oct, untouched since) and
  `~/.cache/pre-commit` (recreated 10 Oct 19:36 by a commit run that did
  not use the repo-local cache) are still on the machine. Correction: I
  earlier reported ~/.platformio as deleted, but my listing was truncated
  and I misread it. The repo now keeps both caches inside itself, and the
  git hook forces that for every commit. Please delete both folders.
- Everything else needed is in docs/needs-from-owner.md (keys, hardware,
  names, D-001).

**Demo click path (`make demo-prod`, then http://localhost:3000).**
1. "/" (website): "Try the live demo" (or /login, then Direct beta login)
   opens Overview, "Namaste, Rajesh ji.", 0 of 8 done.
2. Upload: "Use sample statements". "1,500 rows matched. 3 need a look."
   Each flagged row offers "Draft a dispute".
3. "See my real money": paid to channels ₹10,39,108. Tap "By money kept":
   MakeMyTrip drops from 1st to 5th (₹2,737).
4. Repeat guests: 12 guests, ₹41,800 paid twice; confirm a match.
5. Desk: pick Room 207 · Rahul Sharma, "Show QR". In the phone, type
   98765 43210, tick, "Yes, send me offers". The ring turns green.
6. "Check out and print": the slip shows DEODAR-RS26.
7. Approvals: "Namaste Rahul ji…", then "Approve and send" (simulated).
8. /link/DEODAR-RS26: "Pay ₹8,600 with UPI", "Pay ₹8,600". Then "Booked.
   Thank you, Rahul ji."
9. Savings: +₹2,199 net and ₹2,233 avoided for Rahul, on top of the
   sample's 4 earlier coded bookings (₹12,600). Overview's checklist is
   gone: all 8 steps done.
Also: Saturday move (+₹10,110, Accept, Undo), Ask (September MakeMyTrip
₹1,09,542), Guest inbox (after a Desk consent), My Place, Website, hotel
site /hotel/deodar-view (Pine, Stone, Sky, Hindi), rate card, agent deck.
Reset: Settings, Hotel tab, "Reset demo data" (or `make seed`).

---

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

**Needs from the owner** (docs/needs-from-owner.md): confirm D-001 (agent GST); keys
for Claude, WhatsApp (plus an approved template), Razorpay and Amoy; Desk
hardware; the team names and the legal emails; and deleting
`~/.cache/pre-commit`, which is still there (item 10).

**Rule breach to know about** (B-003): during M8, PlatformIO wrote about
20 MB to `~/.platformio`, outside the repo. The owner deleted it on 10 Oct.
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
native tests pass. Not tested on real hardware (needs-from-owner item 6).

---

## M10 Static and legal pages — passed

**Built**
- Pages: /about (D6, team then listed by name, now by role),
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
team names (needs-from-owner.md items 7 and 8; now resolved by roles).

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
  needs-from-owner item 9).

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

**B-003**: `~/.platformio` deleted by the owner (confirmed). `~/.cache/pre-commit`
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
