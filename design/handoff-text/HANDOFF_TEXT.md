<!-- page 38 -->

README.md

# Overview and system

## Handoff: Seedha (full product UI and UX)

Seedha shows an owner-run hill hotel (10 to 40 rooms, Uttarakhand) what it actually kept from each booking channel, and stops it paying commission twice for guests it already won. The hero moment is **the flip**: rank channels by bookings, then by money kept per room. MakeMyTrip drops from 1st to 5th.

Taglines: "Know what you really keep from every booking." / "Stop paying commission twice for guests you already won."

### About the design files

Everything in `design/` is a **design reference built in HTML**: clickable prototypes that show the intended look and behaviour. They are **not production code**. Recreate them in a real stack. If there is no codebase yet, the recommended stack is:

- Web app: Next.js (App Router) + TypeScript + Tailwind or CSS modules, Framer Motion for the spring
- Backend: Node (Fastify or Nest) + Postgres + object storage for statements
- WhatsApp: WhatsApp Business Cloud API
- Desk hardware: ESP32 firmware talking to the API over TLS (MQTT or HTTPS)
- Payments: an Indian PCI DSS gateway (Razorpay or Cashfree) for UPI and cards

Open any `.dc.html` file directly in a browser to click through it (keep `support.js`, `deck-stage.js`, `doc-page.js` in the same folder).

### Fidelity

**High fidelity.** Final colours, type, spacing, copy and interactions. Rebuild pixel-close.

### Read in this order

1. `README.md` (this file): product, files, information architecture, tokens, rules
2. `SCREENS.md`: every screen and state, with layout and exact copy
3. `BEHAVIOR.md`: interactions, motion, state model, API, WhatsApp, Desk protocol, security
4. `DATA.md`: sample data, formulas, verified numbers
5. `Seedha_Design_Brief.pdf` and `PROJECT_MEMORY.md`: the source brief and the condensed memory

### Files (design/)

| File | What it is |
|---|---|
| `Seedha Website.dc.html` | Public marketing site, one long page: hero with live flip, metrics, ADR chart, features, growth calculator, guest globe, Pulse calendar, Desk, trust, Seedha Site band, pricing, careers, FAQ, footer, cookie banner and settings, legal pages (#/privacy #/terms #/cookies #/security), 404, light/dark switch, cursor glow |

<!-- page 39 -->

| File | What it is |
|---|---|
| `Seedha App.dc.html` | Sign in (WhatsApp OTP), Direct beta login, sign up, OTP, 4-step onboarding |
| `Seedha Dashboard.dc.html` | Owner app shell and every owner screen (see SCREENS.md) |
| `Seedha Desk and Guest.dc.html` | Front desk mode (Desk device simulator, slips) and Guest mode (consent, Seedha Link, UPI) |
| `Seedha Inbox.dc.html` | Guest inbox: chat with consented past guests, AI drafts, away bot, guest memory |
| `Seedha My Place.html` | 3D miniature hotel with per-room monthly profit (three.js) |
| `Seedha Globe.html` | 3D guest-origin globe (d3 + topojson) |
| `Seedha Site Owner.dc.html` | Seedha Site owner flow: empty state, WhatsApp setup, review and publish, packages, Google kit |
| `Hotel Site.dc.html` | Generated hotel website (World B), moods pine/stone/sky, English/Hindi |
| `Rate Card.dc.html` | A4 one-page rate card (World B) |
| `Agent Deck.dc.html` | 6-slide agent and group deck (World B) |
| `Seedha Pitch Deck.dc.html` | 10-slide pitch deck |
| `Seedha Design System.dc.html` | Tokens, components, conflict list, task board |
| `Seedha Security Review.dc.html` | 112 security checks with status |

### Information architecture

**A. Public site** `/` (one long page) + `/privacy` `/terms` `/cookies` `/security` + 404. **B. App** (opens from "Try the live demo"): one shell, header mode switch **Owner | Front desk | Guest**.

- Owner sidebar (desktop 232 px) or horizontal pill row (phone): Overview (Home), My Place, Guest inbox, Assistant, Upload, Money kept (flip), Repeat guests, Saturday move, Approvals, Savings, Ask on WhatsApp, Calendar, Website, Consent proof, Pro, Billing, Settings.
- Front desk: Desk simulator, slips, test print.
- Guest: consent screen and Seedha Link in a phone frame.

**C. Hotel sites (World B):** previewed inside Owner > Website; full-page sample. **Auth:** `/login`, `/signup`, `/otp`, `/onboard`, `/demo` (one-tap demo hotel). Every screen has a back button (history back, else Home).

### Design tokens (World A: every Seedha surface)

Source of truth: master prompt v2 Section 3 (Apple-inspired). PDF Section 9 tokens are replaced.

**Colour, light**

| Token | Hex | Use |
|---|---|---|
| bg | #FBFBFD | page |
| grouped | #F5F5F7 | grouped areas, segmented controls, app background |

<!-- page 40 -->

| Token | Hex | Use |
|---|---|---|
| card | #FFFFFF | cards, border rgba(0,0,0,.08) |
| text | #1D1D1F | primary text |
| text-2 | #6E6E73 | secondary text, captions |
| text-3 | #86868B | hints only (not for body, contrast) |
| accent (pine) | #1E6B4E | primary buttons, selected states, brand, links |
| gold | #E8A33D | **money saved only** (Savings card, "Saved with codes"); text on gold is #1D1D1F |
| gain | #1F8A55 | net kept, always with "+" |
| loss | #D7372B | commission, money lost, always with "−" |
| loss-soft | rgba(215,55,43,.1) | loss tag fills |
| fill | rgba(118,118,128,.12) | secondary buttons, chips |
| glass | rgba(245,245,247,.72) + blur 20px + saturate 180% | sticky headers, menus, sheets |

**Colour, dark:** bg #000, grouped #111113, card #1C1C1E, text #F5F5F7 / #A1A1A6 / #8E8E93, accent #4CC38A (text on accent #00170C), gold #F2B54E, gain #4CC38A, loss #FF6B5E.

**Channel chart colours** (neutral so red/green keep their meaning): MakeMyTrip #1D1D1F, Booking.com #48484A, Agoda #8E8E93, Travel agents #AEAEB2, Walk-in #C7C7CC, Direct #1E6B4E.

**Ratio:** 60% light surfaces, 30% graphite text and dark sections, 10% accent for the one action per screen.

**Type:** `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", Inter, "Helvetica Neue", Arial, sans-serif`. Devanagari: Mukta (fallback Noto Sans Devanagari). Roman-script Hindi uses the main font. All money: `font-variant-numeric: tabular-nums`, Indian grouping (₹26,04,000), ₹ always.

| Role | Size | Weight | Tracking |
|---|---|---|---|
| Hero number | 40 phone / up to 96 desktop | 700 | -0.05em |
| Large title | 36 to 40 phone, 56 to 64 desktop | 700 | -0.035 to -0.05em |
| Title | 28 to 34 | 700 | -0.025em |
| Headline | 20 | 600 | -0.02em |
| Body | 17, line-height 1.47 | 400 | -0.01em |
| Caption | 13 to 14 (never below 13) | 400 | 0 |

Sentence case everywhere. No all-caps labels except small eyebrow labels on the marketing site (13px, letter-spacing .08em).

**Space:** 8-point grid. Screen padding 20 phone, 24 to 28 desktop. Marketing sections 200px vertical, golden-ratio gaps 17 / 27 / 44 / 72 / 89. **Radius:** inputs 12, list rows 18, cards 22 to 24, large panels 28, buttons full pill (980px), bottom sheets 24 top corners. **Shadow:** almost none. Raised cards `0 1px 2px rgba(0,0,0,.04), 0 8px 28px rgba(0,0,0,.06)`. **Tap targets:** minimum 48 x 48 (44 allowed for dense secondary controls). **Motion:** one curve `cubic-bezier(0.22, 1, 0.36, 1)`. See BEHAVIOR.md.

<!-- page 41 -->

### World B (the hotel's own assets)

Hotel site, rate card and agent deck belong to the hotel, not Seedha. Photo-led, hotel name is the brand, Seedha only as a tiny "Made with Seedha" footer. Three moods:

| Mood | Accent | Display font | Text font | bg |
|---|---|---|---|---|
| Pine | #1F4D3A | Cormorant Garamond 600 | Mukta | #F7F6F2 |
| Stone | #4A4540 | DM Serif Display | Mukta | #F6F4F1 |
| Sky | #2F6FA8 | Outfit 600 | Mukta | #F5F8FB |

### Rules nobody may break

1. Never message guests found through OTA data. Repeat-guest list is internal only.
2. Consent checkbox unticked by default; every guest message shows how to stop ("Reply STOP to opt out").
3. Perks and packages add value; never a lower public rate.
4. Every rupee total carries "Calculated from your statements". AI never writes a rupee figure.
5. TDS is a tax credit, never shown as a cost.
6. No scraping. Rate Watch uses the owner's screenshot.
7. Pulse is a channel decision, never a demand prediction.
8. No guest data on-chain; "blockchain" appears only in the proof dialog and Pro card.
9. Seedha Site publishes only after the owner taps "Publish site", with the hotel's own photos.
10. The flip is the hero of the home page, the app and the pitch.
11. All data is fictional sample data and labelled.
12. No em dashes in any copy. No exclamation marks. No "not X but Y".

Do not say: UPI is free; direct margin is 100%; guaranteed direct share; parity clauses are dead; DPDP is fully in force (consent duties start May 2027).

### Assets

No raster images. Photos are labelled gradient placeholders ("Sample photo"); replace with the hotel's own photos. Logo is a rounded square with two horizontal white bars plus the wordmark "Seedha" and optional Devanagari "सीधा". Map data: Natural Earth via world-atlas@2.0.2. 3D: three.js 0.160.

### Facts to verify before launch (keep as editable text)

UPI 0.4% MDR from 15 Oct 2026; GST rate on rooms up to ₹7,500; whether GST on OTA commission is claimable.

<!-- page 42 -->

SCREENS.md

# Screens and states

## Seedha: screens and states

Desktop 1440 and phone 390 for every screen. Every data screen has empty, loading, success and error states. Exact copy is in quotes. Tokens in README.md, numbers in DATA.md.

### Shared shell (owner app)

- **Header** (sticky, glass, 60px): back button (40px circle, "‹"), traffic-light dots, wordmark, hotel chip "Hotel Deodar View · 22 rooms" with green dot, mode switch **Owner | Front desk | Guest** (segmented, wide only), ⌘K search (wide), notifications bell with red count, avatar "RJ".
- **Notifications** (glass popover 370px): items with blue unread dot, time, "Mark all read".
- **Account menu**: Front desk mode, Guest mode, Settings, Security, Plans, Help, "Sign out" (red).
- **Sidebar** (≥980px, 232px, sticky top 84): items with 28px icon tile (selected: pine tile, white card row with shadow), red count on Approvals, "Pro" tag. Phone: horizontal pill row, scrollbar hidden.
- **⌘K command palette**: glass dialog, filter screens, Enter opens first.
- **Toast**: graphite pill bottom centre, 2.8s.
- **Idle dialog** after 30 min: "Still there?" / "Stay signed in".
- **No session**: "Your session has ended." Buttons "Sign in", "Direct beta login".

### Public website (dark first, light switch)

1. Header glass, links Product Growth Pulse Desk Pricing Careers, "Sign in", "Get started" (pine pill). Sun/moon theme switch.
2. **Hero**: eyebrow "FOR HOTELS, HOMESTAYS AND MOUNTAIN STAYS"; H1 "Know what you really keep." words blur in one by one, "keep." has a shine; lede "Every booking channel, after discount, commission and GST. On one screen."; buttons "Try the live demo" (pine) and "Talk to us on WhatsApp" (outline). Front-office marquee strip. Product window with traffic lights, 4 KPI tiles, segmented "By bookings / By money kept" and the live flip (rows glide, toast "MakeMyTrip drops from 1st to 5th"). Window tilts from rotateX 18° to 0 and scales .92 to 1 as you scroll.
3. Metrics: count-up ₹10,39,108 · 16.5% · ₹41,800 · +₹10,110.
4. The flip explainer with List vs Net RevPAR and animated list vs net ADR bars.
5. Features grid: Seedha Desk, Seedha Link, Seedha Site, Seedha Proof, Seedha Pulse (Pro), Seedha Audit (Pro).
6. Growth calculator: slider 0 to 60 room nights, animated cumulative chart vs Seedha cost.
7. Guest map: draggable 3D globe, arcs from guest cities to Mussoorie.
8. Pulse calendar Oct 2026 to Jan 2027 with event cards and channel decisions.
9. Seedha Desk section with device render.

<!-- page 43 -->

10. "No website yet?" band: "See a sample site", "Build mine".
11. Trust: Rupees by arithmetic, Consent first, Perks not lower rates, Your own data only, Every yes provable.
12. Pricing: Yearly/Monthly toggle (yearly default "Yearly · 2 months free"), Base / Pro (recommended, light card) / Max; one-time Site ₹4,999 line.
13. Careers (4 roles, Apply). 14. FAQ accordion. 15. Final CTA "Stop paying commission twice." 16. Footer (dark, columns Product, Account, Company, Seedha Site, Support, Legal, badges row, cookie settings).

Cookie banner (glass, equal buttons "Accept all", "Necessary only", "Choose") and settings dialog (Necessary always on, Analytics switch).

### Auth and onboarding (App)

- **Sign in**: "Direct beta login" card (one tap into demo), mobile +91 input (validates 6 to 9 start, 10 digits; error shake), "Keep me signed in on this device for 30 days", "Send code on WhatsApp", link to sign up.
- **Sign up**: name, hotel, WhatsApp number; required unticked Terms box; optional updates box; button disabled until valid.
- **OTP**: 6 digits, "Code expires in 4:59", "5 of 5 tries left", lock message after 5, resend in 0:30, "Change number". (Prototype: 000000 shows the error.)
- **Onboarding 4 steps** with progress bar: Property (name, town, rooms) → Commission contracts (MMT 22, Booking 18, Agoda 20, agents 10 %) → Cost per occupied room (optional) → Connect WhatsApp. CTA "Continue to upload". Loading "Opening your dashboard".

### Owner screens

- **Overview (Home)**: date, "Namaste, Rajesh ji.", "See the flip". Dark insight banner with HI/EN toggle. Six KPI tiles (Net kept, Net ADR, Net RevPAR, Paid to channels, Direct share, Saved with codes in gold). **Set up the direct loop** checklist (8 steps, progress, hides when done). Waterfall "Where ₹63,05,000 went". Channel mix donut (37% occupancy). Last night room grid (14 of 22) with "Print close slip on Desk". Needs you list. Empty: "Start with your statements" + "Upload statements".
- **Upload**: drop zone "Drop files here", "Use sample statements", "Choose files". Reading: 6 file rows with progress ("Reading 6 files"). Done: "✓ 1,500 rows matched. 3 need a look." with three flagged rows and "⚠ Check" tag; "See my real money". Error: "scan_0412.jpg could not be read" + "Try again".
- **Money kept (the flip)**: title "Bookings are not money.", insight line, segmented toggle, column header (desktop), 6 absolute rows that glide 700ms to new rank, MakeMyTrip gets a ring in money mode, kept/lost bar per row, 4 stat tiles, formula caption, before/after Direct bar and "No website means few direct guests. Build one ›".
- **Repeat guests**: two banner tiles (12, −₹41,800), guest cards with match chip and "Not new demand", Confirm / Not same under 80%, privacy note, "Confirm matches".
- **Saturday move**: verbatim sentence, before/after bars, +₹10,110 tile, "Accept" / "Not now", then confirmation with "Undo".
- **Approvals**: draft card with name, consent badge, proof chip ("Pending proof" → "Verified"), language, perk, code, WhatsApp-style preview, "Approve and send", "Edit" (must keep STOP or error), "Reject". Bundle note with "Write tonight's bundle". Empty: "No guests waiting." / "New drafts appear after checkout." / "Open Seedha Desk".

<!-- page 44 -->

- **Savings**: gold card counts up to ₹12,600 (900ms), "No code, no saving claimed.", ledger rows, **Season in review** card.
- **Ask on WhatsApp**: phone-style chat, 8 AM line, six chips, answers with "From your statements".
- **Assistant**: chat answering from ledger figures only, suggestion chips, sources row.
- **Calendar (Pulse)**: month grid, event cards with channel decision and "Add to plan".
- **Website**: embeds Seedha Site owner flow (below). **My Place**: embeds 3D hotel. **Guest inbox**: embeds inbox.
- **Consent proof**: explainer, stats, three nightly bundles with entries (Verified, Pending proof, Deleted, Mismatch); entry opens proof dialog (status chip, title, body, Guest/Given/Bundle/Fingerprint rows, blockchain note).
- **Pro**: dark cards Audit, Pulse, Rate Watch; small cards Tonight Card, Who Paid the Discount, Floor by Channel, Group Displacement, Agent Khata, Two-Property Rollup, Seedha Proof; "See Pro".
- **Billing**: plan card "Pay ₹1,499 now", next charge, payment methods (default, make default, remove), add method sheet (UPI ID / Card with Luhn, MM/YY, CVV, name / Net banking banks), AutoPay checkbox, processing, success; invoices; PCI note.
- **Settings tabs**: Personal details (name, email, mobile, business, GSTIN, PAN, address, PIN with validation, "Save details"), Hotel, Plan and billing, Contracts (contracted vs statements), Staff logins (add, remove, invite), Notifications (8 AM line, 9 PM slip, approvals), Security (two-step locked on, idle sign-out, sessions, last sign-in), Privacy and data (cookies, download, consent log, delete with confirm dialog).

### Guest inbox

Rail · list (search, filters All/Unread/Auto-replied/Online, consented guests only) · thread (bubbles, bot label, voice note, booking card, typing dots, suggestion row, "✦ Draft with AI", ₹ inserts rate card line, composer Enter to send, auto-adds STOP to offers) · profile (consent, "What Seedha remembers" with Forget, stays, export, "Forget this guest"). "Away · bot on" toggle with custom auto-reply. Responsive: 3 columns ≥1180, list+thread 760 to 1179 (profile slides over), single view <760.

### My Place

KPIs (net kept, profit, rooms in profit, break-even), Profit/Channel colour switch, 3D hotel (tilt-shift miniature, rounded building, glowing room windows, gold sign, entrance, pool, pines, terrain with snow), zoom buttons (wheel scrolls the page), tap a room for a popover, property controls, month summary, sortable room table synced with 3D selection, profit by floor bars.

### Front desk mode (Desk device, 480 × 320 screen)

Connected banner with "Test print". Device: off-white case, pine front panel, LED bar (white idle, green success with glow, red error), "Print" button, 58 mm slot with paper sliding out over 1.6s. States: D1 Idle "Seedha" / "Deodar View · Ready"; D2 QR "Room 104, scan to get your perk"; D3 green check "Thank you, Neha ji" / "Consent saved · Proof added tonight"; D4 "Printing slip" / "Please take your receipt"; error "Printer needs paper". Controls: Show QR, Check out and print (disabled until consent), 9 PM close slip, Simulate no paper.

<!-- page 45 -->

### Guest mode

Consent: hotel tag, "Welcome, Neha ji.", dark perk card, unticked checkbox, disabled button until ticked, stop note, confirmation "You are in." / "Your perk arrives after checkout." Seedha Link: trust line, photo placeholder, dates, room, perk code field (valid / invalid / already used), total with nights, "Pay with UPI" → bottom sheet (Google Pay, PhonePe, Paytm, "Pay ₹8,600", "UPI fee 0.4% is paid by the hotel, not you.") → processing "Approve in Google Pay" → "Booked." Opens prefilled from `?room=&in=&nights=&code=`.

### Seedha Site (owner)

Tabs Site / Packages / Google kit. Empty: "Your hotel, online in 10 minutes." + "Start on WhatsApp". Setup: WhatsApp phone with 5 steps (photos with "6 of 8 photos" and guidance, Hindi voice note with summary and "Theek hai" / "Change", room chips, nearby chips, contact and UPI), "Building your site" progress, "Review my site". Review: "Your hotel, online." / "Check it, then publish.", mood (Pine/Stone/Sky) and language switches, not-live warning, phone and desktop previews, checklist, "Publish site", "Change something"; live: "Your site is live", "Copy link", "Share on WhatsApp". Packages: 3 AI cards with reason, Approve / Edit / Skip, rule line. Google kit: EN and HI descriptions with copy, categories, best 5 photos, 4 steps, "never asks for your Google password".

### World B outputs

Hotel site (header with language switch, full-bleed hero, booking bar with closed-date state, why book direct, rooms, packages or "coming soon", gallery, nearby, contact, tiny footer). Rate card A4. Agent deck 6 slides (cover, rooms, packages, groups and weddings, location, contact).

### Pitch deck (10 slides)

1 Hook ₹4,000 / ₹2,788 · 2 Owner story · 3 Why tools miss · 4 The flip · 5 Repeat guests and Saturday move · 6 Desk and slip · 7 Where AI works · 8 Legal · 9 Plans, "No website? We build one in 10 minutes." · 10 UNWTO line (placeholder) and the ask (placeholder).

<!-- page 46 -->

BEHAVIOR.md

# Behaviour, transitions, backend, hardware

## Seedha: behaviour, motion, state, backend and hardware

### Motion (one curve: cubic-bezier(0.22, 1, 0.36, 1))

| Moment | Spec |
|---|---|
| Screen enter | opacity 0 → 1, translateY 10–16px → 0, 500–550ms |
| Segmented control | white pill slides translateX, 300ms |
| **The flip** | rows are absolutely positioned; on toggle each row animates `transform: translateY(rank × (rowHeight + 10))` over 700ms. Rows never fade. MakeMyTrip gets a ring (2px graphite + soft shadow) in money mode; 700ms later toast "MakeMyTrip drops from 1st to 5th" |
| Savings counter | count up from 0 to ₹12,600, 900ms, ease-out cubic |
| Desk success | check scales 0.4 → 1 (500ms), LED bar glows green (1.2s loop), short two-tone chime (880 Hz then 1320 Hz) |
| Thermal slip | paper translateY −102% → 0 over 1.6s, cubic-bezier(.3,.7,.3,1) |
| Bottom sheet | slides up 450–550ms, 24px top radius |
| Verified chip | background and dot colour cross-fade 400ms Pending → Verified |
| Hero headline | each word: opacity 0, blur 14px, translateY 28px, scale .96 → none, staggered 150ms |
| Product window | rotateX 18° → 0, scale .92 → 1, linked to scroll 0–600px |
| Count-up metrics | 1.4s ease-out when section enters viewport |

Respect `prefers-reduced-motion`: every animation and transition becomes instant. Motion only answers a user action (exceptions: slip, counter, ambient hero glow).

### Core state (owner app)

```
type Channel = { name; roomNights; listAdr; listRevenue; discount; commission; gstOnCommission; fees; netKept; netAdr };
type RepeatGuest = { id; name; firstStay; returnStay; match: number; paidTwice: number; status: 'auto'|'pending'|'confirmed'|'not_same' };
type Draft = { guestId; language; perk; code; text; consentAt; proof: 'pending'|'verified'|'deleted'|'mismatch' };
type CodedBooking = { guestName; code; commissionAvoided; via: 'seedha_link' };
type Session = { userId; role: 'owner'|'front_desk'; deviceId; createdAt; lastActiveAt };
```

<!-- page 47 -->

UI state per screen: `uploadState: empty|reading|done|partial|error`, `flipSort: list|netAdr`, `insightLang: hi|en`, `scenario: null|accepted|later`, `drafts[]`, `editing`, `ledger[]`, `notificationsRead`, `idleWarning`, `theme: light|dark|auto`. Setup checklist (8 steps) is derived: uploaded, rows read, flip viewed, repeat confirmed, Desk consent, checkout slip, win-back approved, guest booked with code.

### Validation rules

- Indian mobile: `^[6-9]\d{9}$`. OTP: 6 digits, expires 300s, 5 tries then 15 min lock, resend after 30s.
- GSTIN: `^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$` (optional). PAN: `^[A-Z]{5}\d{4}[A-Z]$`. PIN: 6 digits.
- UPI ID: `^[\w.\-]{2,}@[a-z]{2,}$`. Card: Luhn, 15–16 digits, MM/YY not past, CVV 3–4.
- Guest message must contain "STOP"; offers get "Reply STOP to opt out." appended automatically.
- AI draft rejected if it contains ₹, "rs" + digits, or any 3+ digit number; fall back to a canned reply.
- Packages: price is owner-entered; never below the public room price.

### API sketch (REST, JSON, all behind auth)

```
POST /auth/otp/request {phone}           POST /auth/otp/verify {phone, code} → session cookie
GET  /me                                 POST /auth/logout   GET/DELETE /sessions/:id
POST /properties  PATCH /properties/:id  PUT /properties/:id/contracts
POST /statements (multipart) → {jobId}   GET /statements/jobs/:id → {files[], rowsMatched, flagged[]}
GET  /ledger/summary?from&to             GET /ledger/channels?from&to  (net computed server side)
GET  /repeat-guests  PATCH /repeat-guests/:id {status}
GET  /scenarios/saturday  POST /scenarios/:id/accept
GET  /drafts  PATCH /drafts/:id {text}  POST /drafts/:id/approve  POST /drafts/:id/reject
GET  /proof/bundles  POST /proof/bundles/seal (cron 21:00 IST)  GET /proof/consents/:id
GET  /codes/ledger                       POST /link/bookings {code, room, in, nights} → payment intent
POST /payments/webhook (signature verified, idempotent)
GET/POST /site  POST /site/publish  GET/PATCH /site/packages/:id
GET  /inbox/threads  GET/POST /inbox/threads/:id/messages  PATCH /inbox/away
POST /billing/methods  POST /billing/charge  GET /billing/invoices
GET  /export  DELETE /account
```

Rupee figures are always computed by the server from statement rows. The AI service only receives text and returns text.

### WhatsApp

- Owner: 8 AM one Hindi line; six fixed quick replies (no free text) answered from `/ledger`; 9 PM close message. Footer "From your statements".
- Guests: only those with a Desk consent record. Templates approved by Meta. STOP webhook marks consent withdrawn immediately and deletes marketing data.
- Away bot: answers rate card and FAQ only, hands everything else to the owner, never writes prices from AI.

### Seedha Desk protocol (ESP32, 3.5" 480×320, 12-LED ring, Print button, 58 mm printer)

- Pairing: owner scans a one-time pairing code in Settings; device gets a device certificate. One Desk = one property; owner can revoke.

<!-- page 48 -->

- Transport: MQTT over TLS (or HTTPS long-poll). Topics: `desk/{id}/cmd` (show_idle, show_qr {room, bookingId, qrUrl, expiresAt}, show_success {name}, print {lines[]}, print_close) and `desk/{id}/evt` (consent_received, print_ok, print_error {reason}, button_pressed, heartbeat).
- QR encodes a short-lived booking-bound URL `/c/{token}`; guest page shows consent; on submit server stores consent {guest, booking, time, device} and pushes show_success.
- LED: white idle, green success (pulse 1.2s), red error. Firmware signed, secure boot, flash encryption, no guest data stored on device.
- In the prototype, Desk and Dashboard sync through `BroadcastChannel('seedha')` with events `consent`, `slip`, `booked`, `booked-nocode` and the command `print-close`, plus localStorage flags `seedha-consent`, `seedha-slip`, `seedha-booked`, `seedha-sent`, `seedha-v-flip`. Replace with the real transport.

### Consent proof

Every night 21:00 IST: hash each consent record (salted, no plain PII), build a Merkle tree, store root as the bundle fingerprint, anchor only the root on a public chain. Entry states: Verified (record hashes to a leaf in a sealed root), Pending (not yet sealed), Deleted (record erased after STOP, leaf remains), Mismatch (record changed after sealing: block messaging, alert owner).

### Responsive

Breakpoints: phone <760, tablet 760–979, desktop ≥980 (sidebar), wide ≥1180 (inbox profile column). Fluid widths with `minmax(0,1fr)` grids; no text wraps inside pills (`white-space: nowrap`); horizontal pill rows scroll with hidden scrollbar.

### Accessibility

Contrast ≥ 4.5:1; colour never alone (signs + labels); tap targets ≥ 48px; visible focus ring 2–3px accent; `aria-pressed` on segmented buttons, `role=switch` on toggles, `aria-live` on chats and toasts; dialogs `aria-modal`, Escape closes; reduced motion respected.

### Security

See `design/Seedha Security Review.dc.html` for 112 checks marked Built / Backend spec / Policy. Must-haves before launch: HttpOnly Secure SameSite cookies, CSRF tokens, rate limits on OTP, server-side role checks, CSP and frame-ancestors, upload type/size limits with sandboxed parsing, encrypted storage in India, signed payment webhooks, idempotent payments, audit log, signed Desk firmware.

### Assumptions to confirm

Accent is pine #1E6B4E (master prompt v2). Website opens dark with a light switch. "Season in review" covers Apr to Sep (no monthly split in the brief). Ledger row split, guest conversations, WhatsApp answers 1 and 4, Audit ₹18,640, Rate Watch ₹3,950, event dates other than Winter Line Carnival, careers roles, security claims, "The Desk is included with yearly plans", pitch slide 10 placeholders.

<!-- page 49 -->

DATA.md

# Data and copy

## Seedha: data, formulas and verified numbers

All data is fictional. Use exactly these numbers. Every money total shows "Calculated from your statements".

### Property

Hotel Deodar View, Mall Road, Mussoorie. 22 rooms. Period Apr to Sep 2026: 183 days, 4,026 available room nights, 1,500 sold (37% occupancy). Owner: Rajesh ji (52). Front desk: Pooja (24).

### Net formula

`net = list revenue − hotel-funded discount − commission − 18% GST on commission − payment fees` TDS is not a cost and never appears in net.

### Channel table

| Channel | Room nights | List ADR | List revenue | Discount | Commission | GST on comm. | Fees | Net kept | Net ADR |
|---|---|---|---|---|---|---|---|---|---|
| MakeMyTrip | 620 | ₹4,200 | ₹26,04,000 | ₹3,12,480 | ₹5,04,134 | ₹90,744 | ₹0 | ₹16,96,641 | ₹2,737 |
| Booking.com | 310 | ₹4,400 | ₹13,64,000 | ₹1,36,400 | ₹2,20,968 | ₹39,774 | ₹0 | ₹9,66,858 | ₹3,119 |
| Agoda | 140 | ₹4,000 | ₹5,60,000 | ₹84,000 | ₹95,200 | ₹17,136 | ₹0 | ₹3,63,664 | ₹2,598 |
| Travel agents | 180 | ₹3,800 | ₹6,84,000 | ₹0 | ₹68,400 | ₹0 | ₹0 | ₹6,15,600 | ₹3,420 |
| Walk-in | 90 | ₹4,500 | ₹4,05,000 | ₹0 | ₹0 | ₹0 | ₹0 | ₹4,05,000 | ₹4,500 |
| Direct (WhatsApp + UPI) | 160 | ₹4,300 | ₹6,88,000 | ₹0 | ₹0 | ₹0 | ₹2,752 | ₹6,85,248 | ₹4,283 |
| Total | 1,500 | ₹4,203 | ₹63,05,000 | ₹5,32,880 | ₹8,88,702 | ₹1,47,654 | ₹2,752 | ₹47,33,011 | ₹3,155 |

Implied rates: MMT 12% discount / 22% commission; Booking.com 10% / 18%; Agoda 15% / 20%; agents 10% commission, no GST; direct fee 0.4% UPI MDR. "Paid away" per row (discount + commission + GST + fees): MMT −₹9,07,358 · Booking.com −₹3,97,142 · Agoda −₹1,96,336 · Agents −₹68,400 · Walk-in ₹0 · Direct −₹2,752.

### The flip

| Rank | By list revenue ("By bookings") | By net ADR ("By money kept") |
|---|---|---|
| 1 | MakeMyTrip ₹26,04,000 | Walk-in ₹4,500 |
| 2 | Booking.com ₹13,64,000 | Direct ₹4,283 |
| 3 | Direct ₹6,88,000 | Travel agents ₹3,420 |

<!-- page 50 -->

| Rank | By list revenue ("By bookings") | By net ADR ("By money kept") |
|---|---|---|
| 4 | Travel agents ₹6,84,000 | Booking.com ₹3,119 |
| 5 | Agoda ₹5,60,000 | MakeMyTrip ₹2,737 |
| 6 | Walk-in ₹4,05,000 | Agoda ₹2,598 |

### Headline metrics

- Paid to channels (commission + GST on commission + fees): ₹10,39,108
- Channel cost as % of list revenue: 16.5%
- Direct share of room nights (direct + walk-in): 16.7%
- List RevPAR ₹1,566 / Net RevPAR ₹1,176
- Net ADR ₹3,155 vs list ADR ₹4,203
- Repeat guests via OTA: 12 guests, ₹41,800 commission paid twice (if A. Verma marked "Not same": 11 guests, ₹37,740)

### Repeat guests (3 of 12 shown)

| Guest | First stay | Return stay | Match | Paid twice |
|---|---|---|---|---|
| Rahul S., Delhi | MakeMyTrip, May 2025 | MakeMyTrip, May 2026 | 92% | ₹3,480 |
| Neha Gupta, Gurugram | Booking.com, Oct 2025 | Booking.com, Jun 2026 | 88% | ₹3,120 |
| A. Verma family, Lucknow | Agoda, Dec 2025 | MakeMyTrip, Apr 2026 | 74% (needs confirm) | ₹4,060 |

Confirm / Not same buttons only below 80%.

### Saturday move (One-Scenario)

"Hold 6 Saturday rooms off Agoda. Keep them for direct and walk-in guests. Expected extra kept: ₹10,110 per Saturday if they sell direct." Before 6 × ₹2,598 = ₹15,588 · After 6 × ₹4,283 = ₹25,698 · Extra +₹10,110.

### Code Ledger

4 coded direct bookings, ₹12,600 commission avoided. Sample rows (split is an assumption): Kapoor family DEODAR-KF26 ₹2,840 · S. Bisht DEODAR-SB26 ₹3,480 · Arjun Mehta DEODAR-AM26 ₹3,120 · Iyer family DEODAR-IF26 ₹3,160.

### Slips

Checkout slip: Room ₹4,000 · Discount −₹600 · Commission −₹612 · GST on commission −₹110 · Hotel kept ₹2,678. Line: "Book direct next time and the hotel keeps it all." Code DEODAR-NG26. Pitch hook: ₹4,000 booked, ₹2,788 kept (before GST on commission). Both correct, never mix. 9 PM close slip (sample): rooms sold 14 · gross ₹58,800 · commission + GST −₹10,900 · net ₹47,900 · direct share 21% · saved this month ₹12,600.

<!-- page 51 -->

### Seedha Link

Code DEODAR-NG26, Deluxe Valley View ₹4,300 a night, breakfast included. 2 nights = ₹8,600. Code works once; second use shows "This code was already used. You can still book at the same price."

### Seedha Site sample

Rooms: Deluxe Valley View ₹4,300 (breakfast included), Family Suite ₹6,200, Standard ₹3,400. Nearby: Mall Road 5 min walk, Gun Hill 10 min, Lal Tibba 15 min drive, Kempty Falls 30 min drive. Contact +91 90000 00000, UPI deodarview@upi (placeholders). Packages: Weekend in the clouds (2 nights, breakfast, bonfire) ₹9,400, reason "Your weekends fill fastest." · Char Dham stopover (1 night, breakfast at 5 AM, parking) ₹4,300, "Yatra guests stay one night on the way." · Monsoon midweek (3 nights, breakfast, late checkout) ₹11,900, "July and August weekdays are your emptiest."

### Pricing (early estimates)

Base ₹1,499/month (up to 25 rooms) · Pro ₹2,499 · Max ₹3,999 (two properties). Yearly = 10 months: ₹14,990 (₹1,249/mo) · ₹24,990 (₹2,083/mo) · ₹39,990 (₹3,333/mo). One-time: Seedha Site setup ₹4,999; statement clean-up ₹2,999. Footer: "Prices are early estimates."

### Growth calculator

Each room night moved from MakeMyTrip to direct keeps ₹1,546 more (₹4,283 − ₹2,737). Monthly extra = n × 1,546; 12-month = ×12; minus Base ₹17,988 a year. Labelled "Illustration, not a promise".

### My Place model

Rooms assigned a main channel in proportion to statement mix; nights per room = round(30 × occupancy); room net = nights × channel net ADR; room profit = net − nights × cost per occupied night − fixed monthly costs ÷ rooms. Break-even rooms = ceil(fixed ÷ average (net − room cost)). Illustration.

### WhatsApp six buttons and answers

1. Pichle mahine MakeMyTrip ko kitna diya? → "September mein MakeMyTrip ko ₹99,146 diye. Commission plus GST on commission."
2. Sabse accha channel kaunsa? → "Walk-in: har room par ₹4,500 bache. Online mein Direct sabse accha: ₹4,283 har room."
3. Kitne guest do baar commission dekar aaye? → "12 guests. Unpar ₹41,800 commission dobara diya."
4. Is hafte ka payment kab aayega? → "MakeMyTrip: ₹1,12,400 Friday ko. Booking.com: ₹58,200 ka virtual card abhi charge karna baaki hai."
5. Direct se kitna bacha? → "Is season ₹12,600 bache, 4 coded direct booking se."
6. Aaj ka close → "Kal: 14 rooms. Gross ₹58,800. Net ₹47,900. Commission plus GST ₹10,900. Direct share 21%."

Every answer footer: "From your statements". (Answers 1 and 4 come from the reference prototype, not the PDF; confirm.)

<!-- page 52 -->

### Pro sample figures (from the reference prototype, confirm)

Seedha Audit ₹18,640 to claim back · Rate Watch Agoda ₹3,950 vs direct ₹4,300 · Pulse: Winter Line Carnival 25 to 30 Dec.

### Verbatim copy

- Insight HI: "MakeMyTrip ne sabse zyada bookings di, par har room par sabse kam paisa chhoda."
- Insight EN: "MakeMyTrip brought the most bookings but left you the least per room."
- Win-back: "Namaste Neha ji, thank you for staying at Deodar View. Book your next stay directly with us and breakfast is on us. Code DEODAR-NG26. Reply STOP to opt out."
- Repeat note: "This list is for your eyes only. We never message these guests."
- Win-back empty: "No guests waiting. New drafts appear after checkout."
- Ledger: "No code, no saving claimed." Link trust: "You are booking directly with the hotel."
- Consent perk: "Free breakfast on your next direct stay"; checkbox "Send me direct-booking offers on WhatsApp"; CTA "Yes, send me offers".

<!-- page 53 -->

MATCH_THIS.md

# Match the approved build

## Make the build match the approved design ("save 1")

The approved look is in `screenshots/01` to `08`. The current localhost build does not match. Fix these differences first.

### Owner app shell (screenshots 02, 03)

- Header: back button, traffic-light dots, Seedha logo, hotel chip with green dot, mode switch **Owner | Front desk | Guest**, search with ⌘K, bell with red count, avatar "RJ".
- Remove the old top tabs "Pipeline" and "Plans". Pipeline is now the "Set up the direct loop" checklist on Overview. Plans lives in the account menu and in Billing.
- Sidebar: every item has a 28px rounded icon tile on the left. The selected item is a white card with a shadow and a pine icon tile. Item order: Overview, My Place, Guest inbox, Assistant, Upload, Money kept, Repeat guests, Saturday move, Approvals (red count), Savings, Ask on WhatsApp, Calendar, Website, Consent proof, Pro (tag), Billing, Settings, then the "Open Seedha Desk ↗" dashed card.
- Default landing screen is **Overview** (screenshot 02), not Upload.
- Overview: date line, "Namaste, Rajesh ji.", pine "See the flip" button, dark insight banner with "Show in English", six KPI tiles (Saved with codes is the gold tile), "Calculated from your statements" line, setup checklist, room grid, Needs you list.
- Type: large titles 56 to 64px bold, letter-spacing −0.05em. Body 17px. Cards radius 22 to 28px on #F5F5F7.

### Website (screenshots 04 to 08)

- Hero "Know what you really keep." with the front-office marquee and product window with the live flip.
- Footer with the columns Product, Account, Company, Seedha Site, Support, Legal, then the badge row.

### Front desk (screenshot 01)

- "Your Desk is connected" banner with "Test print" above the device.

### Known bugs in the design files, do not copy

- Website metrics show ₹0 until scrolled into view. Run the count-up when the section is first visible, and show the final value when motion is reduced.
- ADR card caption says "Blue is kept". It must say "Green is kept".
- Product window dots: use #FF5F57, #FEBC2E, #28C840.

### How to give this to Claude Code

Tell it: "Read MATCH_THIS.md, then open each file in design/ and each image in screenshots/. Rebuild the owner app shell and Overview to match screenshot 02 exactly before anything else."

<!-- page 54 -->

PROJECT_MEMORY.md

# Project memory (brief condensed)

## Seedha project memory (source: uploads/Seedha_Design_Brief.pdf v1.0, 3 Oct 2026)

The brief is the single source of truth. Invent nothing outside it. All data fictional. Attached design system project is EMPTY, so Section 9 tokens below are the visual system.

### Working loop (from brief Section 1)

For each screen, in Section 10 order: build with tokens + Section 8 data, then review against the checklist, list failures, fix, re-review. Repeat until all pass, then next screen. Final pass across the full set for colours, type, spacing, number formats, component names. No em dashes in UI copy. No features outside the brief.

### Product

- Seedha = Hindi "direct/straight". Optional Devanagari wordmark सीधा beside Latin.
- Taglines: "Know what you really keep from every booking." / "Stop paying commission twice for guests you already won."
- Pitch: shows a hill hotel what it actually kept from each channel, and stops it paying commission again for a guest it already has.
- Event: AI-Tourism Hackathon, TBI GEU, Dehradun, 13 to 14 Oct 2026. Track: Demand Forecasting & Revenue. Statement D6: Channel Mix and Distribution Cost.
- Customers: owner-run hotels/homestays, 10 to 40 rooms, Uttarakhand (Mussoorie, Nainital, Rishikesh, Auli, Char Dham route).
- Hero moment: THE FLIP. Rank by gross, then by net kept. MakeMyTrip drops 1st to 5th.
- Problem story: ₹4,000 on MMT, 15% hotel-funded discount, 18% commission, hotel keeps ₹2,788 (before GST on commission). Guest rebooks via MMT next year; second commission is invisible.

### Personas

- Owner Rajesh, 52, 22-room hotel, Mall Road Mussoorie. WhatsApp all day, distrusts apps. Big numbers, one decision per screen, Hindi labels.
- Front desk Pooja, 24. One tap, no typing, clear green/red feedback.
- Guest: Delhi family after 7-hr drive. Perk first, 4-second flow, clear consent, easy Stop.
- Judge: hospitality faculty. Correct hotel terms, believable numbers, flip visible in under a minute.

### D6 mapping

- Attribution (net after commission, discount, gateway, channel cost; net ADR, net RevPAR beside gross) -> S3 Flip
- Diagnosis (profitable vs volume, incremental vs cannibalising, repeat by channel) -> S4 Repeat guests

<!-- page 55 -->

- Recommendation (allocation, scenario) -> S5 One-Scenario Card
- Direct conversion -> S6, S7, S12(? brief typo, likely G2), D1 to D4
- Metrics to show somewhere: commission % of room revenue, direct booking share, net ADR by channel, net RevPAR, repeat bookings by channel, value of guests converted to direct.

### Workflow (8 steps)

1 upload statements + register. 2 AI reads; math check gross minus deductions = payout or flag. 3 Flip. 4 AI matches repeat guests, owner confirms, internal only. 5 Desk QR at check-in, consent, ring green. 6 Checkout slip with bill + perk code. 7 AI drafts win-back, owner approves, consenting guests only. 8 Guest books on Seedha Link with code; Code Ledger counts saving.

### Features (tier / status). SLIDE screens get same hi-fi standard.

BUILD (Base): Statement upload + AI parser; Flip; Direct True Cost; Repeat guests; One-Scenario Card; Seedha Desk; Win-back; Seedha Link; Code Ledger; Six Hindi buttons; Close Slip (if time); Cash Clock (if time). SLIDE: Tonight Card, Who Paid the Discount, Floor by Channel (Base); Seedha Audit, Seedha Pulse, Rate Watch, VCC Line, Agent Khata, Group Displacement (Pro); Two-Property Rollup (Max).

### AI rules

- AI: read statements (rows matched count, red flags), match guests ("Same guest? 87% sure" chip, Confirm / Not same), explain (one insight line top of each screen), draft messages (Approve, Edit, Reject).
- Rupee figures never written by AI. "Calculated from your statements" label near EVERY money total. WhatsApp owner questions = six fixed buttons, no free text.

### Pricing (hypothesis)

- Base ₹1,499/month, up to 25 rooms: upload, flip, Direct True Cost, repeat guests, One-Scenario, desk, win-back, Seedha Link, Code Ledger, Hindi buttons, Close Slip, Cash Clock, Tonight Card, discount split, floor.
- Pro ₹2,499/month: Base + Audit, Pulse, Rate Watch, VCC Line, Agent Khata, Group Displacement.
- Max ₹3,999/month: Pro for two properties, one login, one WhatsApp.
- Optional setup ₹2,999 (clean six months of old statements). Desk is not a headline price. Small text: "Prices are early estimates".

### Sample data (use exactly)

Hotel Deodar View, Mall Road, Mussoorie. 22 rooms. Apr to Sep 2026, 183 days, 4,026 available room nights, 1,500 sold (37% occupancy). Net = list revenue - hotel-funded discount - commission - 18% GST on commission - payment fees. TDS is NOT a cost, never shown in net.

| Channel | RN | List ADR | List rev | Discount | Comm | GST on comm | Fees | Net kept | Net ADR |
|---|---|---|---|---|---|---|---|---|---|
| MakeMyTrip | 620 | ₹4,200 | ₹26,04,000 | ₹3,12,480 | ₹5,04,134 | ₹90,744 | ₹0 | ₹16,96,641 | ₹2,737 |
| Booking.com | 310 | ₹4,400 | ₹13,64,000 | ₹1,36,400 | ₹2,20,968 | ₹39,774 | ₹0 | ₹9,66,858 | ₹3,119 |
| Agoda | 140 | ₹4,000 | ₹5,60,000 | ₹84,000 | ₹95,200 | ₹17,136 | ₹0 | ₹3,63,664 | ₹2,598 |

<!-- page 56 -->

| Channel | RN | List ADR | List rev | Discount | Comm | GST on comm | Fees | Net kept | Net ADR |
|---|---|---|---|---|---|---|---|---|---|
| Travel agents | 180 | ₹3,800 | ₹6,84,000 | ₹0 | ₹68,400 | ₹0 | ₹0 | ₹6,15,600 | ₹3,420 |
| Walk-in | 90 | ₹4,500 | ₹4,05,000 | ₹0 | ₹0 | ₹0 | ₹0 | ₹4,05,000 | ₹4,500 |
| Direct (WhatsApp + UPI) | 160 | ₹4,300 | ₹6,88,000 | ₹0 | ₹0 | ₹0 | ₹2,752 | ₹6,85,248 | ₹4,283 |
| Total | 1,500 | ₹4,203 | ₹63,05,000 | ₹5,32,880 | ₹8,88,702 | ₹1,47,654 | ₹2,752 | ₹47,33,011 | ₹3,155 |

Implied rates (verified): MMT 12% disc / 22% comm; Booking 10% / 18%; Agoda 15% / 20%; agents 10% comm, no GST; direct fee 0.4% (UPI MDR). Flip: by list revenue MMT, Booking, Direct, Agents, Agoda, Walk-in. By net ADR Walk-in ₹4,500, Direct ₹4,283, Agents ₹3,420, Booking ₹3,119, MMT ₹2,737, Agoda ₹2,598. Headlines: paid to channels ₹10,39,108; channel cost 16.5% of list revenue; direct share (direct + walk-in) 16.7%; List RevPAR ₹1,566 / Net RevPAR ₹1,176; 12 repeat guests via OTA, ₹41,800 commission paid twice. Repeat guests: Rahul S., Delhi, MMT May 2025 -> MMT May 2026, 92%, ₹3,480. Neha Gupta, Gurugram, Booking.com Oct 2025 -> Booking.com Jun 2026, 88%, ₹3,120. A. Verma family, Lucknow, Agoda Dec 2025 -> MMT Apr 2026, 74% (needs confirm), ₹4,060. Code Ledger: 4 coded direct bookings, ₹12,600 commission avoided. One-Scenario: ₹10,110 = 6 x (₹4,283 - ₹2,598). Verified. Checkout slip: room ₹4,000, discount ₹600, commission ₹612, GST on commission ₹110, hotel kept ₹2,678 (hook ₹2,788 is before GST; both correct, do not mix). G2: Code DEODAR-NG26, Deluxe ₹4,300/night, breakfast included.

### Copy (verbatim)

- Insight HI: "MakeMyTrip ne sabse zyada bookings di, par har room par sabse kam paisa chhoda."
- Insight EN: "MakeMyTrip brought the most bookings but left you the least per room."
- One-Scenario: "Hold 6 Saturday rooms off Agoda. Keep them for direct and walk-in guests. Expected extra kept: ₹10,110 per Saturday if they sell direct."
- Win-back: "Namaste Neha ji, thank you for staying at Deodar View. Book your next stay directly with us and breakfast is on us. Code DEODAR-NG26. Reply STOP to opt out."
- Six buttons: Pichle mahine MakeMyTrip ko kitna diya? / Sabse accha channel kaunsa? / Kitne guest do baar commission dekar aaye? / Is hafte ka payment kab aayega? / Direct se kitna bacha? / Aaj ka close.
- Repeat note: "This list is for your eyes only. We never message these guests."
- Win-back empty: "No guests waiting. New drafts appear after checkout."
- Ledger: "No code, no saving claimed". Link trust: "You are booking directly with the hotel". Slip: "Book direct next time and the hotel keeps it all".
- G1 perk: "Free breakfast on your next direct stay"; checkbox "Send me direct-booking offers on WhatsApp"; CTA "Yes, send me offers".

### Tokens (Section 9)

Mood: well-kept mountain ledger; pine forests, marigold, paper. Not flashy fintech. pine-700 #1F4D3A primary/buttons/headers · marigold-500 #E8A33D savings/highlights · ink-900 #1B2430 body · paper-50 #F7F4EE background · line-200 #D9D3C7 borders · gain-600 #2E7D4F net kept/positive · loss-600 #B83A2E commission/loss/failed · muted-500 #5B6470 secondary. Fonts: Latin "Inter or similar humanist sans" (prefer a humanist alternative over Inter); Hindi Mukta or Noto Sans Devanagari. Tabular figures, Indian grouping, ₹

<!-- page 57 -->

always. Phone type: hero number 40, H1 28, H2 22, body 17, small 14 min. Radius 12 cards, 8 buttons. 8-pt grid. Motion: 200 ms ease-out; flip rows swap over 600 ms (only big motion). A11y: 4.5:1 contrast, 48 px taps, never colour alone (+/- signs or icons). Note: white on marigold fails contrast, use ink on marigold.

### Deliverables

Owner dashboard 1440 + 390 phone; WhatsApp mockups; Seedha Link (phone first); Desk 480x320 landscape; 58 mm slips 384 px black only; pricing page; 10-slide deck.

### Screens (order)

S1 Onboarding (name, town, rooms; contracted commission % per OTA; cost per occupied room; WhatsApp number; CTA Continue to upload) S2 Upload (drag-drop PDF/Excel/CSV; file chips with OTA text + period; "Reading 6 files" then "1,500 rows matched, 3 rows need a look"; flagged rows with reason; states empty/uploading/success/partial/error; CTA See my real money) S3 Flip (toggle By bookings / By money kept; rows: list revenue, net kept, net ADR, kept vs lost bar; comm + GST red, net green; Direct shows fee; summary strip; Hindi insight + EN toggle; label; default By bookings, animated reorder) S4 Repeat guests (banner 12 / ₹41,800; cards; Confirm / Not same under 80%; "Not new demand" tag; privacy note; CTA Confirm matches) S5 One-Scenario (sentence; before vs after for one Saturday; Accept / Not now) S6 Win-back approvals (queue: name, language, perk, code; WhatsApp bubble; Approve/Edit/Reject; consent badge with Desk timestamp; empty state) S7 Code Ledger (big marigold counter; coded bookings list with commission avoided; explainer) S8 Cash Clock if time (week timeline stay revenue vs payout date per channel; pending payout total) S9 Settings and plans (plan card; commission contracts table; staff logins) S10 Pro slides (Audit overcharges + total; Pulse e.g. Winter Line Carnival 25 to 30 Dec with channel action; Rate Watch with screenshot thumb; one card each: Tonight Card, Who Paid the Discount, Floor by Channel, Group Displacement, Agent Khata, Two-Property Rollup) W1 WhatsApp morning line in Hindi, six quick replies, answer bubbles with exact rupees + "from your statements" footer G1 Consent (hotel + greeting; perk first; unticked checkbox; how to stop; states not ticked disabled / ticked / confirmed) G2 Seedha Link (photo, name, town; dates; room type; prefilled code; price with perk; Pay with UPI; trust line; states code valid / invalid / payment success) D1 Idle (logo, hotel, "Ready") · D2 QR "Room 104, scan to get your perk" · D3 check "Thank you, Neha ji", ring green · D4 "Printing slip" / "Printer needs paper". Box: ESP32, 3.5", 12-LED ring top edge (green success, white idle), big "Print" button, 58 mm slot front, matte off-white case, pine front panel, small marigold logo. P1 Checkout slip · P2 Close slip 9 pm (date, rooms sold, gross, net, commission, direct share, savings this month) K1 Pricing · K2 Deck: 1 Hook ₹4,000 booked ₹2,788 kept; 2 Owner story; 3 Why tools miss small hill hotels; 4 Flip live demo; 5 Repeat guests + One-Scenario; 6 Desk + slip; 7 Where AI works; 8 Legal: own data only, consent first, perks not undercutting; 9 Plans + Pro roadmap (Pulse, Audit, Rate Watch); 10 UNWTO line and the ask.

### Checklist (every screen)

5-second main point · rupees match Section 8, Indian grouping, ₹ · colour + sign/icon · 390 px works, body ≥17, taps ≥48 · one obvious primary action · correct terms (ADR, RevPAR, net ADR, commission, GST on commission), no "GOP" on per-room screens · "calculated from your statements" on every money total · consent unticked, every guest message shows how to stop · never suggest messaging OTA-sourced guests · no lower public rate as tactic, perks only · empty/loading/error states on every data screen · no em dashes · tokens on every surface incl. device + slips.

<!-- page 58 -->

### Never

OTA guest contacts for marketing · consent pre-ticked · lower public rate · AI-written rupees · TDS as cost · scraping OTAs (Rate Watch = owner screenshots) · Pulse as demand prediction. Do not say: UPI is free / direct margin 100%; guaranteed direct share; parity clauses dead everywhere; DPDP fully in force (consent duties start May 2027); other companies' numbers as ours; unbuilt feature shown live. To verify, keep as editable text: UPI 0.4% MDR from 15 Oct 2026; GST rate on rooms up to ₹7,500; whether GST on OTA commission is claimable.

### Brief gaps noted

- D6 table cites "S12" (no such screen; likely G2 Seedha Link).
- Sample data has 3 of 12 repeat guests (₹10,660 of ₹41,800); other 9 not specified.
- Code Ledger 4 bookings / ₹12,600 has no per-booking breakdown.
- Cash Clock, Close Slip, Pulse, Audit and other SLIDE screens have no figures; any numbers there must be derived or flagged as sample.
