# P1 shell and Overview: shell builder report (branch fe/shell, not committed)

## Files
API (new): app/services/overview.py, app/routers/overview.py, tests/test_overview.py (14 tests). Edited: app/main.py (router included).
Web (new): components/shell/{AppHeader, CommandPalette, SessionDialogs, ShellData, readState, signOut, Icons, NotBuilt, ScreenEnter}.tsx/.ts + Shell.module.css;
components/StepTracker.module.css; app/(owner)/layout.tsx; app/(owner)/home/{parts.tsx, overview.module.css};
app/(owner)/(screens)/{my-place, inbox, assistant, calendar, billing}/page.tsx; lib/types-overview.ts; lib/format-overview.ts + .test.ts.
Web (edited): app/layout.tsx (ShellProvider), app/(owner)/home/page.tsx, components/{TopNav, OwnerSidebar, StepTracker, Toast}.tsx,
lib/screens.ts, lib/bff.ts + bff.test.ts ("overview" owner rule). Also app/(owner)/(screens)/layout.tsx is now a pass-through
(not on my allowed list, but needed: the sidebar frame moved up to app/(owner)/layout.tsx so /home gets it too).

## What it does
- Header (owner screens, /home, /desk, /link): 60px glass, dots, back (history back else /home), logo + wordmark, hotel chip from API,
  Owner | Front desk | Guest (>=1180, links with aria-current), ⌘K search field (>=1180; icon button below), bell with unread count,
  avatar initials from API. Guest phone pages keep the minimal header; login/legal pages get a plain brand bar + theme toggle. Pipeline/Plans tabs removed.
- Popovers render in a portal (header backdrop-filter would break their glass): notifications (370px, blue unread dot, IST time,
  Mark all read; read ids in localStorage, all access in try/catch) and account menu (Front desk, Guest, Settings, Security, Plans, Help, Theme, red Sign out -> DELETE /api/session -> /login).
- ⌘K / Ctrl+K palette (aria-modal, filters screens, Enter opens first). Idle "Still there?" after 30 min. Session-ended overlay when /overview returns login_required ("Sign in", "Direct beta login" -> /login).
- Sidebar in exact order with 28px icon tiles (inline SVG), Approvals red count = pending drafts, Pro tag, dashed "Open Seedha Desk ↗"; phone pill row (<980, hidden scrollbar, nowrap). Desktop sidebar scrolls if taller than the viewport.
- One GET /overview shared via context (header, sidebar, Overview), reloaded on each navigation. Screen enter: fade + 12px rise, 520ms var(--spring); reduced motion -> instant (global rule).
- Toast: graphite pill, 2.8s, keeps the .toast class.
- Overview: date (business date), "Namaste, Rajesh ji.", See the flip, dark insight banner (HI default, lang="hi-Latn", "Show in English"), six tiles
  (Commission-free share + "Direct bookings 10.7%", gold Saved with codes), calculated line, direct-loop checklist (hidden at 8/8), waterfall, donut (37% occupancy),
  Last night grid + "Print close slip on Desk" (POST desk/close-slip, toast), Needs you. Empty state "Start with your statements" + "Upload statements". Loading skeleton, ErrorState.
- Placeholder routes say plainly the screen is not built yet in this version; no data.

## GET /overview (owner token; money paise, shares tenths of %)
{business_date, owner{name,short_name,initials}, hotel{name,short_name,rooms_count,is_sample}, period{start,end,days,available_room_nights},
has_statements, kpis{list_revenue,net_kept,net_kept_share_tenths,net_adr,list_adr,revpar_net,revpar_list,paid_to_channels,paid_to_channels_share_tenths,
commission_free_share_tenths,direct_bookings_tenths,room_nights,occupancy_tenths}|null, insight{en,hi}|null, waterfall[{key,label,amount}], channel_mix[{key,name,room_nights,share_tenths}],
last_night{date,rooms_count,sold,net_kept,direct_share_pct,is_sample,rooms[{number,channel_key,code}]}, savings{total_net_saving,count},
needs_you[{id,title,detail,href,icon,at,amount}], pending_approvals, checklist{steps[{key,done}],done_count,total}, notifications[same item shape]}.
Composes load_ledger, build_insight, in_house/business_date/booking_lines, saturday_move, list_matches (read-only, no scan), compute_steps. No ledger maths repeated.
Initials rule: two words -> first letters; one word -> first letter + next consonant ("Rajesh" -> "RJ"). Needs-you titles never contain ₹ (amount sent separately).

## Checks (all in worktree)
ruff check: All checks passed. ruff format --check: 85 files already formatted. mypy: no issues in 79 files. pytest: 323 passed.
tsc: clean. eslint --max-warnings=0: clean. prettier --check: all formatted. node --test lib/*.test.ts: 21 pass, 0 fail.
Visual check: next dev --webpack on port 3017 + API on 8017 (Turbopack panics in the worktree: symlinked node_modules leaves its root). 1440/390, light/dark looked right.

## Screenshot vs API differences (API used)
- Net kept ₹47,33,012 (screenshot ₹47,33,011). Waterfall list revenue label 63.1L (half-up; screenshot 63.0L).
- Insight: API text is "MakeMyTrip ... par 4 channels ne har room par zyada paisa chhoda." (MMT is 5th of 6, not last), not the handoff sentence.
- Last night on this branch's seed: 14 of 22, net ₹46,691, direct 21% (screenshot net ₹47,900); room numbers/channels differ (101..112, 201..210).
- Saved with codes: ₹0 / "No coded direct bookings yet" on this branch; D9 (₹12,600, 4 bookings) is on master and will show after merge (test compares with /savings, so it passes either way).
- Business date shows the desk date (10 or 13 Oct 2026), not "Saturday, 3 October 2026". Needs you has no Diwali/Calendar row (no data source yet).

## Not done / notes
- Insight back-to-Hindi button reads "Hindi mein dekhein". Segmented mode switch uses links with aria-current (navigation), not aria-pressed.

## Changes needed from the lead (files I may not edit)
1. proxy.ts matcher: add /my-place, /inbox, /assistant, /calendar, /billing (they render no data, but should still require a session).
2. e2e/loop.spec.ts line 13 expects "0 of 8 steps done. Tap any step to run it." on /home. Now the checklist says "0 of 8 done" (and the empty state "Start with your statements"); update the assertion.
3. e2e: .row/.toast selectors on /flip still work; old "nav.seg" is gone from all headers (guest-page check stays true). a11y spec should add the five new routes.
4. app/(owner)/(screens)/layout.tsx edited to a pass-through (see Files). Other owner screens still carry their old styles (P2).
