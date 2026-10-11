# Fix: design and accessibility review (v3) findings

Worktree polish/fix-design. Own servers only: API 8905 (scratch sqlite, alembic head, `python -m seed.load`, SEEDHA_DEMO=1,
keys blank), web 3905 (`next dev --webpack`). Playwright + axe (wcag2a, 2aa, 21a, 21aa, 22aa). Servers stopped, temp configs deleted.
No copy strings rewritten (InvoicePanel text, invoice notes, SimulateMessage, header chip, Pro wording untouched).

| id | change | measured |
|---|---|---|
| F1 | ThreadView `InvoiceSlot` is one compact row (Invoice · "Stay invoice ready to attach · <number>" · Preview · Attach), `data-testid="invoice-slot"` kept, status line kept. Full `InvoicePanel` opens in the inbox `Dialog` (now exported, optional class; aria-modal, focus trap, Escape, focus returns to Preview) with a Close button; the panel's Attach and the row's Attach share one state. `.stream` min-height 200px; `.compose` shrinks first (flex 0 1 auto), its top part (suggestions, bot note, invoice row) scrolls in `.composeTop`, composer and foot never scroll. | Send at 1440x900: y 706 to 750, hit-test is the button, log 206px. At 390x844 (page scrolled to the panel): y 692 to 736, hit true, log 200px. Slot 94px (1440) and 146px (390), was 790 and 1040. |
| F2 | `--ink` for `.invoiceSlot .kicker` and the selected row's `.rowTime` on accentSoft. | axe 0 on /inbox thread, light and dark, 390 and 1440. |
| F3 | Log: `tabIndex={0}`, role log, label "Messages with <name>"; inset 3px focus ring (panel clips edges). | Focused: outline solid 3px; axe scrollable-region-focusable gone. |
| F4 | Floor and Khata `.tableWrap`: `tabIndex={0}`, `role="region"`, aria-label "Floor table" / "Agent khata table", 3px focus-visible ring. | axe 0 on /pro floor, khata, displacement, audit at 390, light and dark. |
| F5 | Close drops `small`; rule is `.panelFoot .close` (44px min). | Close 88x44 on all opened cards; no Pro control under 44px at 390. |
| F6 | Scrubber at <480px: gap 2, padding 2, margin-inline -8px. | 7 days 44x52 at 390 (was 40x52), no horizontal scroll. |
| F7 | "Print close slip on Desk" is `btn ghost` (48px). | No /home control under 44px at 390 or 1440. |
| F8 | Suggestion chips, "Draft with AI", text buttons (Simulate guest, Write away message, Forget: also min-width 44) and the list filter chips (All, Unread...) 44px. | No /inbox control under 44px at 390 or 1440. |
| F9 | RoomSheet marks the other body children `inert` while open (live regions/toasts excluded); lifted before focus returns to the tile. | axe 0 with the sheet open at 390 and 1440; 0 inert left after close; focus back on tile 101. |
| F10 | Pro trigger `aria-label={name}`, summary wrapped (display: contents) as `aria-describedby`. | Accessible name "Floor by Channel". |
| F14 | Invoice header stacks below 480px (meta left-aligned); GSTIN keeps `overflow-wrap: anywhere`. | GSTIN on one line in the 390 dialog. |
| F15 | Inbox menu closes when focus moves outside it (focusout with a related target; clicks still use mousedown). | Tab out: menu count 0. |
| F13 (part) | Stay invoices card renders via `HotelTab beforeReset`, above "Reset the sample hotel". "Rs" to ₹ left to the copy agent. | |

Not done: F11 (Pro header raggedness), F12 (framer-motion weight), F13 label sizes.

## Notes
- axe after closing the room sheet at 1440 reports target-size on the step tracker's Desk link only while the page is scrolled
  (scrollY 640, link at y 12 under the sticky top bar); 0 at the top of the page and 0 before opening. A scroll artifact, not new.
- Phone: the inbox panel sits under the screen title, so the owner scrolls the page once to reach the composer (as before);
  inside the panel nothing is clipped.

## e2e
- inbox-threads.spec.ts: `sendInView` checks Send fully inside the viewport and topmost at its centre (one atomic read, polled)
  at 1440x900 and 390x844, plus log height >= 150; invoice steps open the "Stay invoice preview" dialog, check the region,
  Download link, PDF bytes, Attach, Escape returns focus to Preview, row shows "Attached" and the status line.
- inbox-threads, room-board, pro-cards: 15 passed against 3905/8905 (fresh DB).
- Checks: typegen, tsc, eslint --max-warnings=0, prettier --check, node --test lib (170 pass): all green.
