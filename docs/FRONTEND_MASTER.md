# FRONTEND_MASTER.md · Seedha final UI and UX build

Read this whole file before every session. It merges three sources into one
plan and settles every conflict between them:

1. design/Design_Handoff.pdf: the Claude Design handoff (58 pages). Pages 2
   to 37 are the screen gallery (also rendered as PNG in
   design/handoff-pages/). Pages 38 to 58 are README, SCREENS, BEHAVIOR,
   DATA, MATCH_THIS and PROJECT_MEMORY.
2. design/video-screens/ and design/VIDEO_SPEC.md: 33 screenshots from a
   screen recording of the same Claude Design project.
3. design/claude-design-files/ (only if present): the exported .dc.html
   prototype files, README.md, SCREENS.md, BEHAVIOR.md, DATA.md,
   MATCH_THIS.md. If this folder exists, its HTML is the most exact source
   for spacing, colours and motion. Open each file and read its code.

The existing repo (CLAUDE.md, apps/api, apps/web, tests, rulings in
docs/decisions.md) stays the base. We restyle and extend apps/web and add
API endpoints where new screens need data. We do not switch stacks.

---

## 1. Priority of sources when they disagree

1. CLAUDE.md section 2 rules and the owner's rulings 1 to 7 in docs/decisions.md
2. Section 3 of this file (decisions)
3. The exported design files (if present)
4. Design_Handoff.pdf text pages (README, SCREENS, BEHAVIOR, DATA, MATCH_THIS)
5. Screenshots (handoff pages, then video screens)

Numbers always come from the API, never from a screenshot.

---

## 2. Design system (World A, every Seedha surface)

Already mostly in apps/web. Confirm and complete:

- Light: bg #FBFBFD, grouped #F5F5F7, card #FFFFFF (border rgba(0,0,0,.08)),
  text #1D1D1F, text-2 #6E6E73, text-3 #86868B (hints only), accent pine
  #1E6B4E, gold #E8A33D (money saved only, text on gold #1D1D1F), gain
  #1F8A55 (always with "+"), loss #D7372B (always with a minus sign),
  loss-soft rgba(215,55,43,.1), fill rgba(118,118,128,.12),
  glass rgba(245,245,247,.72) + blur 20px + saturate 180%.
- Dark: bg #000, grouped #111113, card #1C1C1E, text #F5F5F7 / #A1A1A6 /
  #8E8E93, accent #4CC38A (text on accent #00170C), gold #F2B54E, gain
  #4CC38A, loss #FF6B5E.
- Channel chart colours: MakeMyTrip #1D1D1F, Booking.com #48484A, Agoda
  #8E8E93, Travel agents #AEAEB2, Walk-in #C7C7CC, Direct #1E6B4E.
- Type: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display",
  Inter, "Helvetica Neue", Arial, sans-serif. Devanagari: Mukta (fallback
  Noto Sans Devanagari). Money: tabular-nums, Indian grouping, ₹ always.
- Sizes: hero number 40 phone to 96 desktop (700, -0.05em); large title 36
  to 40 phone, 56 to 64 desktop (700); title 28 to 34; headline 20 (600);
  body 17 / 1.47; caption 13 to 14, never below 13.
- Space: 8-pt grid; screen padding 20 phone, 24 to 28 desktop; marketing
  sections 200px vertical. Radius: inputs 12, list rows 18, cards 22 to 24,
  large panels 28, buttons pill 980px, sheets 24 top corners.
- Shadow: raised cards only, 0 1px 2px rgba(0,0,0,.04), 0 8px 28px
  rgba(0,0,0,.06). Tap targets 48px (44 for dense secondary).
- Motion: one curve cubic-bezier(0.22, 1, 0.36, 1). Screen enter fade + 10 to
  16px rise, 500 to 550ms. Segmented pill slide 300ms. Flip rows absolutely
  positioned, translateY(rank x (rowHeight + 10)) over 700ms, never fade,
  MakeMyTrip gets a ring in money mode, toast 700ms later. Savings count-up
  900ms. Desk check 0.4 to 1 over 500ms, LED green glow 1.2s loop, chime
  880 Hz then 1320 Hz. Slip translateY -102% to 0 over 1.6s,
  cubic-bezier(.3,.7,.3,1). Sheets 450 to 550ms. Verified chip cross-fade
  400ms. Hero words blur-in staggered 150ms. Product window rotateX 18 to 0
  and scale .92 to 1 over 0 to 600px scroll. prefers-reduced-motion makes
  everything instant. Framer Motion is approved.
- World B (hotel's own assets): Pine #1F4D3A + Cormorant Garamond 600 +
  Mukta; Stone #4A4540 + DM Serif Display + Mukta; Sky (blue accent, Outfit
  600) + Mukta. Read exact hex and backgrounds from the design files or page
  41 of the PDF; OCR of that table is unreliable, so confirm visually.
- Logo: rounded square with two horizontal white bars + wordmark "Seedha",
  optional Devanagari wordmark.
- Responsive: phone <760, tablet 760 to 979, desktop >=980 (sidebar 232px),
  wide >=1180 (inbox profile column). No text wraps inside pills.
- Accessibility: 4.5:1 contrast, colour never alone, visible 2 to 3px accent
  focus ring, aria-pressed on segmented buttons, role=switch on toggles,
  aria-live on chats and toasts, aria-modal dialogs that close on Escape.

---

## 3. Decisions (conflicts already settled; do not ask again)

D1 Numbers: the handoff shows Net kept ₹47,33,011 and "Direct share 16.7%".
   Ruling 1 and 3 win: show the API values (₹47,33,012) and the two labels
   "Commission-free share 16.7%" with sub-line "Direct bookings 10.7%".
D2 Stack: keep FastAPI + SQLite + Next.js. The handoff's Node suggestion
   applies only to a new codebase.
D3 Navigation: remove the top tabs "Pipeline" and "Plans". Pipeline becomes
   the "Set up the direct loop" checklist on Overview. Plans lives in the
   account menu and Billing. Default landing after sign-in is Overview.
D4 Sign-in: replace the passcode screen with the handoff flow: WhatsApp OTP
   sign in, sign up, OTP screen, 4-step onboarding, and a "Direct beta login"
   card that opens the sample hotel in one tap. In this build the OTP sender
   is simulated (same pattern as WhatsApp sending): when SEEDHA_DEMO=1, show
   the code in a clearly labelled demo banner; otherwise log it server-side
   only. OTP rules: 6 digits, expires 300s, 5 tries then 15 min lock, resend
   after 30s. Remove the passcode hint text from every page.
D5 Guest inbox away bot: rule 7 wins. No AI-written message is ever sent
   without the owner tapping Send. "Away mode" may send only an away message
   the owner wrote and approved once in Settings, and only to guests who
   wrote first and have a Desk consent record. AI drafts appear as suggestions
   the owner taps. Label: "Bot drafts, you send." Offers auto-append
   "Reply STOP to opt out."
D6 AI copy guard: reject any AI draft containing ₹, "rs" followed by digits,
   or any number with 3 or more digits; fall back to a canned template. Rupee
   values are inserted by code from the ledger.
D7 Billing: no card number, CVV or net-banking form in this build. Show plan
   card, next charge, invoices (sample), and "Add payment method" opening a
   sheet that says payments open after launch. Never store card data.
D8 Security claims: Settings and the website must not claim features we do
   not have. "Two-step sign-in", "encrypted at rest", "PCI DSS gateway" are
   shown only as "Planned" until built. "Guest consent logged" and "No OTA
   scraping" are true and can stay.
D9 Code Ledger sample: seed four historical coded direct bookings for the
   sample hotel (Kapoor family, S. Bisht, Arjun Mehta, Iyer family) so
   Overview and Savings show the handoff's "4 coded direct bookings". Their
   savings must be computed by our ruling 5 formula from seeded original
   channels; choose original channels and amounts so the total is ₹12,600
   if possible. If it cannot be exact, show the computed total and record it
   in docs/decisions.md. These historical codes are display-only and already
   redeemed; live Link redemption still uses the current code rules.
D10 Pro, Pulse, Audit, Rate Watch, My Place and Calendar figures are sample
   data and must carry a visible "Sample" label.
D11 Desk transport: keep HTTPS polling (the handoff allows HTTPS long-poll).
   Replace any BroadcastChannel or localStorage sync from the prototype with
   the real API.
D12 Settings personal details: GSTIN and PAN are optional, validated with the
   handoff regexes, stored only for the owner's own business, never logged.
D13 3D: My Place (three.js 0.160) and the guest globe (d3 + topojson-client
   + world-atlas@2.0.2 bundled locally, no runtime CDN) are stretch goals.
   If time is short, ship a clean 2D fallback (room grid and city list) with
   the same data and a "3D view coming soon" note.
D14 Known design bugs to fix: website metrics showing 0 until scrolled (run
   count-up when first visible, show final value under reduced motion); ADR
   caption must say "Green is kept"; window dots #FF5F57, #FEBC2E, #28C840.
D15 WhatsApp answer 1 must use the real September figure from the monthly
   breakdown (ruling 6), not ₹99,146.
D16 Copy: no em dashes, no exclamation marks, no "not X but Y" anywhere.

---

## 4. Build phases (in order)

Each phase: read the relevant handoff pages and screenshots, build, then run
the loop in section 6, commit locally, update docs/progress.md.

MUST (finish these first)
P1 App shell and Overview (MATCH_THIS, handoff pages 9 to 12, video
   owner-01 to 10): sticky glass header (back button, traffic dots,
   wordmark, hotel chip "Hotel Deodar View · 22 rooms", Owner | Front desk |
   Guest switch, ⌘K search, bell with count, avatar "RJ"); sidebar with
   28px icon tiles in the exact order Overview, My Place, Guest inbox,
   Assistant, Upload, Money kept, Repeat guests, Saturday move, Approvals,
   Savings, Ask on WhatsApp, Calendar, Website, Consent proof, Pro, Billing,
   Settings, then "Open Seedha Desk ↗"; phone pill row; notifications
   popover; account menu; ⌘K palette; toast; idle dialog; session-ended
   screen. Overview: date, "Namaste, Rajesh ji.", "See the flip", dark
   insight banner with HI/EN, six KPI tiles, "Calculated from your
   statements" line, 8-step checklist (derived from real state, hides when
   done), waterfall "Where ₹63,05,000 went", channel mix donut (37%
   occupancy), last night room grid (14 of 22) with "Print close slip on
   Desk", Needs you list. New API: /ledger/summary, /overview (or extend
   existing), /notifications, /needs-you, /rooms/last-night (sample close).
P2 Restyle existing owner screens to SCREENS.md (PDF pages 42 to 45):
   Upload, Money kept (column header, ring, before/after Direct bar,
   "No website means few direct guests. Build one ›"), Repeat guests,
   Saturday move (with Undo), Approvals (Edit must keep STOP or error),
   Savings (Season in review), Ask on WhatsApp, Consent proof (proof dialog
   states), Pro (dark cards + small cards).
P3 Front desk and Guest (handoff pages 19 to 22): connected banner with Test
   print, device with LED bar states (white, green, red), slip animation,
   D1 to D4 and error state, Simulate no paper; Guest consent and Seedha Link
   with UPI sheet (Google Pay, PhonePe, Paytm buttons, "UPI fee 0.4% is paid
   by the hotel, not you.", processing, "Booked."), prefill from
   ?room=&in=&nights=&code=, used-code copy "This code was already used. You
   can still book at the same price."
P4 Auth and onboarding (handoff pages 7 to 8, D4).

SHOULD
P5 Seedha Site owner flow (pages 22 to 25, video owner-03 to 05) and World B
   outputs: hotel site with moods and EN/HI (pages 26 to 27), rate card A4,
   agent deck 6 slides.
P6 Guest inbox (page 18, video owner-02) with D5; Assistant (ledger-only
   answers, D6); Calendar (Pulse sample events, "Add to plan"); Billing (D7);
   Settings tabs (Personal details, Hotel, Plan and billing, Contracts,
   Staff logins, Notifications, Security, Privacy and data) with D8 and D12.
P7 Public marketing website, dark first with light switch (pages 2 to 6,
   video marketing-01 to 12): hero with blur-in and live product-window flip,
   metrics count-up, flip explainer, features grid, growth calculator
   (illustration label), Pulse calendar strip, Desk section, "No website
   yet?" band, trust row, pricing (yearly default), careers, FAQ, final CTA,
   footer, cookie banner and settings, legal pages, 404. "Try the live demo"
   opens the app via Direct beta login.

STRETCH
P8 My Place 3D hotel and guest globe (D13).

FINISH
P9 Polish and verify (section 6 plus: every screen at 390, 760, 980, 1440;
   light and dark; reduced motion; Playwright e2e updated for the new
   navigation and auth; a demo-prod make target running next build + next
   start so no dev badge shows; docs/SCREEN_COMPARE.md listing each screen,
   the reference image used and remaining differences).

---

## 5. Sample data and copy

Use the locked seed data and CLAUDE.md numbers. Verbatim copy from the
handoff (PDF pages 51 to 52 and 56):
- Insight HI: "MakeMyTrip ne sabse zyada bookings di, par har room par sabse
  kam paisa chhoda." EN: "MakeMyTrip brought the most bookings but left you
  the least per room."
- Saturday move: "Hold 6 Saturday rooms off Agoda. Keep them for direct and
  walk-in guests. Expected extra kept: ₹10,110 per Saturday if they sell
  direct."
- Win-back: "Namaste Neha ji, thank you for staying at Deodar View. Book your
  next stay directly with us and breakfast is on us. Code DEODAR-NG26. Reply
  STOP to opt out."
- Repeat note: "This list is for your eyes only. We never message these
  guests."
- Empty approvals: "No guests waiting. New drafts appear after checkout."
- Ledger: "No code, no saving claimed." Link trust: "You are booking
  directly with the hotel." Slip: "Book direct next time and the hotel keeps
  it all."
- Consent perk: "Free breakfast on your next direct stay"; checkbox "Send me
  direct-booking offers on WhatsApp"; CTA "Yes, send me offers".
- Growth calculator: each room night moved from MakeMyTrip to direct keeps
  ₹1,546 more (₹4,283 minus ₹2,737), labelled "Illustration, not a promise".
- Pricing: Base ₹1,499 (yearly ₹14,990, ₹1,249/mo), Pro ₹2,499 (₹24,990,
  ₹2,083/mo), Max ₹3,999 (₹39,990, ₹3,333/mo); Seedha Site ₹4,999 one time;
  statement clean-up ₹2,999; "Prices are early estimates."
The PDF text pages were captured as images; if you OCR them, rupee signs may
read as %, 2, 3, 7 or =. Always cross-check numbers against the seed data.

---

## 6. Loop for every screen

1. Open the reference image(s) and the matching SCREENS.md section.
2. Build or restyle the screen with the tokens, wired to the API.
3. Screenshot it with Playwright at 1440 and 390, light and dark.
4. Compare with the reference. List every difference (layout, spacing,
   type, colour, copy, motion, states). Fix. Repeat until only intentional
   differences from section 3 remain.
5. Check: empty, loading, success, error states; numbers from API; "Calculated
   from your statements" on money totals; a11y; reduced motion; no em dashes.
6. make check must pass (all quality gates in CLAUDE.md). Never lower a
   threshold or skip a test.
7. Commit locally. Update docs/progress.md and docs/SCREEN_COMPARE.md.

---

Addendum (10 Oct 2026): the build runs as an agent team. See docs/AGENT_TEAM.md.
