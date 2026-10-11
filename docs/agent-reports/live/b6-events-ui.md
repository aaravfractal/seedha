# B6 Event UI (live/events-ui worktree, 11 Oct 2026)

## Files
- app/(owner)/(screens)/calendar/page.tsx: "Add events" button, the rate line, owner event cards
  ("From your sources", plus "Sample extraction" for no-key saves; "Sample" for sample events),
  source host link (new tab, rel="noopener noreferrer"), town, "Likely overnight demand",
  "Add to plan" / "Remove from plan", Delete with an alertdialog confirm, morning preview.
  Owner cards show "You set any rate change. Seedha never suggests a price." and no rupee line.
  Modals are portalled to body because the screen's enter transform trapped the fixed scrim.
- components/calendar/AddEventsSheet.tsx: notice textarea (counter, 6,000 limit), required https
  source link (checked on the client), helper "Paste from an official source. Seedha does not fetch
  or scrape websites.", results preview (Claude note or "Sample extraction" chip and no-key line),
  rejected rows in plain words ("An event" when the name is null), Save, busy and error states
  (422 codes, 429, 503), aria-live results, focus moves between views. Reuses settings Modal
  (focus trap, Escape, focus return).
- components/calendar/MorningPreview.tsx: WhatsApp-style bubble, English/हिंदी toggle,
  "Simulated send" chip, "Send to me (simulated)" posts the send and toasts "Simulated send logged".
- components/calendar/calendar.module.css (tokens only).
- lib/events.ts + lib/events.test.ts: reason text (all 9 codes), rejectedName, isHttpsUrl,
  sourceUrlError, sourceHost, noticeCounter, eventLabels, ownEventId, demand/category/action text
  ("keep" -> "Keep your usual mix"), error text, copy guard test.
- lib/types-settings.ts: PulseEvent gains origin?, source_url?, town?, demand?, action "keep";
  EventDraft, OwnerEvent, ExtractResult (note?), SaveEventsResult, MorningPreviewData, MorningSendResult.
- lib/bff.ts + bff.test.ts: added ["events", "owner"]. Without this the proxy returns 404 for every
  /api/events call. This was outside the listed files but the feature needs it. Lead: please confirm.
- e2e/events.spec.ts: http:// refused with no extract request; Escape returns focus; sample extraction,
  save, "From your sources" card with link attributes, plan toggle, Hindi toggle, simulated send toast,
  Delete with confirm. Cleans up before and after through GET/DELETE /api/events (source URL
  https://e2e-events.example.org/...).

## How to verify
cd apps/web && npx next typegen >/dev/null && npx tsc --noEmit && npx eslint . --max-warnings=0 &&
npx prettier --check . && node --test lib/*.test.ts   (all pass, 119 tests)
After the B5 merge: npx playwright test e2e/events.spec.ts (on the normal e2e ports).

## Dev check (done, not committed)
next dev --webpack on 3870 with the API on 8870. The events routes were mocked with page.route in
scratch/b6/mock.spec.ts. Tested light and dark at 390 and 1440, no horizontal scroll, 503 and 429
errors, the over-limit counter, focus trap, focus after Delete, and axe (wcag2a/aa, 21a/aa) with the
sheet open and the card showing: 0 violations.

## Open issues
- events.spec.ts has not run against the real B5 API (it did not exist in this worktree).
  It expects sample extraction to return at least one event for the pasted URL.
- Turbopack dev fails in worktrees (symlinked node_modules); use --webpack for dev there.
  The Next dev-tools badge covers bottom sheet buttons at 390 in dev only. Production is not affected.
- The extract/send `note` strings are typed but not shown. The UI uses its own fixed copy.
