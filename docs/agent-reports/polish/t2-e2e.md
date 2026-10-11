# T2 Playwright (polish build, Wave 3). Branch polish/t2, not committed.

## Specs added (apps/web/e2e; no app code, no playwright.config.ts change, existing specs untouched)
- `polish-helpers.ts`: own rupee formatter (not lib/format), API readers via the /api proxy, `ensureBillRequest`
  (per-thread simulate only when the thread does not already end on a bill request), `setTheme` cookie.
- `polish-room-board.spec.ts` (7): sheet lines for an OTA, walk-in and direct room equal GET /rooms/{night}/{room}
  (every line, commission lines absent when 0 and no if_direct, if-direct box, initials, channel, nights, consent
  chip), Close returns focus, Print slip POST ok + toast; arrows by the rendered column count, roving tabindex,
  Enter opens, Tab stays in the dialog, Escape returns focus; every chip's count equals by_channel (Empty =
  total - sold) and filtering leaves exactly that many undimmed; all 7 scrubber nights: summary, heading, tile and
  chip counts equal /rooms/nights, keyboard Left/Home/End; Message guest on a real seeded consented guest (found by
  scanning the board nights; Fri 9 on the seed), full name never on the sheet, initials match, link opens the
  thread; a not-consented room on that night has no link; phone 390: 4 per row, ArrowDown +4, bottom sheet flush
  at the bottom and full width; 1440: side sheet on the right, scrim closes it.
- `polish-inbox.spec.ts` (3): every row's unread badge / "You:" preview equals GET /inbox/threads, Unread filter
  count, opening an unread thread marks it read; deep link selects the row; Simulate adds exactly one inbound
  message on that thread and none elsewhere, the draft fills the box and nothing is stored as sent after 1 s,
  Send gives the simulated toast and one outbound with "Reply STOP to opt out."; invoice draft: attach payload,
  draft text names no number or amount, panel Taxable/CGST/SGST/Total equal GET .../invoice, real download
  (file name from the API, starts %PDF) plus content-type application/pdf, Attach is pressed and sends nothing.
  Cleanup: a thread it replied on ends on a guest text again (Farhan keeps his bill request).
- `polish-pro.spec.ts` (4): Space opens each of the ten in turn with exactly one open, Escape closes the last and
  focus returns; floor slider 4,000 -> 4,500 (arrows) -> 1,000 (Home) re-asks /pro/floor, the table equals each
  answer (and a direct API read); displacement default and 20 rooms at 1,500 equal /pro/displacement, totals
  identity, too many rooms marks the field invalid with a described error; rollup a/b/all aria-pressed and the
  figures equal /pro/rollup; Close returns focus.
- `polish-a11y.spec.ts` (3): axe via the helper at 1440 and 390, light and dark (theme cookie, reduced motion):
  /home with the room sheet open; the invoice panel inside an open thread (scoped to the panel, see bugs);
  /pro with the displacement card open, and the floor card at 1440.

## Runs (ports 3910/8910, scratch DB, `next build --webpack` in an APFS clone)
Full suite twice in a row, each run reseeding a fresh scratch DB: 75 passed, 0 failed, 0 flaky (7.1 min each),
including loop.spec.ts (unchanged). New specs make no demo reset (only desk-kiosk and proof-live reset, once each).
tsc --noEmit (after next typegen), eslint --max-warnings=0, prettier --check: clean.

## Real bugs found (left out of the specs; please fix, then widen polish-a11y)
1. /inbox with a thread open, light theme, axe color-contrast 4.38:1 (#6e6e73 on #e6f1ec, 13px):
   `.Inbox_invoiceSlot > .Inbox_kicker` ("Stay invoice ready to attach", 1440 and 390) and the selected
   row's time `button[aria-current="true"] .Inbox_rowTime` (1440).
2. /inbox with a thread open, all four states: axe scrollable-region-focusable on `.Inbox_stream` (the message
   log scrolls but has no focusable content; e.g. tabIndex=0 on the log). The existing a11y sweep opens /inbox
   with no thread, so it never sees this.
3. /pro Floor by Channel at 390, light and dark: scrollable-region-focusable on `.proCalc_tableWrap` (the table
   scrolls sideways on a phone but cannot be reached by keyboard; tabIndex=0 plus a label on the wrapper).
