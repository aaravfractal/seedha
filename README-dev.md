# Seedha: developer guide

Seedha reads a small hotel's OTA payout statements, shows what each booking
channel really leaves after commission, GST and fees, finds guests who came
back through an OTA, collects their consent at the front desk, and lets them
book direct with a perk instead of a discount. `CLAUDE.md` is the source of
truth for the product and its rules; this file is how to run it.

All data in this repo is fictional sample data for "Deodar Stays", Mussoorie.

## Run the demo

Needs Python 3.11+ (3.12 tested), Node 20+ and GNU Make.

```bash
cp .env.example .env    # optional: make demo does this if .env is missing
make demo
```

`make demo` installs the API and web dependencies, builds a fresh database
with the sample hotel, makes a production build of the web app, and starts:

- web: http://localhost:3000 (log in with `OWNER_PASSCODE`, `deodar-demo` in `.env.example`)
- API: http://localhost:8000 (`/docs` lists every route)

Stop with Ctrl+C. For development with reload use `make dev` instead.

| Command | What it does |
|---|---|
| `make demo` | First run: `.env`, install, seed, build, start |
| `make dev` | API (8000, reload) and web (3000, dev) |
| `make seed` | Fresh database: sample hotel, no statements loaded yet |
| `make seed-full` | Same, with the 1,500 statement lines already loaded |
| `make test` | API and web unit tests |
| `make e2e` | Playwright suite (starts its own servers on 8001 and 3001) |
| `make check` | Every quality gate (see below) |
| `make secrets-history` | Scan every commit for secrets |
| `make proof-nightly` | Build tonight's consent proof bundle |
| `make firmware` | Compile the Desk firmware for the ESP32 |

## Demo script (about 5 minutes)

Run `make seed` first so the loop starts empty. Home shows "0 of 8 steps
done". Each step is also a screen in the sidebar.

1. **Upload.** Upload, then "Use sample statements". Six files are read:
   two MakeMyTrip PDFs, Booking.com and travel-agent Excel sheets, an Agoda
   CSV and the hotel's own register (direct and walk-in): "1,500 rows matched. 3 need a look." Rows whose
   numbers do not add up within ₹1 are flagged and left out until reviewed.
2. **The flip.** "See my real money". Paid to channels **₹10,39,108**; lost
   vs list price ₹15,71,988. MakeMyTrip leads by bookings; tap "By money
   kept" and it drops from 1st to **5th** (₹2,737 kept per room night).
   Direct bookings are 10.7% of room nights.
3. **Repeat guests.** **12** guests came back through an OTA, and the hotel
   paid **₹41,800** commission and GST on them twice. The owner confirms
   each match; a match alone never allows a message.
4. **Desk consent.** Desk, pick room 207 (Rahul Sharma), "Show QR". The
   guest's phone appears beside it: the consent box is unticked, the guest
   types a WhatsApp number, ticks, and says yes. The Desk ring turns green.
5. **Checkout slip.** "Check out and print": the slip shows what the hotel
   kept on this booking and Rahul's perk code **DEODAR-RS26**.
6. **Approve.** Approvals: the win-back draft ("Namaste Rahul ji", ending
   "Reply STOP to opt out."). Nothing is sent until the owner approves.
7. **Direct booking.** Open `/link/DEODAR-RS26` (a guest page, no login).
   Free breakfast, same price as the hotel's public rate. Pay ₹8,600 with
   simulated UPI. The code works once.
8. **Savings.** Savings shows **₹2,233** commission and GST avoided (the
   original MakeMyTrip contract rate of 22% plus 18% GST) and **+₹2,199**
   net after the UPI fee. Home now says "All 8 steps done".

Also worth showing: Ask ("How much did I pay MakeMyTrip last month?" gives
the September figure, ₹1,09,542), Scenario (Saturday), Proof (each consent's fingerprint and the
nightly Merkle root), and the dark theme.

## Keys: what is real and what is simulated

Every integration is optional. With an empty key, that part runs in a
simulated mode that is labelled in the UI and logged by the API at startup
("... keys missing: running in SIMULATED mode"). Money is always computed by
code, never by a model, whatever is configured.

| Integration | `.env` keys | Without keys |
|---|---|---|
| Claude | `ANTHROPIC_API_KEY`, `CLAUDE_MODEL` | Known statement layouts are parsed by code; a new layout is refused with a request for CSV; match tie-breaks use the score alone; messages use fixed wording |
| WhatsApp Cloud API | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_API_VERSION` | Sends are simulated and labelled; inbound webhooks are refused (503) |
| Razorpay | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Simulated UPI, labelled "test mode, no money moves". Razorpay checkout is not built yet |
| Polygon Amoy | `PROOF_RPC_URL`, `PROOF_PRIVATE_KEY` | Merkle roots are stored locally and labelled "not yet on a public chain". The chain write itself is not built (docs/blockers.md B-001) |

To add a key, put it in `.env` and restart. Never commit `.env`; the
pre-commit hook and `make check` scan for secrets.

The demo values of `OWNER_API_TOKEN`, `OWNER_PASSCODE`, `SESSION_SECRET` and
`DESK_DEVICE_KEY` must be changed for anything beyond a local demo.

## Layout

```
apps/api      FastAPI, SQLAlchemy, Alembic. Money in integer paise.
  app/        routers/, services/, money.py, models.py
  seed/       deterministic sample hotel and the six sample statements
  tests/      pytest
apps/web      Next.js 16 (App Router). Owner screens, guest pages, Desk simulator.
  app/api/    the BFF: adds the owner token or device key on the server side
  e2e/        Playwright: the 8-step loop, security, accessibility, speed
firmware/     the Desk box (ESP32, PlatformIO); see its README
docs/         progress, decisions, rulings, blockers, needs-from-aarav
scripts/      repository tools (history secret scan)
```

The browser never calls the API directly and never holds a secret: it calls
`/api/*` on the web app, which checks the owner session and forwards
allowlisted routes (`apps/web/lib/bff.ts`).

## Quality gates

`make check` runs everything and fails on any problem:

- API: ruff, ruff format, mypy (strict), pylint ≥ 9.5, pytest with coverage
  ≥ 85% overall and 100% on money code, bandit, pip-audit, detect-secrets
- Web: tsc, eslint, prettier, unit tests, npm audit (no high or critical in
  production dependencies)
- e2e: Playwright on a production build
- Secrets: every commit in history
- Firmware: native unit tests and the ESP32 build

## Security notes

- Owner routes need the owner token (added by the BFF after login); Desk
  routes need the device key. A test checks every route in the API schema.
- Public routes (consent, Seedha Link, data deletion) and owner login are rate
  limited per client (docs/decisions.md D-071). In production, put a proxy in
  front of the web app that overwrites `X-Forwarded-For`.
- Consent links are single use and expire in 10 minutes. Perk codes redeem
  once. Guest numbers are never logged, and nothing personal goes into a proof.
- Security headers (CSP, frame and referrer policies) are set in
  `apps/web/next.config.ts`.

## Troubleshooting

- **Styles look stale in `make dev`**: `make web` clears `.next/dev`; restart it.
- **Port in use**: the demo uses 3000 and 8000; e2e uses 3001 and 8001.
- **"Too many tries" on login**: wait 15 minutes or restart the web server.
- **`make firmware` hangs downloading the toolchain**: PlatformIO's registry
  is sometimes slow; retry (docs/blockers.md B-002).
