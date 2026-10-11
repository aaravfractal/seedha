# V3 design, accessibility and performance review (read-only, 12 Oct 2026)

Setup: own API on 8904 (scratch sqlite, alembic head, `python -m seed.load`, SEEDHA_DEMO=1, keys blank) and web on 3904
(`next dev --webpack` for the a11y pass; production `next build --webpack` from an APFS clone in scratch for perf and
chunk sizes). Direct beta login. Playwright + @axe-core/playwright (wcag2a, 2aa, 21a, 21aa, 22aa). Scripts and
screenshots: scratchpad/polish-v3/. Servers stopped. No repo file changed except this report.

## Measured numbers
- Axe, 390 and 1440, light and dark: /home 0, /home with room sheet 0 at 390 and 1 at 1440 (target-size on the
  step tracker behind the scrim), /inbox list 0, /inbox thread with invoice 1 to 2 (see F2, F3), inbox menu same,
  /settings (Personal, Hotel, Notifications) 0, /pro 0, /pro with floor, displacement, rollup, audit, khata and
  discount-split open 0 at 1440, 1 at 390 for floor and khata (F4).
- No horizontal scroll at 390 or 1440 on any screen or open state (scrollWidth equals clientWidth everywhere).
- Keyboard: room grid arrows, Home, End move focus (101 > 102 > 201 > 210 > 101); Enter opens the sheet with focus on
  Close; Tab stays inside the sheet; Escape returns focus to the tile. Scrubber arrows change the night and the
  aria-live summary. Pro: Enter expands, Tab reaches the slider, Escape and Close collapse and focus the trigger
  (all 10 cards, 4 combos). Inbox menu: opens on the first item, Escape returns to "More inbox actions".
  Focus ring is 3px solid accent on every element checked.
- Reduced motion: 0 running animations on /home after load, after opening the sheet (sheet at its final x at once)
  and after scrubbing; Pro card is at full width (1080px) in the first frame, panel opacity 1. Without it the sheet
  runs `slide` 450 ms on the app curve and the Pro card grows 261 to 1080px in about 430 ms.
- Frame intervals at 1440 (production build, headless Chromium, M-series): room sheet open x3 median 16.7 ms,
  p95 33.3 ms, max 33.4 ms (0 to 2 frames over 33 ms); night scrub with tile stagger max 16.8 ms; Pro expand and
  collapse (floor, displacement, audit, khata) median 16.7, max 33.3 ms, 0 frames over 33 ms; floor slider 10 steps
  max 16.8 ms. (Dev mode showed one 100 ms frame on Pro expand; not present in production.)
- CLS: /home 0.0000, /pro 0.0000, /inbox 0.0000 on load; /pro after expand and slider 0.0000.
- Route JS, production, gzipped (initial HTML scripts): /savings baseline 198.0 KB (15 files). /home 203.4 KB
  (+11.0 page chunk), /inbox 206.1 KB (+13.7 page chunk), /settings 208.0 KB (+10.9 page, +4.8 shared 3069),
  /pro 250.6 KB (+12.9 page, +40.6 framer-motion chunk 7993, +4.8 3069). Raw page chunks: home 34.1, inbox 42.5,
  pro 39.1 KB.
- PDF tooling: no jspdf, pdf-lib, pdfkit, react-pdf, pdfjs or reportlab string in any client chunk; the invoice PDF
  is a plain `<a download>` to the API. reportlab stays server-side.

## Findings
| id | sev | screen / width / theme | file:line | problem | fix |
|---|---|---|---|---|---|
| F1 | high | /inbox thread with an invoice request, 390 and 1440, both themes | components/inbox/ThreadView.tsx:330, Inbox.module.css:419 and :112-127 | The invoice slot (790px tall at 1440, 1040px at 390) sits in the non-scrolling compose area. The message log (`.stream`, flex 1, min-height 0) shrinks to 36px (28px on phone), so the guest's request cannot be seen, and the composer textarea and Send (top 1220px at 1440x900, 1620px at 390x844) are clipped by `.panel { overflow: hidden }`. You cannot reach them by mouse or touch. The e2e still passes because `fill()` and `click()` ignore clipping. | Collapse the invoice to a one-line slot ("Stay invoice DEODAR/2627/0001 · Preview · Attach") that opens the preview in a sheet or dialog, or move the slot into the scrolling stream. Also cap the compose area (for example `max-height: 45%; overflow:auto`) so the stream keeps a minimum height of about 200px. Add an e2e check that the Send button is inside the viewport. |
| F2 | medium | /inbox thread, 390 and 1440, light | Inbox.module.css:536 (`.kicker` in `.invoiceSlot`), :276 with :260 (`.rowTime` on the selected row) | Contrast is 4.38:1. The text is --ink2 #6e6e73 on --accentSoft #e6f1ec at 13px. | Use --ink on accentSoft, as roomBoard.module.css:420 already does, or darken that pairing. |
| F3 | medium | /inbox thread, all | ThreadView.tsx:34-38 | axe scrollable-region-focusable: the role=log stream scrolls but cannot take focus, so keyboard users cannot scroll the history. | Add `tabIndex={0}` to the log (it already has an aria-label). |
| F4 | medium | /pro floor and khata, 390, both themes | components/pro/views/FloorView.tsx:58, KhataView.tsx:34, proCalc.module.css:116 | axe scrollable-region-focusable: on a phone the table scrolls sideways but cannot be reached by keyboard. | Add `tabIndex={0}`, `role="region"` and `aria-label` (for example "Floor table") to `.tableWrap`, and give it a :focus-visible ring. |
| F5 | medium | /pro all cards, all widths | ExpandCard.tsx:115, pro.module.css:160 | The Close button is 71x40. The global `.btn.small` sets `min-height: 40px` (2 classes) and beats `.close` (1 class), so the brief's 44px target is missed. B5 reported no target under 44. | Drop `small` or raise the specificity (`.panelFoot .close`). |
| F6 | low | /home 390 | roomBoard.module.css:62-72 | The scrubber days are 40x52 (7 columns at 390), narrower than 44px. They pass 2.5.8 (24px). | Cut the scrubber gap and padding to 2px, or let it scroll sideways with 44px minimum columns. |
| F7 | low | /home all | RoomBoard.tsx:105 | "Print close slip on Desk" is a `btn small` at 40px (the same pattern as the rest of the app). | Use the default `btn ghost` (44px+) if the 44px rule is strict. |
| F8 | low | /inbox all | Inbox.module.css:598, :627, :862; ThreadView.tsx:303, :322, :362 | The suggestion chips are 40px, and "Draft with AI", "Simulate guest", "Write away message" and "Forget" are 36px (the 44 dense minimum is missed). | Raise them to `min-height: 44px`. |
| F9 | low | /home with sheet, 1440 | RoomSheet.tsx:164-200 | axe target-size flags the step tracker behind the scrim. The background stays in the a11y tree (aria-modal only). | Set `inert` on the app root while the sheet is open, or accept it (it is a false positive under the modal). |
| F10 | low | /pro all | ExpandCard.tsx:78-87 | The trigger's accessible name is the whole summary run together ("Floor by ChannelIllustrationProThe lowest..."). | Name it with `aria-labelledby` on the card title and use `aria-describedby` for the summary. |
| F11 | low | /pro 1440 | pro.module.css (card head) | On the small cards, long titles wrap and push the Pro pill to a second line (Discount, Displacement, Rollup), while Tonight and Khata keep it inline, so the header row looks ragged. | Put the tags in their own row under the title, or let the title wrap and keep the pills top-aligned in a fixed column. |
| F12 | low | /pro | pro/page.tsx:5, ExpandCard.tsx:3 | /pro is the first owner route to load framer-motion: +40.6 KB gz (250.6 vs about 205 KB for the other owner routes). It is approved, but heavy for one layout animation. | Use `LazyMotion` + `m` with `domMax` loaded on the first expand, or a FLIP with the Web Animations API. |
| F13 | low | /settings Hotel, all | components/settings/InvoiceGstSetting.tsx:12-15 | The options say "Rs 7,500" where the app uses ₹ (FRONTEND_MASTER: ₹ always). The Stay invoices card also sits below "Reset the sample hotel" and its label is smaller than the other rows. | Use ₹, move the card above Reset, and match the row type sizes. |
| F14 | low | /inbox 390 | InvoicePanel.tsx:50 | In the preview at 390, the GSTIN breaks mid-string ("05ABCDE1234F / 1Z5") and the hotel name wraps in the narrow header. | `white-space: nowrap` on the GSTIN and stack the header on a phone (or solve this with F1's sheet). |
| F15 | low | /inbox menu | Inbox.tsx:92-108 | The menu stays open when Tab moves focus out. | Close it on focusout outside `wrap`. |

Passes worth keeping: initials-only sheet, 450 ms sheet on the app curve, instant under reduced motion, focus return
everywhere, aria-pressed chips, radiogroup scrubber, aria-live summary, zero CLS, no PDF code in the client.
