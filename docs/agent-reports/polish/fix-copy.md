# Fix copy: honesty and copy review (v2) fixes

Branch polish/fix-copy. Skipped on purpose: V2-6, V2-7, V2-8 and V2-25 (Pulse decision lines in
lib/pulse.ts are the owner's brief copy). No money code or locked number changed.

| id | change |
|---|---|
| V2-1 | AppHeader hotel chip shows a quiet "Sample hotel" badge when `is_sample` (replaces the sr-only text). Below 620px the chip shows only the badge. ink2 on bg: 5.0:1 light, 8.1:1 dark. Checked at 390 and 1440, light and dark, no horizontal scroll. Sample chip max width 420px so the hotel name is not cut. |
| V2-2 | "Sample close" note removed from the room board (unused `.note` rule removed). |
| V2-3/4 | Rate Watch card and view: "From a sample screenshot. No scraping." |
| V2-5 | ExpandCard: "Show view" / "Hide view"; region label "<name>, view" (all cards). |
| V2-9 | Pulse card summary is built from the Winter Line Carnival event in lib/pulse.ts: "25 to 30 Dec. " + its decision line. |
| V2-10/11 | Tonight line: "N rooms were free at the last close. Offer free rooms to X guests first. X keeps you ₹Y a night on average." Full house: "Every room was sold at the last close. Nothing to open." Stat label "Rooms free at the last close"; note "Rooms free from the latest 9 PM close, not live."; small card text matches. |
| V2-12 | invoice.py `gst_note()`: "Prices include GST. Taxable value, CGST and SGST are worked back from the total paid at 5%." (rate from gst_bps via new `rate_label`). Used by the PDF and the preview (`gst_note` field). |
| V2-13 | No GSTIN: PDF and preview omit Taxable value, CGST and SGST lines; note reads "Prices include GST. Tax lines appear once a GSTIN is set in Settings."; preview adds an "Open Settings" link. The split is still computed so totals tests hold. New tests: `test_no_gstin_prints_only_the_total_paid` (API) and "without a GSTIN only the total paid prints" (web). |
| V2-14 | SimulateMessage: "A sample guest message lands in your inbox as if sent on WhatsApp. Nothing is sent." |
| V2-15 | Wi-Fi template (EN/HI): apology, thanks, offer of help; no claimed action. |
| V2-16 | Parking template: "we will check parking for your cars. Please share your arrival time so we can keep space." (HI matched). |
| V2-17 | Refund template: "will update you soon" (HI "जल्द ही"). |
| V2-18 | Seeded guest messages: "Namaste ji, hum..." and "Hi, Diwali pe...". |
| V2-19 | Room sheet: "₹X more kept if direct"; "would have stayed with you, minus the UPI fee". |
| V2-20 | Toast "Slip sent to the Desk." |
| V2-21 | "No rooms sold. 22 rooms free." |
| V2-22 | Rate Watch: "Guests who compare see the lower price." (card foot and parityLine). |
| V2-23 | Pro sample agents: Brindhar Trips, Kelvaro Tours, Oskenta Holidays, Tazimor Travels; second property "Vellorin Cottages", Nainital (still is_sample, Sample tags unchanged). seed/statements.py AGENTS left alone (seed data, not cited). |
| V2-24 | Floor caption: "Each floor keeps you at least ₹X a night." |
| V2-26 | GST setting hints use ₹ (PDF keeps "Rs"). |

Test assertions updated for old copy:
- e2e/pro-cards.spec.ts: region name ", view"; Rate Watch "From a sample screenshot."; "Rooms free at the last close".
- e2e/room-board.spec.ts: toast text now ends with a full stop.
- lib/proSample.test.ts: new Tonight line and full-house line.
- lib/rooms.test.ts: "No rooms sold. 4 rooms free."
- lib/invoice.test.ts: fixture now has a fictional GSTIN and the new gst_note (tax rows only print with one).
- tests/test_invoice.py: the no-GSTIN PDF test checked `"GSTIN" not in text`; the new note mentions
  GSTIN, so it now checks there is no "GSTIN " header line. Demo invoice test also checks the new note.

Checks: ruff, ruff format, mypy strict, pylint (9.97 app, 9.98 tests), pytest 98.21% cov, money
code 100%, bandit, pip-audit (no findings), detect-secrets on changed files; web typegen, tsc,
eslint, prettier, node tests 171/171, audit gate. e2e not run (specs updated by text search).
