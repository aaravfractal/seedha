# CLAUDE.md · Seedha (real build)

You are building the real version of Seedha in this repo. Read this whole file
before every session. The Phase 1 prototype is in prototype/index.html;
use it as the UX reference for every screen and flow.

## 1. What Seedha is
Seedha shows small hill hotels (10 to 40 rooms, Uttarakhand first) what each
booking channel really leaves them after discount, commission, GST on
commission and payment fees, finds repeat guests who paid OTA commission
twice, captures guest consent at the front desk, and wins guests back to book
direct with an owner-approved WhatsApp perk and a direct booking link with UPI.

Hackathon: TBI GEU AI-Tourism Hackathon, 13 to 14 Oct 2026, problem D6
(Channel Mix and Distribution Cost Optimisation). Organiser note: D6 is
computation, not prediction. The hero screen is gross vs net by channel.

## 2. Rules that can never break
1. Every rupee figure is computed by deterministic code from stored rows.
   An LLM never produces a money value shown to the user.
2. net_kept = list_amount - discount - commission - gst_on_commission - fees.
   gst_on_commission = 18% of commission. TDS and GST TCS are credits and are
   never subtracted.
3. Statement rows that fail the math check (gross minus deductions must equal
   payout within Rs 1) are flagged and excluded from the flip until the owner
   reviews them.
4. Guest contacts received from OTAs are never stored for messaging and never
   messaged. Only guests who consented through the Desk flow get messages.
5. Consent is unticked by default. Every outgoing message includes "Reply STOP
   to opt out". STOP must work.
6. Perks for returning guests, never a lower public rate.
7. Nothing is sent to a guest without explicit owner approval.
8. No scraping of OTA websites.
9. No guest personal data on-chain. Only salted SHA-256 fingerprints.
10. Secrets live in .env only. Never hardcode keys. Never commit .env.
11. All demo data is fictional and labelled as sample data.

## 3. Stack
- apps/api: Python 3.11+, FastAPI, SQLAlchemy 2, SQLite for the hackathon
  (schema written so Postgres works later), Pydantic v2, pytest.
- apps/web: Next.js (App Router) + TypeScript + Tailwind. Design tokens and
  screens follow prototype/index.html (pine #1E6B4E, gold #E8A33D only for
  money saved, system font, large type, light and dark).
- LLM: Anthropic Claude API via the official Python SDK, model from env var
  CLAUDE_MODEL. Used only for: statement row extraction, guest-name match
  tie-breaks, Hindi or English one-line explanations, win-back message drafts.
- WhatsApp: Meta WhatsApp Cloud API test number. If keys are missing, fall back
  to a "simulated send" log so the demo never breaks.
- Payments: simulated UPI by default; Razorpay test mode if keys exist.
- Proof: SHA-256 with per-consent salt; nightly Merkle root; optional write
  to Polygon Amoy testnet if PROOF_RPC_URL and key exist, else store root only.
- firmware/seedha-desk: ESP32, Arduino framework (PlatformIO). Polls the API
  over HTTPS every 2 s.

## 4. Repo layout
seedha/
  CLAUDE.md
  prototype/index.html
  apps/api/   app/{main.py, models.py, schemas.py, db.py}
              app/routers/{statements, ledger, guests, consent, desk,
                           messages, link, proof, ask}.py
              app/services/{parser, ledger, matcher, drafter, proof, whatsapp}.py
              tests/  seed/ (sample statements + register)
  apps/web/   app/(owner)/{home, upload, flip, repeat, scenario, approvals,
              savings, ask, site, proof, settings}/  app/link/[code]/
              app/consent/[token]/  app/desk/  app/plans/
  firmware/seedha-desk/
  docs/

## 5. Data model (SQLite now, Postgres-ready)
property, room, channel, channel_contract, statement_file, booking, guest,
consent, proof_bundle, proof_bundle_item, message, perk_code, direct_booking,
saving, desk_device. Key fields:
- booking: list_amount, discount, commission, gst_on_commission, fees,
  net_kept, math_check_passed, channel_id, guest_id, nights, check_in
- consent: guest_id, booking_id, wording_version, given_at, salt, fingerprint,
  withdrawn_at
- perk_code: code (unique), guest_id, perk, redeemed_at
- saving: direct_booking_id, commission_rate_used, commission_avoided,
  gst_avoided, upi_fee, net_saving
- desk_device: device_key (hashed), property_id, last_seen

## 6. Milestones (build in order; each must pass its checks before the next)

M1 Foundation
- Monorepo scaffold, .env.example, .gitignore (node_modules, .venv, .env,
  *.db, .next, build outputs), Makefile with dev, test, seed, check, demo.
- DB models + migrations, seed script loading the sample hotel
  (Hotel Deodar View, 22 rooms, Apr to Sep 2026) from apps/api/seed/,
  with a month-by-month breakdown that sums to every locked total.
- Frontend: app shell, navigation, design tokens, light and dark, toast,
  Pipeline home with the 8-step tracker.
- Check: make seed && make test pass; paid to channels Rs 10,39,108;
  MakeMyTrip net ADR Rs 2,737; direct Rs 4,283; total net Rs 47,33,012.

M2 Statement upload and parser
- POST /statements (PDF, XLSX, CSV). CSV and XLSX parsed deterministically
  first; PDFs and unknown layouts go to Claude with a strict JSON schema.
- Math check per row; failed rows stored with reason.
- Frontend: Upload screen (drop zone, sample button, progress, flagged rows).
- Check: the 6 seed files yield 1,500 rows, 3 flagged (MM48213, AG77102,
  BK55320). Parser unit tests with fixtures; LLM mocked in tests.

M3 Ledger and the flip
- GET /ledger/channels: per channel room_nights, list_revenue, discount,
  commission, gst_on_commission, fees, net_kept, net_adr; totals,
  "paid to channels", "lost vs list price", direct bookings %,
  commission-free share %, list and net RevPAR.
- Frontend: flip screen with "By bookings / By money kept" toggle and the
  animated reorder from the prototype.
- Check: by net ADR MakeMyTrip is 5th; numbers match M1.

M4 Repeat guests and Saturday move
- Matcher: normalise names, rapidfuzz score, Claude tie-break only between
  0.6 and 0.8. A match is confirmed only by the owner. "Not new demand" flag.
- Scenario: hold N rooms off the lowest net ADR channel, before/after numbers.
- Frontend: Repeat guests screen and Saturday move card.
- Check: 12 repeat guests, Rs 41,800 paid twice on seed data.

M5 Desk, consent and slips
- POST /desk/checkin {room} -> one-booking token, expires in 10 minutes.
  GET /desk/poll (device key auth, TLS) -> commands (show_qr, set_ring,
  print_slip); POST /desk/ack.
- Consent page /consent/[token]: unticked checkbox, button disabled until
  ticked; stores consent + salt + fingerprint; proof pending.
- Slips computed from the guest's own booking row and channel terms; walk-in
  slips show no commission lines. 9 PM close slip endpoint.
- Frontend: desk simulator with all device states, consent page, slips.
- Check: end-to-end test from check-in to consent to slip.

M6 Win-back, Seedha Link and savings
- Drafts only for consented, non-withdrawn guests after checkout; Claude
  writes the text; template contains the perk code and STOP.
- Owner approve/reject; send via WhatsApp Cloud API or simulated log.
- Inbound STOP sets consent.withdrawn_at and blocks future sends.
- /link/[code]: booking page, simulated UPI or Razorpay test; creates
  direct_booking + saving using the original channel's contract rate,
  plus 18% GST, minus UPI fee (0.4% above Rs 2,000, cap Rs 300).
- Frontend: Approvals, Seedha Link with UPI sheet, Savings with gold counter.
- Check: approve -> send -> book with code -> correct saving; code cannot be
  redeemed twice; Playwright e2e for the full 8-step loop.

M7 Proof and Ask
- Nightly job and manual "write tonight's proof": Merkle root of pending
  fingerprints; optional testnet write; mark Verified.
- Erasure removes salt and contact; proof item stays but cannot be linked.
- Ask: six fixed questions mapped to fixed SQL; Claude only phrases the
  sentence around the computed number.
- Frontend: Proof overview and dialog, Ask chat with six chips.
- Check: tests for Merkle root, erasure, and Ask numbers equal ledger numbers.

M8 Desk firmware
- PlatformIO: TFT_eSPI (ILI9488), QR generation, NeoPixel ring, ESC/POS
  printer over UART2, WiFiClientSecure, ArduinoJson, offline queue, button,
  buzzer. Pins: TFT MOSI 23, SCLK 18, CS 15, DC 2, RST 4; printer TX 17 ->
  RX, RX 16 <- TX; LED data 13 via level shifter + 330 ohm; button 27
  pull-up; buzzer 25 via NPN. Printer on its own 5 V rail.
- Check: compiles with zero warnings; mock-server test drives show_qr,
  set_ring, print_slip.

M9 Polish for demo
- Frontend: Seedha Site (setup chat, review with Pine/Stone/Sky and EN/HI,
  packages, publish, preview), Pro cards, Plans page with yearly/monthly.
- Reset button, Hindi/English toggle, empty/loading/error states everywhere,
  single make demo that seeds and starts everything.

## 7. How to work
- Before each milestone: short plan, files to touch, then build.
- After each milestone: make check, fix failures, summarise, commit locally.
- Small, typed, tested functions. Money in integer paise internally, line
  items rounded to the rupee like OTA statements, formatted with Indian
  grouping only at the edge.
- Never invent API keys, endpoints or package names. Check docs or installed
  source when unsure.
- If a secret is missing, build the simulated fallback and say so.

## 8. Git policy for this phase
- Commit locally after every milestone. Do NOT add a remote. Do NOT push.
