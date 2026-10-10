# Ideas built (fe/ideas, 11 Oct 2026)

All three ideas built within budget (about 20 minutes of wall time in total). Nothing committed.
No schema, seed, shell, globals.css, layout or e2e changes.

## 1. Seedha Recover (built, about 10 min)
- `services/pro.py`: new `audit_lines()` (one `AuditLine` per claimable line); `audit()` now sums it,
  so the Pro Audit figure and the Recover total come from the same function.
- `services/recover.py` (new): a fixed template filled by code from the stored row and the contract.
  No LLM. Lines as printed, TDS and GST TCS marked "a tax credit, not part of this claim" (rule 2).
  Kinds: cancelled commission (Audit), over contract rate (Audit), payout shortfall and GST above 18%
  (`other_claim`, shown separately), missing GST line (asks for the tax invoice, claims nothing).
  Booking ref only, no guest name. Accepted rows get no dispute (same as Audit).
- Endpoints (owner-only, OwnerDep; the route-auth sweep covers them and passes):
  `GET /statements/disputes` -> {audit_claim, other_claim, disputes[]};
  `GET /statements/rows/{id}/dispute` (404 `no_dispute` when there is nothing to query).
  Drafting changes nothing: the row stays pending and out of the flip (rule 3). Nothing is sent (rule 8).
- Web: `components/owner/Recover.tsx` + `recover.module.css`. Upload summary shows "To claim back: ₹802 in
  commission, the same figure as Seedha Audit. Payout short: ₹120, asked for separately." with
  "Calculated from your statements." Each flagged row: "Draft a dispute" opens the letter inline with
  "Copy dispute" (clipboard). Over-rate lines that pass the math check are listed under the flagged rows.
  Pro Audit card links "Draft the disputes" to `/upload#disputes`.
- Sample data: AG77102 claim ₹802 (₹680 + ₹122); MM48213 payout ₹3,120 vs ₹3,240, ₹120 short;
  BK55320 GST line missing, payout gap ₹128 = 18% of ₹713, asks for the tax invoice. Audit = Recover = ₹802.
- Not done: Hindi letter (OTA partner teams correspond in English; easy to add as a second template).
- Tests: `tests/test_recover.py` (9 tests: totals equal Pro, letter text, no guest names, no "!" or em dash,
  drafting is not a review, 404s, accepted row drops out of both, over-rate matches Audit, GST over/under,
  overpaid row, rate formatting).

## 2. Split the Commission, minimal (built, about 6 min)
- `services/savings.py`: `perk_split()` and `SAMPLE_PERK_COST_PER_NIGHT` (₹400, breakfast for two, the
  Seedha Site extra). avoided = UPI fee + perk cost + kept. `compute_saving` and ruling 5 untouched.
- `GET /savings` items add `nights, perk, perk_cost, kept_after_perk`; response adds `perk_cost_per_night,
  perk_cost_is_sample`. Optional `?perk_cost_per_night=<whole rupees 0..5000>` (owner-entered, not stored).
- Web: `components/owner/PerkSplit.tsx`. On Savings, a "Your perk cost per night" field (chip "Sample" until
  the owner enters one) and per row "See the split": "MakeMyTrip would have taken ₹2,233. Perk given: Free
  breakfast on your next direct stay (2 nights) [Sample cost] −₹800. UPI fee −₹34. You keep beyond the
  perk +₹1,399 (gold)". "The guest paid the same public rate, ₹8,600." (rule 6; no "₹ off" wording).
- Sample numbers: Rahul DEODAR-RS26 ₹2,233 avoided, ₹2,199 net (unchanged), perk ₹800, kept ₹1,399.
  History rows: IF26 kept ₹2,369, AM26/SB26 ₹1,877, KF26 ₹77 (6 nights of breakfast).
- Tests: `tests/test_perk_split.py` (split adds up, negative case, Rahul end to end with locked ruling 5
  numbers, owner cost 250 -> ₹500 / ₹1,699, 422 on bad input). savings.py coverage 100%.

## 3. Direct Booking Score, minimal (built, about 5 min)
- Pure helper `lib/readiness.ts` (+ `lib/readiness.test.ts`, 4 tests). Three parts from /overview data:
  Direct bookings (`direct_bookings_tenths`), Commission-free share (`commission_free_share_tenths`),
  Coded direct bookings (`savings.count`). Part = min(100, round(actual / goal x 100)); total = mean.
  No rupees. Each part shows its formula, e.g. "10.7% of a 20.0% goal = 54 of 100".
- Goals: suggested 20% / 30% / 10 bookings, chip "Suggested goals"; "Set your goals" form saves them in
  this browser's localStorage (try/catch; per-viewer convenience). Parts first, total second
  ("Readiness 53 of 100, the mean of the three parts."). Labels link to /flip and /savings.
- `components/owner/ReadinessCard.tsx` rendered in `app/(owner)/home/page.tsx` after the KPI tiles (only
  with statements). Sample: 54, 56, 40 (4 coded) -> 50; with Rahul's booking 50 -> 53.

## Checks (all pass)
- API: ruff check, ruff format --check, mypy (106 files) clean; pytest 467 passed; money coverage 100%
  (money, ledger, scenario, slips, savings); recover.py and pro.py also 100%.
- Web: next typegen, tsc, eslint --max-warnings=0, prettier --check clean; node --test lib 56/56.
- axe (wcag2a/aa, 21aa, best-practice) on /upload (dispute open), /pro, /savings (split open), /home:
  0 violations each, light and dark, 1440 and 390, no horizontal overflow, reduced motion emulated.

## For the lead
- e2e: nothing breaks by inspection (loop.spec `rahul.locator("b.num")` still matches only the net
  saving; the split is closed by default and uses module classes). Optional new e2e: Upload "Draft a
  dispute" on AG77102 shows "Total to claim back: ₹802."; Savings "See the split" on DEODAR-RS26 shows
  "+₹1,399".
- docs/decisions.md entry suggested: Recover total = Audit (shared audit_lines), shortfall separate;
  perk cost is a sample constant until an owner setting exists; readiness goals are browser-local.
