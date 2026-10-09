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

**Commit**: see `git log` (M1 commit "M1 Foundation").
