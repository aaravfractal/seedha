# Frontend gap: handoff vs current apps/web

Sources: `design/handoff-text/HANDOFF_TEXT.md` (SCREENS, BEHAVIOR, DATA,
MATCH_THIS), `design/handoff-text/VIDEO_SCREENS.md`,
`design/handoff-text/GALLERY.md` (handoff pages 2 to 37), and the PNGs in
`design/handoff-pages/` and `design/video-screens/`. Phases are those in
docs/FRONTEND_MASTER.md section 4. Effort: S under 2 h, M half a day,
L a day, XL more than a day.

Numbers always come from the API (FRONTEND_MASTER D1, rulings 1 to 7).

## App shell and owner screens

| Screen | Reference | Exists now | What changes | Phase | Effort |
|---|---|---|---|---|---|
| Header | MATCH_THIS; video owner-01, 10 | Simple top nav: wordmark, Pipeline, Plans, theme toggle | Sticky 60px glass header: back button, traffic dots, logo, hotel chip with green dot, Owner / Front desk / Guest switch, ⌘K search, bell with count, "RJ" avatar. Remove Pipeline and Plans tabs (D3). | P1 | M |
| Sidebar | MATCH_THIS; video owner-08 | 11 text items, Upload first | 17 items in handoff order with 28px icon tiles, selected = white card + pine tile, Approvals count, Pro tag, "Open Seedha Desk ↗" dashed card; phone pill row | P1 | M |
| Popovers and dialogs | SCREENS "Shared shell" | Toast only | Notifications popover (370px), account menu, ⌘K palette, idle dialog (30 min), "Your session has ended." screen; toast restyled to graphite pill | P1 | M |
| Overview (Home) | MATCH_THIS; video owner-01, 06 to 10 | Pipeline page with 8 step tiles | Date, "Namaste, Rajesh ji.", "See the flip", dark HI/EN insight banner, 6 KPI tiles (gold "Saved with codes"), source line, derived "Set up the direct loop" checklist (hides when done), waterfall "Where ₹63,05,000 went", channel mix donut (37% occupancy), last night room grid (14 of 22) with "Print close slip on Desk", Needs you list, empty state. New API: summary, overview, notifications, needs-you, rooms last night | P1 | XL |
| Upload | SCREENS Upload | Drop zone, samples, progress, flagged rows | Restyle states (empty, reading 6 files, done, partial, error "scan_0412.jpg could not be read" + "Try again"), "⚠ Check" tags | P2 | M |
| Money kept (flip) | SCREENS flip | Toggle, FLIP animation, rows, tiles | Desktop column header, absolute rows (rank × (rowHeight + 10)), MakeMyTrip ring in money mode, kept/lost bar, 4 stat tiles, formula caption, before/after Direct bar, "No website means few direct guests. Build one ›" | P2 | M |
| Repeat guests | SCREENS Repeat | List, confirm/dismiss | Two banner tiles (12, −₹41,800), guest cards with match chip, "Not new demand", Confirm / Not same only under 80%, privacy note, "Confirm matches" | P2 | M |
| Saturday move | SCREENS Saturday | Card, Accept / Later | Verbatim sentence, before/after bars, +₹10,110 tile, Accept / Not now, confirmation with Undo | P2 | S |
| Approvals | SCREENS Approvals | Draft cards, approve/reject, proof dialog | Consent badge, proof chip cross-fade, language, perk, code, WhatsApp-style preview, Edit (must keep STOP), bundle note "Write tonight's bundle", new empty-state copy. Needs an edit-draft API | P2 | M |
| Savings | SCREENS Savings | Gold total, list | Gold count-up (900ms), "No code, no saving claimed.", ledger rows, Season in review card; seed 4 historical coded bookings (D9) | P2 | M |
| Ask on WhatsApp | SCREENS Ask | Chat with 6 chips | Phone-style chat, 8 AM line, "From your statements" footer; answer 1 uses the real September figure (D15) | P2 | S |
| Consent proof | SCREENS Consent proof | Overview, bundles, dialog | Explainer, stats, nightly bundles with entry states (Verified, Pending proof, Deleted, Mismatch), dialog rows | P2 | M |
| Pro | SCREENS Pro | Cards | Dark cards Audit, Pulse, Rate Watch + 7 small cards, "Sample" labels (D10), "See Pro" | P2 | S |
| My Place | SCREENS My Place | None | 2D room grid and table first (D13), 3D hotel as stretch | P8 | L (2D) / XL (3D) |
| Guest inbox | SCREENS Guest inbox; video owner-02 | None | Rail, list, thread, profile; consented guests only; AI drafts as suggestions, owner sends (D5); away message owner-approved | P6 | XL |
| Assistant | SCREENS Assistant | None | Chat answering from ledger figures only, chips, sources row (D6) | P6 | M |
| Calendar (Pulse) | SCREENS Calendar | None | Month grid, sample event cards with channel decision, "Add to plan", "Sample" label | P6 | M |
| Website (Seedha Site owner) | SCREENS Seedha Site; video owner-03 to 05 | Setup chat, review, publish, packages | Tabs Site / Packages / Google kit, WhatsApp setup with 5 steps, building progress, review with moods and language, live state, Google kit | P5 | L |
| Billing | SCREENS Billing | Plans page only | Plan card, next charge, sample invoices, "Add payment method" sheet saying payments open after launch (D7); no card forms | P6 | M |
| Settings | SCREENS Settings | Connections, demo reset, log out | 8 tabs (Personal details with GSTIN/PAN validation D12, Hotel, Plan and billing, Contracts, Staff logins, Notifications, Security with "Planned" claims D8, Privacy and data) | P6 | L |

## Front desk and guest

| Screen | Reference | Exists now | What changes | Phase | Effort |
|---|---|---|---|---|---|
| Front desk mode | SCREENS Front desk; video desk-01, 02 | Desk simulator with box states, QR, slips | "Your Desk is connected" banner + Test print, off-white device with pine panel, LED bar (white, green glow, red), 58mm slot with 1.6s slip, D1 to D4 + "Printer needs paper", Simulate no paper, chime | P3 | L |
| Guest consent | SCREENS Guest mode | Consent page | Hotel tag, "Welcome, Neha ji.", dark perk card, stop note, "You are in." / "Your perk arrives after checkout." | P3 | S |
| Seedha Link | SCREENS Guest mode | Booking page + simulated UPI sheet | Trust line, photo placeholder, prefill from ?room=&in=&nights=&code=, UPI sheet with Google Pay / PhonePe / Paytm, "UPI fee 0.4% is paid by the hotel, not you.", processing "Approve in Google Pay", used-code copy | P3 | M |

## Auth and onboarding

| Screen | Reference | Exists now | What changes | Phase | Effort |
|---|---|---|---|---|---|
| Sign in | SCREENS Auth | Passcode screen | "Direct beta login" card, +91 mobile, keep-signed-in, "Send code on WhatsApp"; OTP simulated with SEEDHA_DEMO=1 banner (D4); passcode hint removed | P4 | L |
| Sign up, OTP, onboarding | SCREENS Auth | None | Sign up form, 6-digit OTP (300s, 5 tries then 15 min lock, resend 30s), 4-step onboarding, "Opening your dashboard". New API: /auth/otp/request, /auth/otp/verify, /me, /auth/logout | P4 | L |

## Public website and World B

| Screen | Reference | Exists now | What changes | Phase | Effort |
|---|---|---|---|---|---|
| Marketing site | SCREENS website 1 to 16; video marketing-01 to 12; handoff pages 2 to 6 | None (root redirects to /home) | Dark-first long page: header, blur-in hero, marquee, scroll-tilted product window with live flip, metrics count-up, flip explainer, features, growth calculator, Pulse strip, Desk, "No website yet?" band, trust, pricing, careers, FAQ, CTA, footer, cookie banner and settings | P7 | XL |
| Legal pages, 404 | SCREENS website | Built in M10 | Restyle to the website look and footer | P7 | S |
| Guest globe | SCREENS website 7; video marketing-06, 07 | None | d3 + topojson globe with arcs to Mussoorie, city list fallback (D13) | P8 | L |
| Hotel site (World B) | SCREENS World B; video hotel-site-01 to 05 | SitePreview inside Website | Full-page hotel site: Pine/Stone/Sky moods with their fonts, EN/HI, hero, booking bar, why book direct, rooms, packages, gallery, nearby, contact, "Made with Seedha" | P5 | L |
| Rate card A4 | video rate-card-01 | /rate-card (simple) | A4 World B layout | P5 | S |
| Agent deck (6 slides) | video agent-deck-01 | None | 6 World B slides | P5 | M |
| Pitch deck (10 slides) | video pitch-deck-01 | None | Not in FRONTEND_MASTER phases; not planned | n/a | n/a |
| Design system, Security review pages | Claude Design pages list | None | Design references, not product screens; not planned | n/a | n/a |

## Cross-cutting

- Tokens, Mukta, framer-motion: landed (D-077, D-078).
- Copy rules (D16): no em dashes, no exclamation marks, no "not X but Y".
- "Calculated from your statements" on every money total.
- Responsive breakpoints 760 / 980 / 1180; every screen at 390, 760, 980, 1440, light and dark; reduced motion.
- e2e updated for new navigation and auth (P9).
