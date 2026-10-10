# P8 My Place (2D) report

Worktree .worktrees/myplace, branch fe/myplace. Not committed.

## Files
- API: apps/api/app/services/myplace.py (model), apps/api/app/routers/myplace.py (GET /my-place),
  apps/api/tests/test_myplace.py (18 tests), app/main.py (include router).
- Web: app/(owner)/(screens)/my-place/page.tsx (replaces NotBuilt), components/myplace/{RoomMap,Panels,CostForm}.tsx
  + myplace.module.css, lib/myplace.ts + lib/myplace.test.ts, lib/types-myplace.ts,
  lib/bff.ts + test ("my-place" owner path), lib/screens.ts (My Place no longer `built: false`).

## Endpoint and model
GET /my-place?month=season|YYYY-MM&cost_per_night=<rupees>&fixed_monthly=<rupees> (owner only; 401 without token,
422 on bad month or out-of-range inputs: cost 0..1,00,000, fixed 0..1,00,00,000). Nothing is saved, no schema change.
- Ledger (load_ledger) for the season (Apr to Sep) or one month: channel mix (stay room nights), net ADR per channel, occupancy.
- Rooms from the room table (22 for the sample; synthetic 101.. if none). Main channel per room by largest remainder over
  room nights, spread across floors with a smooth weighted round robin (deterministic).
- nights = round(30 x occupancy) half-up; net = nights x channel net ADR; variable = nights x cost per night;
  fixed share = fixed / rooms split in whole rupees so shares sum to the fixed total exactly; profit = net - variable - share.
- break_even_rooms = ceil(fixed x rooms / sum(net - variable)); null when rooms do not cover their nightly cost.
- Cost source: query > owner account's onboarding "cost per occupied room" (subject a<id>) > sample defaults
  (Rs 900 per night, Rs 4,50,000 a month) flagged `sample` with note "Sample cost. Enter your own to see your numbers."
- All paise integers via app/money.py (rupees, share_tenths_of_percent); net ADRs are already rupee-rounded by the ledger.
- Sample season: occupancy 37.3%, 11 nights per room, net kept Rs 7,56,250, profit +Rs 88,450, 11 of 22 rooms in profit,
  break-even 19 rooms; MMT 9 rooms (41.3% of nights, Rs 2,737), Direct 2 rooms (Rs 4,283).

## Web
KPIs (net kept per month, profit with sign, rooms in profit, break-even rooms); "Illustration" chip, Sample chip
(sample hotel or sample costs), label "Illustration from your statements mix", month select (season + Apr..Sep);
Profit / Channel segmented switch (shared Segmented, aria-pressed); 2D room map by floor with zoom -/+ (3 tile sizes),
tiles show number plus signed profit or short channel name (colour never alone; legend with + / - and channel names
with room counts); tap a room for a popover (net, room costs, fixed share, profit; Esc or close returns focus);
sortable room table (aria-sort, header buttons) synced with selection (row select marks the tile; selecting another
room closes the popover); profit by floor bars; month summary with channel split; cost inputs (whole rupees, inline
errors, "Reset costs"); "3D view coming soon" note; CalcNote "Calculated from your statements." + Illustration text.
Reduced motion disables tile, popover and bar animation.

## Checks
- API: ruff check OK; ruff format --check OK (112 files); mypy OK (111 files); pytest 492 passed.
- Web: next typegen OK; tsc OK; eslint 0 warnings; prettier OK; node --test lib/*.test.ts 64 pass, 0 fail.

## axe
axe-core (wcag2a/aa, 21a/aa) on /my-place, light and dark, 1440/980/760/390, three states each (base, room popover
open, Channel mode): 0 violations, no horizontal overflow. One fix needed: the shared Segmented's unselected label on
the card fill was 4.41:1 in light; overridden locally in myplace.module.css (.modeSwitch) without touching
components/owner. Functional run: table select marks tile, popover figures, Esc closes and refocuses, sort by profit,
invalid input error, owner costs recompute, month switch, reset restores sample costs.

## 2D vs 3D
Everything is 2D. No 3D started, so three@0.160 is NOT needed for this deliverable. If 3D is wanted later the lead must
`npm install three@0.160 @types/three`; the GET /my-place payload (rooms with floor, channel, profit) is enough for it.

## Remaining differences vs handoff
- No 3D miniature hotel (tilt-shift, pool, pines, terrain); 2D grid plus the "3D view coming soon" note (D13).
- "Property controls" interpreted as month select and cost inputs; zoom changes tile size.
- Room-to-channel assignment is an illustration (statements do not record physical rooms); said on screen.

## e2e notes
No e2e run. e2e/a11y.spec.ts already visits /my-place; it should pass (0 axe violations in my scans). The page waits
for the API, so a spec that looks for the old NotBuilt text would need updating (none found in e2e/).
