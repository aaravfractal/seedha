# P2 owner screens: report (branch fe/owner, not committed)

## Files per screen (apps/web)
- Shared (new): components/owner/ui.tsx (Screen with 520ms fade + 12px rise, CalcNote, Chip, SampleChip,
  Segmented with 300ms sliding pill), owner.module.css, motion.ts (useReducedMotion, useCountUp),
  draftRules.ts (client copy of edit rules), proofStatus.ts, proofDialog.module.css; lib/types-owner.ts (new).
  lib/types.ts NOT edited: added API fields are typed as intersections in types-owner.ts.
- Upload: upload/page.tsx + upload.module.css (drop zone, Reading N files, type chip rows, per-file
  "<file> could not be read" + Try again, partial count, ✓ summary, ⚠ Check rows, See my real money).
- Money kept: flip/page.tsx + flip.module.css (absolute rows, WAAPI glide 700ms between
  rank x (rowHeight+10), DOM order follows rank, never fades, MMT ring in money mode, toast 700ms later,
  column header, kept/lost bar, maths table in a details, 4 tiles, formula caption, Direct before/after card,
  "No website means few direct guests. Build one ›").
- Repeat: repeat/page.tsx + repeat.module.css. Scenario: scenario/page.tsx + scenario.module.css.
- Approvals: approvals/page.tsx + approvals.module.css. Savings: savings/page.tsx + savings.module.css.
- Ask: ask/page.tsx + ask.module.css. Proof: proof/page.tsx + proof.module.css, components/ProofDialog.tsx.
- Pro: pro/page.tsx + pro.module.css.
- globals.css, Toast, layouts, e2e untouched.

## API (apps/api), all owner-only (test_route_auth covers them automatically)
- POST /scenario/saturday/undo: appends a decision "undone" (log kept); 409 nothing_to_undo.
  GET/POST /scenario/saturday also return before_per_saturday, after_per_saturday (services/scenario.py).
- PATCH /messages/{id} {text}: draft only (409 not_a_draft), must keep "Reply STOP to opt out.", the code,
  the link, <= 600 chars, no amounts or % (422 invalid_edit with the reason). Never sends.
  GET /messages items gain perk, link, language.
- Approve now refuses (409 consent_mismatch) when the consent record no longer hashes to its fingerprint.
- GET /proof gains sealed, mismatches, entries[{bundle_id|null, consent_id, guest_name, given_at, status}]
  with status verified | pending | deleted | mismatch (re-checked against the sealed leaf and root).
  Entries are top level, not inside bundles, so bundles still carry hashes only.
  GET /proof/consents/{id} returns status "mismatch" when the re-check fails.
- GET /savings gains season {start, end, count, total_net_saving} (booked date, IST, Apr to Sep;
  services/savings.py season_review).
- GET /ask/morning: the 8 AM line from the business-date close (template only, no LLM).
- Tests: apps/api/tests/test_owner_screens_api.py (15 tests). No existing test changed.

## Checks
- ruff check: All checks passed. ruff format --check: 85 files already formatted. mypy: no issues in 84 files.
- pytest: 328 passed; total coverage 98.81%; money code (money, ledger, scenario, slips, savings) 100%.
- tsc OK; eslint 0 warnings; prettier: all files formatted; node --test: 18 pass, 0 fail.
- next build --webpack succeeds (turbopack build fails in the worktree only because node_modules is a symlink).
- Visual check: built app on spare ports 3107/8107 with headless Chromium via CDP (no Playwright),
  1440 and 390, light and dark, flip toggle exercised (ring, glide, toast). No horizontal scroll from screen
  content at 390 (the old shell's pill nav still overflows by 4px: shell work).

## E2E selectors and copy for the lead
- No changes needed as far as I can tell: kept `.row .nm`, `.toggle button` (aria-pressed), `.toast`,
  "1,500 rows matched. 3 need a look." (now prefixed by ✓ in the same heading), "MakeMyTrip #MM48213",
  "See my real money", repeat `.stat b` first = "12" and "₹41,800" (shown as "−₹41,800"), approvals `.bub`
  / `.bub.me` with "Sent", "Approve and send", savings `.item b.num` first "+₹2,199",
  "₹2,233 commission and GST avoided" (now per ledger row), "Code DEODAR-RS26 · ₹8,600 booked direct".
- ".row" nth(4) still contains "₹2,737" in money mode; in bookings mode the row value is now room nights.
- Approvals empty-state copy changed: "No guests waiting." / "New drafts appear after checkout." /
  "Open Seedha Desk" (was "No messages waiting" / "Go to Desk"). Proof screen title is now "Consent proof."
  (was "Every yes, provable.") and the button "Write tonight's bundle now".
- Screens now use h1 titles (was h2.title).

## Differences from the handoff (API wins)
- Net kept ₹47,33,012 (handoff ₹47,33,011).
- Flip stat follows ruling 3 literally: "Direct bookings 10.7%" with sub "Commission-free share 16.7%".
  D1 (and your brief) say the reverse order; rulings outrank decisions, so please confirm. One-line swap.
- "By bookings" ranks by room nights (API), so rows show room nights (list revenue in the caption);
  the handoff ranks by list revenue (Direct and Travel agents swap at 3 and 4).
- Gold card shows the all-time coded total (₹12,600 before Rahul, ₹14,799 after) labelled
  "Commission saved with perk codes"; Season in review shows ₹12,600 from 4 bookings.
- 8 AM line: "Kal 14 room bike, aapke paas ₹46,691 bache." (handoff ₹47,900). Ask answer 1 is the real
  September figure ₹1,09,542.
- Repeat: Neha 85% and A. Verma 65% from the matcher (handoff 88% and 74%).
- Flip insight HI/EN text comes from the API insight builder, not the handoff sentence.

## Not done / notes
- The screen enter animation lives on each screen; the old `.view` rise in globals.css also runs, so the
  shell builder should drop one of them.
- "Confirm matches" confirms the shown suggestions at 80% or more with one owner tap (sequential POSTs);
  below 80% each needs Confirm / Not same. Matches are never confirmed without a tap (ruling 7).
- Pulse and Rate Watch figures are fixed sample text with a visible "Sample" tag (D10); small Pro cards
  carry no figures except the real consent count.
- No dedicated client test for draftRules.ts (node --test only runs lib/*.test.ts); the server rules are tested.
