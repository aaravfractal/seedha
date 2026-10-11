# Spec align: T2 polish specs after the copy and design fixes

Branch polish/spec-align. Only apps/web/e2e/polish-*.spec.ts changed; no app code. All five failures were the
intended copy/design changes, none a real bug. No test skipped, no threshold lowered.

| test | cause | change |
|---|---|---|
| polish-a11y :61 stay invoice | F1: the panel now opens in the "Stay invoice preview" dialog, the slot is one row | Opens Preview; axe (shared `axeViolations`, whole page) on the open thread and again with the dialog open, 1440 and 390, light and dark. The panel-only scope is gone. |
| polish-a11y /pro cards | T2 left Floor at 390 and Khata out (F4 fixed the table wrappers) | Floor, Displacement and Khata opened and checked at both widths, both themes. |
| polish-inbox :155 invoice draft | F1 structure | Row shows "Stay invoice ready to attach · <number>"; Preview opens the dialog; same numbers, PDF and Attach checks inside it; Escape closes, focus returns to Preview, row Attach is "Attached" (pressed, disabled) with the status line. |
| polish-pro :116 floor slider | V2-24 caption | "At ₹X a night. Each floor keeps you at least ₹Y a night." (exact text, as before). |
| polish-room-board :109 and :260 | V2-19 wording, shared helper `expectSheetMatches` (no "+", "more kept if direct") | "₹X more kept if direct" and the full "Commission ₹A and GST on it ₹B would have stayed with you, minus the UPI fee of ₹C." sentence. Inert (F9) needed no change: Escape and the Message guest link still work. |

Header comment of polish-a11y updated (the "left out until fixed" list removed); unused AxeBuilder import dropped.

## Runs (ports 3911/8911, scratch sqlite, `next build --webpack` in an APFS clone)
- The four spec files: 17 passed. axe found no violations in any of the widened states.
- Whole suite once: 75 passed, 0 failed (7.4 min). Servers stopped, scratch clone, DB and config deleted.
- tsc --noEmit (after next typegen), eslint --max-warnings=0, prettier --check: clean.
