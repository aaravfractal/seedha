# Screen compare: build vs handoff

Each screen, the reference it was compared with, and what still differs.
References: `design/handoff-pages/page-NN.png` (gallery, catalogue in
`design/handoff-text/GALLERY.md`) and `design/video-screens/*.png`
(`VIDEO_SCREENS.md`). Screenshots of the build at 1440 and 390, light and
dark: `docs/agent-reports/design-qa/` (cited per screen in
`docs/agent-reports/review-design-qa.md`, which also lists every low
finding by id).

Intentional differences everywhere (FRONTEND_MASTER section 3 and
decisions):
- Numbers come from the API: ₹47,33,012, not ₹47,33,011 (D1, ruling 1).
- "Commission-free share 16.7%" with "Direct bookings 10.7%" (D1, D-085).
- Text colours for gain and loss are slightly deeper than the handoff hex
  for 4.5:1 contrast (D-077).
- Sample figures carry "Sample" labels (D10).
- Security claims we do not have are shown as "Planned" (D8).

Status key: **Matches** means only intentional or low-severity
differences remain.

| Screen | Reference | Status | Remaining differences |
|---|---|---|---|
| App shell (header, sidebar, popovers, ⌘K, idle, session ended) | page-09; owner-01, owner-08 | Matches | Low only (review-design-qa.md Shell rows). Pipeline and Plans tabs removed (D3). |
| Overview /home | page-09, page-10; owner-01, 06 to 10 | Matches | Waterfall uses two rows on phones (D-090). Direct Booking Score card added (approved idea, D-089). Last-night net is computed (₹46,691 on the seed date), not the screenshot's ₹47,900. |
| Upload | page-11 | Matches | Recover "Draft a dispute" on flagged rows (D-089). |
| Money kept /flip | page-11, page-12 | Matches | "By bookings" ranks by room nights (the API's order). |
| Repeat guests | page-12 | Matches | Match percentages are the matcher's (Neha 85%, A. Verma 65%), not the screenshot's. |
| Saturday move | page-13 | Matches | Undo added per SCREENS. |
| Approvals | page-13 | Matches | STOP line on its own line under the link (D-090). |
| Savings | page-14 | Matches | Split the Commission line (D-089); ₹12,600 from the D9 seed, ₹14,799 after Rahul books. |
| Ask on WhatsApp | page-14 | Matches | Answer 1 is the real September figure, ₹1,09,542 (D15). |
| Assistant | page-15 | Matches | Answers only fixed intents from the ledger (D6). |
| Calendar (Pulse) | page-15 | Matches | Sample events labelled (D10, D-088). |
| Consent proof | page-16 | Matches | The root is stored locally; the dialog says it is not yet on a public chain (B-001). |
| Pro | page-16 | Matches | The Audit is computed, with a Sample label on the sample hotel (D-090). |
| Billing | page-17 | Matches, by design narrower | No card, UPI ID or bank fields (D7); payments open after launch. |
| Settings | page-17 | Matches | Demo session read-only for personal details (D-088); two-step sign-in "Planned" (D8). |
| Guest inbox | page-18; owner-02 | Matches the layout | Empty until a guest consents at the Desk (P6a); the reference shows five threads. No voice notes (not in our data). |
| My Place | handoff SCREENS only | 2D version (D13) | 3D hotel not built ("3D view coming soon"). |
| Website /site (owner flow) | page-22 to 25; owner-03 to 05 | Matches | Package cards say "Suggested from your bookings" (the reasons are computed). |
| Front desk /desk | page-19 to 21; desk-01, desk-02 | Matches | Checkout does not wait for consent (D-081). |
| Guest consent | page-20 | Matches | |
| Seedha Link and UPI sheet | page-22 | Matches | The guest's name appears only after the code is accepted (D-076). Payment is simulated (labelled). |
| Sign in, sign up, OTP, onboarding | page-07, page-08 | Matches | OTP sender simulated with a labelled demo banner (D4). The masked number shows (the gallery's empty number is a design bug). |
| Public website / | page-02 to 06; marketing-01 to 12 | Matches | Dark footer in light theme follows SCREENS (D-090 W3). The guest globe is a city list with "3D view coming soon" (D13). "Start with Base" spacing fixed. |
| Legal pages, 404 | page-06 | Matches | Website frame. |
| Hotel site /hotel/[slug] | page-26, page-27; hotel-site-01 to 05 | Matches | Rooms listed highest rate first. |
| Rate card, agent deck | page-28 to 31; rate-card-01, agent-deck-01 | Matches | |
| Pitch deck | page-31 to 36 | Not built | Not in the FRONTEND_MASTER phases. |

Low-severity rows still open (polish) are listed in
`docs/agent-reports/review-design-qa.md` and
`docs/agent-reports/review-a11y-perf.md`.
