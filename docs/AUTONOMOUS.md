AUTONOMOUS BUILD MODE: SEEDHA, M1 TO M9 PLUS STATIC PAGES

I am offline until I return. Work autonomously from now on. Do not wait for
"go" or "continue" between milestones. Keep working until every milestone
below is complete or you are blocked on something only I can provide.

## 0. ANSWERS TO YOUR QUESTIONS A TO D (FINAL)

A. Dependencies: approved. uvicorn, alembic, httpx, ruff, plus the
   create-next-app defaults. Also approved for later milestones:
   pytest, pytest-cov, mypy, pylint, bandit, pip-audit, pre-commit,
   detect-secrets, rapidfuzz, anthropic (official SDK), openpyxl, pdfplumber,
   python-multipart, Playwright, Prettier. No paid services. Anything else
   free and well-known that a milestone needs: add it, and log why in
   docs/decisions.md.

B. Statement rows: agree with your recommendation. A row is a statement
   line (a booking, a cancellation line or an adjustment). Keep 410 + 412 +
   214 + 96 + 180 + 188 = 1,500 rows. The 3 flagged rows are excluded, and
   every locked total comes from the 1,497 rows that pass.

C. Commission paid twice: agree. It is commission plus GST on commission on
   each guest's return OTA booking. First stays are seeded as 2025 history
   outside the Apr to Sep 2026 window. Total 12 guests, Rs 41,800.

D. Desk guests: agree. Neha, Rahul and Arjun's current stays are October
   2026 bookings outside the ledger window. The ledger takes an explicit
   date range that defaults to 1 Apr to 30 Sep 2026, and a test proves
   Desk activity never changes the locked totals.

## 1. HOW YOU RUN WITHOUT ME

For each milestone in order, run the loop you already know:
PLAN -> BUILD -> VERIFY -> AUDIT YOURSELF -> FIX -> REPEAT until zero
failures -> REFACTOR PASS -> make check -> COMMIT LOCALLY -> next milestone.

Replace "STOP and wait for me" with these rules:
1. Do not stop between milestones. After each commit, update the logs in
   section 6 and start the next milestone.
2. When a decision is needed, choose the option that best follows CLAUDE.md,
   the prototype and my rulings 1 to 7, record it in docs/decisions.md
   with the reason, and continue.
3. When something is blocked (missing API key, unavailable network,
   hardware not present), build the simulated fallback, label it in the UI,
   add it to docs/needs-from-aarav.md, and move on to the next piece of
   work that is not blocked.
4. If a check fails three times in a row on the same issue, record it in
   docs/blockers.md with what you tried, leave the test failing visibly
   (never weaken or skip it), and continue with independent work.
5. If your context is compacted or a session restarts, re-read CLAUDE.md,
   docs/progress.md and docs/decisions.md before doing anything else.

Hard limits that still apply while I am away:
- Never add a git remote and never push.
- Never delete or modify anything outside this repo folder.
- Never change a business rule in CLAUDE.md section 2 or my rulings.
- Never lower a quality threshold, disable a rule or skip a test.
- Never sign up for, pay for or call a paid service. Use simulated
  fallbacks.
- Never put real personal data anywhere. All data is fictional sample data.

## 2. FRONTEND SCOPE (EVERY SCREEN, WIRED TO THE REAL API)

Every screen in prototype/index.html must exist in apps/web with the same
design, copy, numbers, states and animations, using the API, not
hardcoded values. Ownership:
- M1: app shell, navigation (Owner / Desk / Guest / Plans), owner sidebar,
  tokens, light and dark, toast, Pipeline home with 8-step tracker
- M2: Upload screen
- M3: Flip screen (toggle and animated reorder are the hero; get them perfect)
- M4: Repeat guests (Confirm) and Saturday move
- M5: Desk device simulator, guest consent page, both slips
- M6: Approvals, Seedha Link with UPI sheet, Savings with gold counter
- M7: Proof overview and dialog, Ask chat with six chips
- M9: Seedha Site (setup chat, review with Pine/Stone/Sky and EN/HI,
  packages, publish, preview), Pro cards, Plans with yearly/monthly

Each screen: seed data renders, empty / loading / error states, works at
390 px and 1440 px, labels and focus rings, 4.5:1 contrast. Playwright e2e
for the full 8-step loop by M6, kept green afterwards.

## 3. STATIC AND LEGAL PAGES (ADD AS MILESTONE M10, AFTER M9)

Build these pages in apps/web, linked from a site footer on every page,
same design system, readable at large type, Hindi and English toggle where
the rest of the app has it:
- /about: what Seedha is, problem D6, team (Aarav Sharma, Ishan Singh,
  Madhav Nauriyal, [Hospitality teammate]).
- /privacy: privacy policy written for India's DPDP Act 2023 and DPDP Rules
  2025. Cover: what data is collected (owner account data, uploaded
  statements, Desk consent records with WhatsApp number), purpose, legal
  basis (consent for guest marketing), retention, guest rights (access,
  correction, erasure, withdraw consent by replying STOP), that OTA-provided
  guest contacts are never used for marketing, that only salted fingerprints
  go on a public chain, processors (hosting, WhatsApp Cloud API, payment
  gateway, Claude API for statement reading), grievance contact. Use
  [contact email] and [grievance officer name] as visible placeholders.
- /terms: terms of use for hotel owners (subscription, owner responsible for
  approving every message, no lower public rates via Seedha, acceptable use,
  limitation of liability, governing law India, Dehradun jurisdiction).
- /cookies: cookie policy. Use only strictly necessary cookies (session,
  theme preference). No analytics or advertising cookies, so no cookie
  banner is needed; say this plainly.
- /data-deletion: a page where a guest can request erasure of their consent
  record with booking reference and phone; creates a request in the API and
  shows what will and will not be deleted (fingerprint stays but becomes
  unlinkable).
- /security: responsible disclosure page with [security email] placeholder.
- /contact and /faq (10 questions a hotel owner would ask, answered from
  CLAUDE.md facts only).
- Custom 404 and 500 pages in the Seedha style.

Every legal page starts with a visible notice: "Draft for the hackathon
prototype. Not legal advice. To be reviewed by a lawyer before launch."
Last updated date on each page. No invented company registration numbers,
addresses, emails or names beyond the placeholders above.

## 4. CODE QUALITY GATES (SET UP IN M1, ALL MUST PASS BEFORE EVERY COMMIT)

Python: ruff (E, F, W, I, B, UP, S, N, SIM, RET, ARG, C4, PL) and ruff
format; pylint 9.5 or higher; mypy strict; pytest-cov 85% overall and 100%
on money code (app/money.py, services/ledger.py, savings logic); bandit
zero high or medium; pip-audit zero known vulnerabilities.
TypeScript: strict tsconfig, tsc --noEmit zero errors, ESLint (Next.js
recommended, no unused vars, no explicit any), Prettier, npm audit zero
high or critical.
Firmware: zero warnings with -Wall -Wextra, secrets only in a gitignored
config with a committed .example.
Automation: pre-commit with ruff, prettier, eslint, mypy and detect-secrets;
`make check` runs every gate and fails on any failure.
Standards: small single-purpose functions, docstrings that state the
business rule, no duplicated money logic, no commented-out code, typed
errors, every endpoint tested for success, bad input and unauthorised.

## 5. ORDER OF WORK

M1 Foundation -> M2 Upload and parser -> M3 Ledger and flip -> M4 Repeat
guests and scenario -> M5 Desk, consent, slips -> M6 Win-back, Link,
savings, Playwright e2e -> M7 Proof and Ask -> M8 Firmware (compile and
mock-server tests only; no hardware present) -> M9 Polish, Site, Pro,
Plans -> M10 Static and legal pages -> M11 Final hardening.

M11 Final hardening:
- Run the full Playwright suite three times in a row; all green.
- Security pass: input validation, auth on every owner and device route,
  rate limits on public routes (consent, link, data-deletion), CORS locked
  to the web origin, no secrets in the repo history (scan with
  detect-secrets), dependency audit clean.
- Performance pass: flip screen interactive in under 1 second on seed data.
- Accessibility pass on every page.
- `make demo` from a fresh clone works with only .env.example copied to
  .env (all simulated fallbacks on).
- Update README-dev.md: how to run, how to add real keys later, what is
  simulated, and the exact demo script for the hackathon (use Rahul's
  code DEODAR-RS26 on Seedha Link so savings show Rs 2,233 avoided,
  Rs 2,199 net).

## 6. LOGS I WILL READ WHEN I RETURN (KEEP THEM CURRENT)

- docs/progress.md: one section per milestone with status, what was
  built, test counts, the code quality line, numbers checked, commit hash.
- docs/decisions.md: every decision you made without me, with the reason.
- docs/needs-from-aarav.md: API keys, files, hardware or choices only I
  can provide, in priority order.
- docs/blockers.md: anything stuck, what you tried, what would unblock it.

Code quality line format, in every progress entry:
ruff 0 · pylint x.x · mypy 0 · coverage x% (money 100%) · bandit 0 ·
pip-audit 0 · tsc 0 · eslint 0 · npm audit 0 high · e2e x/x

## 7. START NOW

Start M1 using the plan you already wrote, with decisions A to D above.
Then continue through M11 without stopping. When everything is done or
only blocked items remain, write a final summary at the top of
docs/progress.md and stop.
