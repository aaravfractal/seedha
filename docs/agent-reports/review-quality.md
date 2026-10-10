# Code quality review: P1 to P4 (cb7e000..8e02dae)

Reviewer: code quality (read-only). Security findings S1 to S15 live in review-security.md and are not repeated.
Runs: API `pytest` 376 passed, coverage 99% on touched modules (overview.py 97%); ruff, ruff format, mypy clean;
pylint 9.99. Web: `tsc --noEmit` clean, `eslint . --max-warnings=0` clean, `prettier --check` clean, `node --test lib/*.test.ts` 40 passed.

## Correctness found while reviewing

| id | sev | file:line | problem | concrete fix |
|----|-----|-----------|---------|--------------|
| Q1 | medium | apps/api/app/services/overview.py:333; apps/api/app/routers/scenario.py:64-72,76 | After `POST /scenario/saturday/undo`, `latest_decision` returns the `undone` row, so Overview's "Saturday move" Needs-you item never comes back. The Scenario card treats `undone` as no answer (`saturday_out`), so the two screens disagree. No test covers Overview after an undo. | Add `answered_decision()` in scenario (returns None when the latest is `UNDONE`) and use it in both places. Add a test in test_overview.py: accept, undo, Needs you lists `scenario` again. |

## Duplication

| id | sev | file:line | problem | concrete fix |
|----|-----|-----------|---------|--------------|
| Q2 | medium | apps/web/app/(owner)/(screens)/flip/page.tsx:16,29-35; savings/page.tsx:14-22; lib/format-overview.ts:41-49 | `rangeLabel` (flip) and `seasonLabel` (savings) are line-for-line copies of `monthRange`. | Delete both and call `monthRange(start, end)`. |
| Q3 | medium | lib/format.ts:6,47 vs lib/format-overview.ts:6-20; lib/linkPrefill.ts:11 | Two format modules each define `MINUS` and a month list. A third month list is in linkPrefill. `format-overview.ts` is formatting for every screen, not only Overview. | Merge format-overview.ts into lib/format.ts (one `MONTHS`, one `MINUS`) and merge the tests. Import the month list in linkPrefill. |
| Q4 | medium | approvals/page.tsx:25-39; components/owner/proofStatus.ts:19-33; lib/format-overview.ts:52-64 | There are three IST timestamp formatters (`deskStamp`, `istStamp`, `timeLabel`), each with its own `Intl` options. | Keep one `istParts(iso)` helper in lib/format.ts, build the three label shapes from it, and test it in node. |
| Q5 | medium | components/owner/draftRules.ts:1-18 vs apps/api/app/services/messages.py:153-171, drafter.py:21-22 | The client copies the API's edit rules: the money regex, MAX_LENGTH 600 and the messages. Nothing checks that the two copies stay the same. Once S5 widens `MONEY_PATTERN`, the client will still allow drafts the API rejects. | Add `GET /messages/rules` (pattern and max length), or a node test that reads drafter.py and asserts the regex source and 600 match. At least add draftRules.test.ts with the API's test strings. |
| Q6 | medium | home/overview.module.css:75-130 vs components/owner/owner.module.css:53-130; home/parts.tsx:55-77 | There are two stat-tile systems (`.tiles/.tile/.value/.label` against `.tile/.tileLabel/.tileValue/.tileSub`), two `.calc` lines (13px against 14px), and `.gain/.loss` defined twice. Overview writes the "Calculated from your statements" line by hand (parts.tsx:117,184) instead of using `CalcNote`. | Move the Overview `Tile` into components/owner/ui.tsx (with a `gold` tone). Use `CalcNote` everywhere and delete the module copies. |
| Q7 | medium | home/parts.tsx:16-23; flip/page.tsx:19-26 | `CHANNEL_COLOUR` is copied, with different fallbacks (`--ink2` against `--ch-agoda`). | Export `channelColour(key)` from one module, for example lib/channels.ts. |
| Q8 | low | home/parts.tsx:37-52; flip/page.tsx:141-149; ask/page.tsx:53; components/KeyPoints.tsx:13 | There are four Hindi/English toggles with mixed copy ("Hindi mein dekhein" against "dikhao") and mixed state shapes. | Add one `<LangToggle>` in components/owner/ui.tsx with one wording. |
| Q9 | low | savings/page.tsx:24; pro/page.tsx:21,64; proof/page.tsx:125; upload/page.tsx:176-177; parts.tsx:92 | Pluralising is written inline six times. | Add `plural(n, word)` to lib/format.ts with a test. |
| Q10 | low | LinkBooking.tsx:36-38; components/desk/chime.ts:32-34; components/owner/motion.ts:5-20 | The reduced-motion query is written three times. | Use `useReducedMotion` or export one `prefersReducedMotion()` from motion.ts. |
| Q11 | low | app/(app)/login/page.tsx:36, signup/page.tsx:33, otp/page.tsx:96,133, onboard/page.tsx:61,110; AuthFrame.tsx:98-101 | Five hand-written `fetch` + JSON + error blocks repeat `api()`/`postJson` from lib/api.ts. There are two default error texts ("Something went wrong" against "...Try again."). | Call `postJson("auth/otp/request", ...)` and catch `ApiError`. Drop `errorMessage`. |
| Q12 | low | approvals/page.tsx:181; components/ProofDialog.tsx:14,90 | The proof label logic is written again by hand instead of `proofStatus()`. Approvals never shows "Mismatch", although `.proof.mismatch` exists (approvals.module.css:57-63). | Use `proofStatus(m.proof_status)`. Pass mismatch through, or delete the CSS. |
| Q13 | low | apps/api/app/services/overview.py:236-244; routers/link.py:205; services/desk.py:215 | The savings total is computed three ways: a SQL sum, a Python sum and another SQL sum. | Add one `savings_totals(session, property_id)` in services/savings.py and use it in all three places. |
| Q14 | low | apps/api/seed/coded_history.py:100-162 | The seed builds DirectBooking + PerkCode + Saving by hand, alongside `services/link.book`. The arithmetic is shared through `compute_saving`, but the row wiring could drift. | Split out `record_coded_booking(...)` from link.book and call it from the seed. |
| Q15 | low | auth.module.css:28, Desk.module.css:466, Guest.module.css:417, globals.css | `@keyframes rise/pop/spin` is copy-pasted into three modules. | Keep them in globals.css and reference them with `:global(rise)`. |

## API structure and money

| id | sev | file:line | problem | concrete fix |
|----|-----|-----------|---------|--------------|
| Q16 | medium | apps/api/app/services/overview.py:27-28 | A service imports from routers (`STEP_KEYS, compute_steps`, `DEFAULT_ROOMS, latest_decision`). This inverts the layers and risks import cycles. `latest_decision` is typed with `SessionDep`. | Move `compute_steps`/`STEP_KEYS` to services/pipeline.py and `latest_decision`/`DEFAULT_ROOMS` to services/scenario.py, typed `Session`. |
| Q17 | low | services/overview.py:113-114,203; routers/overview.py:181 | ADR totals are computed in Overview (`per_unit_rounded`) instead of in `summarise`. Direct-share rounding is inline (`(…+5)//10`). `Kpis.available_room_nights` is computed but never sent, and the router computes `rooms_count*days` a second time. | Add `net_adr`/`list_adr` to the ledger totals. Add `share_whole_percent()` to app/money.py. Send `kpis.available_room_nights` (or drop it). |
| Q18 | low | apps/api/app/routers/auth.py:363-364,388,396 | Conversions between bps and percent, and between paise and rupees, are inline in the router (`/100`, `//100`, `Decimal(v)*100`). | Add `bps_from_percent`/`percent_from_bps` to app/money.py. Use `rupees()` and a paise-to-rupees helper. |
| Q19 | low | services/proof.py:166-175; routers/proof.py:53,83 | `bundle_entries` makes one `session.get` per leaf (N+1) and rebuilds `merkle_path` over all leaves for each item. `status` is a plain `str`, while the web type is a union. | Load the consents with one `select ... in_`. Type status as `Literal["verified","pending","deleted","mismatch"]`. |
| Q20 | low | services/proof.py:25 (new import of `fingerprint`); services/auth.py:329 | The new import shadows the `fingerprint` parameters (pylint W0621 at :42,:76), and `update` shadows the sqlalchemy import. pylint scores 9.99, close to `--fail-under`. | `import app.services.consent as consent_svc`, or rename the parameters `fp` and `changes`. |

## Typing

| id | sev | file:line | problem | concrete fix |
|----|-----|-----------|---------|--------------|
| Q21 | low | home/parts.tsx:335; OwnerSidebar.tsx:31; shell/CommandPalette.tsx:17; lib/screens.ts:10 | `as IconName` casts API and config strings. An unknown name renders an empty icon. | Type `screens.icon: IconName`. Add `isIconName()` with a fallback icon for API items, or type `OverviewItem.icon` as a union. |
| Q22 | low | onboard/page.tsx:68,123; otp/page.tsx:102; login/page.tsx:42; signup/page.tsx:39; api/auth/otp/verify/route.ts:40 | Auth JSON is cast without validation (`as Onboarding`, `as CodeSent`, `as Verified`). | Route the calls through `api<T>()` (Q11), and add a small guard for `CodeSent`, which feeds sessionStorage. |
| Q23 | low | lib/types-owner.ts:5-30 | `OwnerMessage = WinbackMessage & {...}`, `OwnerSavings = Savings & {...}` and the others patch stale base types in lib/types.ts. Nothing reads the narrower base types. | Put the fields in lib/types.ts and delete types-owner.ts. |

## Naming, structure, dead code

| id | sev | file:line | problem | concrete fix |
|----|-----|-----------|---------|--------------|
| Q24 | low | lib/types-overview.ts, types-owner.ts, format-overview.ts vs linkPrefill.ts, authServer.ts | File names mix kebab-case and camelCase. Types are split across three files. | Fold the types into lib/types.ts and the formatting into lib/format.ts (Q3), and keep camelCase. |
| Q25 | low | app/(app)/login/AuthFrame.tsx:98-137 | A route file exports shared helpers (`errorMessage`, `savePending`, `useShake`, `styles`). otp, signup, onboard and demo import them from `../login/`. | Move them to components/auth/ (AuthFrame.tsx + auth.module.css) and put `savePending` in lib/auth.ts. |
| Q26 | low | components/owner/ui.tsx:55 `SampleChip`; owner.module.css:115 `.num`, :164 `.chips`, :235 `.bubble`; Desk.module.css:72 `.notice`; approvals.module.css:57-63 | Unused export and unused CSS classes. | Delete them. |
| Q27 | low | components/owner/ui.tsx:8 | The `Screen` doc says "enter fade and 12px rise", but motion moved to ScreenEnter (D-085). | Fix the comment. |
| Q28 | low | LinkBooking.tsx (386 lines), flip/page.tsx (365), onboard/page.tsx (363), home/parts.tsx (358), approvals/page.tsx (335), AppHeader.tsx (325) | Long components mix pure logic with markup. `waterfallBars` (parts.tsx) and the flip rank/position maths are pure but untested. | Move `waterfallBars` and the flip order maths into lib/ with node tests. Split LinkBooking into the code step, the dates step and the UPI sheet. |

## Tests and gates

| id | sev | file:line | problem | concrete fix |
|----|-----|-----------|---------|--------------|
| Q29 | medium | Makefile:67,89 (`node --test lib/*.test.ts`) | Pure modules under components/ (draftRules.ts, proofStatus.ts, readState `parse`, motion `easeOutCubic`) cannot be tested by the current glob, and none of them have tests. | Move pure helpers to lib/, or widen the glob to `{lib,components}/**/*.test.ts`. |
| Q30 | medium | apps/web/e2e/*.spec.ts | No functional e2e for: sign up, then OTP, then the 4 onboarding steps; Saturday accept and undo; editing a draft in Approvals; Ask morning; the Proof dialog. a11y.spec only loads the pages. | Add `auth.spec.ts` (sign up to onboard to /home) and `owner.spec.ts` (undo, then edit a draft with a ₹ rejected, then approve). |
| Q31 | low | services/overview.py:339-340,352-353 (uncovered) | Untested branches: the `ScenarioError` path, and the pending-proof item with no consent time. | Add both cases to test_overview.py with Q1's test. |

## Design system and copy

| id | sev | file:line | problem | concrete fix |
|----|-----|-----------|---------|--------------|
| Q32 | medium | ask/ask.module.css:21-22,30-31 | The chat bar uses hardcoded `#1d1d1f`/`#fff` and the avatar uses `#fff`/`#1d1d1f`. These do not follow the theme (the avatar stays white in dark mode). | Use `var(--graphite)`, `var(--card)` and `var(--ink)`. |
| Q33 | low | Shell.module.css:369-378 (`#0071e3`/`#0a84ff` unread dot), :268,:604,:698; auth.module.css:64,136,164,169 (`#1e6b4e`, `#2fa45e`, `#d7e3dd`); Guest.module.css:47 (`#f2b54e`), :59 (`#c7c7cc`); owner.module.css:78 | Raw hex values where a token exists (`--accent`, `--gold`, `--ch-walkin`). The unread blue is not in the palette. | Swap in the tokens. Add `--unread` (or use `--accent`) once in globals.css, with its dark variant. |
| Q34 | low | auth.module.css:152 (`.betaChip`), upload.module.css:71 (`.type`) | 12px text is below the 13px floor. | 13px. |
| Q35 | low | approvals/page.tsx:132; pro/page.tsx (foot "Town events, not a demand forecast."); savings/page.tsx ("…count in the total above, not here."); LinkBooking.tsx ("…paid by the hotel, not you."); draftRules.ts:16 + messages.py:168 ("Offer a perk, not a price."); flip/page.tsx:141 ("Bookings are not money.") | "X, not Y" copy. | Rephrase positively, for example "Approved messages are logged until WhatsApp keys are added." and "Remove amounts and percentages; offer a perk instead." Change messages.py too so the two stay in step (Q5). |
| Q36 | low | pro/page.tsx:34 | The rupee figures "Agoda ₹3,950 vs direct ₹4,300" are hardcoded in TSX. They are labelled Sample, but no code computes them. | Return the sample figures from `/pro` (site.py) and format them with `inr()`. |

## Fine

- No `any`, `@ts-ignore` or non-null assertions in new web code. One justified eslint-disable (otp/page.tsx:54). No TODO or FIXME. No em dashes or exclamation marks in TSX copy.
- Every money string in the TSX goes through `inr()`/`compactInr()`. Overview takes every figure from the ledger service and money.py helpers, with no rule-2 arithmetic outside money.py.
- One shared `Segmented` (ui.tsx), used by flip. The plans and site toggles are deliberate button groups.
- New API endpoints (overview, undo, PATCH messages, ask/morning, desk/test-print, savings season, proof entries, auth, onboarding) all have pytest coverage, 97 to 100%. mypy is strict and clean, with no `type: ignore`.
- readState.ts guards every localStorage access. Owner CSS uses the `--r-*`, `--dur-*` and `--t-*` tokens consistently.
- `make check` inputs are stable: e2e forces `SEEDHA_DEMO=1` and simulated integrations in playwright.config.ts:29-35, whatever .env says.
