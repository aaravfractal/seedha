# T2 · Playwright for live features (worktree .worktrees/t2, branch live/t2, not committed)

## Files (apps/web/e2e only; no app code, loop.spec.ts untouched)
- helpers.ts: + resetSampleHotel (POST /api/demo/reset; on 429 waits 61 s once, then retries),
  expectedPublicOrigin (PUBLIC_BASE_URL as playwright.config.ts would pass it: the .env/.env.example
  value wins if the key is there, else process.env, else the e2e baseURL), scrollsSideways, axeViolations.
- desk-kiosk.spec.ts: QR data-url must start with `<expected origin>/consent/` and the line under it reads
  `Opens <expected host>`; guest opens only the path on the e2e server (works with a tunnel/LAN base URL);
  idle checks (`<hotel> · Ready`, no QR); paper toggled back on clears red and keeps the slip; uses the
  reset helper.
- proof-live.spec.ts: serial; afterAll reset (the local test left a consent and a bundle, so loop.spec
  would have seen "1 of 8 done" if it ran later); new mocked amoy tests: sent -> Refresh -> toast and line
  "Verified on Polygon Amoy testnet, block 4242425", Refresh gone, no Settings top-up hint for a funded
  wallet; failed -> "Not confirmed", no Refresh, explorer link with rel. afterEach unrouteAll (a mocked
  GET in flight at test end otherwise fails the test with "route.fetch: Test ended").
- events.spec.ts: API refuses an http:// source directly (422 bad_source_url); new counter test
  (6,010 chars: "6,010 / 6,000", "Remove 10 to continue.", aria-invalid, no extract request; back to 6,000
  clears it); main flow now reloads after save (card persists with "From your sources", "Sample
  extraction", "Likely overnight demand") and after "Add to plan" (still "Remove from plan").
- live-smoke.spec.ts (new): light/dark x 390/1440 on /desk/device, /calendar with the Add events sheet
  open, /proof: theme applied, key text visible, no sideways scroll, axe WCAG 2.1 A/AA = 0. Read only.
- a11y.spec.ts: theme cookie uses baseURL instead of hard-coded localhost:3001 (same value on 3001).

## Runs
Temp config (ports 3880/8880, scratch DATABASE_URL, `next build --webpack`), full suite twice in a row:
35/35 passed both times (4.1 m, 4.4 m). Temp configs, .next and servers removed/stopped.
DB after proof-live, events and live-smoke matches a fresh seed (table counts; only desk_device differs,
from DESK_DEVICE_KEY). tsc, eslint --max-warnings=0, prettier --check: pass.

## Reset rate limit (2 a minute)
Only two specs reset: desk-kiosk (afterAll) and proof-live (afterAll), so a run can never exceed 2.
If one more is added within 60 s, the helper waits the window out instead of failing.

## No real bugs found.

## Pre-existing order dependencies (not changed; for the lead)
- owner.spec.ts leaves Neha's consent and draft (room 104) and loop.spec.ts leaves 8/8 done; both rely on
  running after loop's "0 of 8 done" check (alphabetical order). perf.spec.ts relies on loop's statements.
  Making them order-free needs a reset in owner/perf afterAll (2 more resets; the helper handles the wait).

## Proposed config change (optional, not applied)
In playwright.config.ts: `const publicBase = fileEnv.PUBLIC_BASE_URL || process.env.PUBLIC_BASE_URL || "";`
`process.env.PUBLIC_BASE_URL = publicBase;` and pass `PUBLIC_BASE_URL: publicBase` in the API env, so specs
read one value from process.env (helpers.expectedPublicOrigin would then not need to read .env itself).
