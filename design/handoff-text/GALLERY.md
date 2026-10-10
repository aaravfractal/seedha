# Seedha screen gallery: visual catalogue (handoff PDF pages 2 to 37)

Source images: `design/handoff-pages/page-02.png` ... `page-37.png` (827 x 1170 px each, A4 PDF page renders,
so every screenshot is small; small text was read from 2x zoomed crops). Each PDF page carries one or two
figures with a caption "Fig N. <name> · screenshots/<file>.png". Figure numbers and original screenshot file
names are kept below so later work can match them.

## Reading notes (apply to all pages)

- **Design-tool chrome is NOT product UI.** Pages 02 to 06, 09, 10 and 19 were captured inside the design
  tool. Ignore: the dark left chat panel (#1E1E1E-ish, serif chat text about "design/: all 14 prototype pages",
  "Start a new chat to save 580k tokens of context", "New chat", "Continue here", "Design System",
  "Describe what you want to create...", "Opus 5.5 Medium", orange "Send" button) and the dark top toolbar
  ("Seedha Desk and Guest / 14 pages", "100%", "Comment", "Edit", "Present", "Share", avatar "AS"). Also ignore
  the small thumbnail of another page floating in the bottom-right corner (pages 03, 05). The product UI is
  the light pane to the right of the chat panel.
- **Common product palette (approximate):**
  - Page background (app): light grey #F2F2F4 to #F5F5F7. Cards: white #FFFFFF, no visible border, very soft
    shadow, radius about 16 to 20 px (pills fully rounded).
  - Pine (primary action / brand green): #1E6B4E (buttons "See the flip", "Verify and continue", "Add to plan",
    "Pay with UPI", outgoing WhatsApp bubble, active nav icon tile). Darker pine #24503A to #1F4D3A on hotel site.
  - Marketing site "Get started" / "Try the live demo" button: softer sage green about #6BAF92 / #69AE8E with
    dark text.
  - Money kept green (positive numbers, bars): #1F8A4C to #2E9E5B (bars a brighter #34C26A in the owner flip).
  - Money lost red: #D93B2E to #E04A3C (e.g. "−₹10,39,108"). Lighter salmon #E57F73 for the "paid away" part
    of bars.
  - Gold (money saved only): #E8A33D (Saved with codes card, Savings hero card) with dark text #1C1C1E.
  - Graphite / near black: #1C1C1E (headings, dark banner, dark stat card, active segment, avatar "RJ").
  - Secondary text grey: #6E6E73 to #8E8E93. Hairlines #E5E5EA.
  - Status green dot #2EAD5B / #34C759; notification badge red #E5383B with white number.
- **Type:** system sans (SF Pro / Inter-like) everywhere in the product and marketing site; headings bold
  (700), tight negative letter spacing, sentence case ending in a full stop ("Bookings are not money.").
  Large titles about 40 to 64 px; hero numbers 32 to 96 px bold; labels 13 to 15 px regular grey.
  The hotel site, rate card and agent deck (World B) use a classic serif display face (Cormorant Garamond /
  EB Garamond-like) with a humanist sans for body (Fira Sans / Alegreya Sans-like). Hindi uses a Devanagari
  sans (Noto Sans Devanagari / Mukta-like).
- Money uses Indian grouping (₹47,33,011) with a true rupee sign, and an en dash/minus for losses (−₹).
- Several screenshots show **text-wrapping bugs** (labels wrapping inside too-narrow pills/columns, text
  overlapping); they are noted per page as "layout defect" so the rebuild can avoid them.

---

## page-02: Marketing website, hero

- Page heading (PDF, not product): eyebrow "GALLERY" (pine, letterspaced caps), title "Screen gallery",
  intro: "Captured from the prototype at desktop width. The 3D My Place page and globe use WebGL and cannot be
  captured; open design/Seedha My Place.html and design/Seedha Globe.html to see them. Iframe previews inside
  the Seedha Site review screen appear blank here for the same reason." Section heading "Public website".
- Caption: "Fig 1. Hero: "Know what you really keep." with marquee and product window · screenshots/04-website-hero.png"
- State: public website, home, light, desktop, top of page.
- **Top nav** (white, about 56 px tall, full width): left logo "Seedha" (bold, black) followed by Devanagari
  "सीधा" in lighter grey. Centre-right links (grey #555, 13 to 14 px): "Product", "Growth", "Pulse", "Desk",
  "Pricing", "Careers". Then a crescent-moon icon (dark mode toggle), "Sign in" (black text link), and pill
  button "Get started" (sage green #6BAF92 fill, dark text, fully rounded).
- **Hero** (centred, lots of whitespace): a large soft blurred green radial glow behind the upper left, a faint
  lavender/blue glow to the right (ambient gradient blobs).
  - Eyebrow: "FOR HOTELS, HOMESTAYS AND MOUNTAIN STAYS" (small, grey, wide letter spacing, caps).
  - H1: "Know what you really keep." (very large, about 72 to 80 px, bold, near black, tight tracking).
  - Sub: "Every booking channel, after discount, commission and GST. On one screen." (grey, about 18 px,
    centred, wraps to 2 lines).
  - Buttons side by side: "Try the live demo" (sage green filled pill with soft green shadow, dark text) and
    "Talk to us on WhatsApp" (white pill with thin grey border, dark text).
- **Marquee strip**: full-width band between two hairlines, uppercase letterspaced grey words separated by
  middle dots: "ROOM NIGHTS · NET ADR · NIGHT AUDIT · FOLIO · FRONT DESK · CLOSE SLIP 9 PM" (first word
  clipped at left edge, i.e. it scrolls horizontally; motion: continuous marquee).
- Bottom edge: top of the "product window" card: macOS-style traffic lights (red, brown/amber, green dots),
  centre grey pill "Hotel Deodar View · Mussoorie", right "Apr to Sep 2026" (grey). Card is light grey
  #F5F5F5 with large radius (about 20 px).

## page-03: Marketing website, live flip inside product window

- Caption: "Fig 2. Live flip inside the product window · screenshots/05-website-flip.png"
- State: public website, scrolled to the product window, light, desktop, flip toggle on "By bookings".
- Same top nav as page-02.
- **Product window card** (light grey #F4F4F4, radius about 20 px, faint border): header row with traffic
  lights (red #FF5F57, brown #8B4513-ish, green #1F8B3A), centre pill "Hotel Deodar View · Mussoorie",
  right "Apr to Sep 2026".
- **KPI row**: 4 columns separated by thin vertical hairlines; small grey label above, large number (about
  22 px, regular/medium weight) below:
  - "List revenue" / "₹63,05,000"
  - "Net kept" / "₹47,33,011"
  - "Paid to channels" / "−₹10,39,108" (red #E04A3C)
  - "Direct share" / "16.7%"
- Row: heading "Bookings are not money." (about 20 px, semibold) left; right a segmented control (pill
  track light grey #E8E8E8): "By bookings" (selected: black #111 pill, white text) | "By money kept" (dark
  text on grey).
- **Ranked list** (each row a light grey #EDEDED rounded rectangle, radius about 10 px, about 36 px tall,
  4 px gap): rank number (grey) | channel name (black) | horizontal bar (pine #1E7A46 fill on light grey
  track, thin about 3 px) | right-aligned amount (bold) over small grey caption "list revenue".
  1. "MakeMyTrip" ... "₹26,04,000" / "list revenue" (bar about 65%)
  2. "Booking.com" ... "₹13,64,000" (bar about 70%)
  3. "Direct" ... "₹6,88,000" (bar full)
  4. "Travel agents" ... "₹6,8[?]" (partly hidden by thumbnail; matches ₹6,84,000 on page 33)
  5. "Agoda" ... "₹5,6[?]" (₹5,60,000 per page 33) (bar about 65%)
  Note: bar widths here appear to show kept share rather than revenue rank. A soft green glow sits behind the
  centre of the list.
- Motion: the toggle animates a reorder ("animated reorder from the prototype").

## page-04: Marketing website, count-up metrics (bug state)

- Caption: "Fig 3. Count-up metrics (bug: shows ₹0 before scroll; fix per MATCH_THIS) · screenshots/06-website-metrics.png"
- State: public website, metrics section, light, desktop. Shows the **wrong** initial state: all numbers at
  zero before the count-up animation fires. The rebuild must show real values (₹10,39,108, 16.5%, ₹41,800,
  +₹10,110) or count up correctly.
- Same nav. 4 equal columns, each with a thin top rule (hairline over each column):
  - "₹0" (large about 36 px) / "Paid to channels" (16 px, black) / "Commission, GST on commission and fees" (grey 12 px)
  - "0.0%" / "Of list revenue" / "Lost to channel cost"
  - "₹0" / "Commission paid twice" / "12 guests who came back through an OTA"
  - "+₹0" / "Extra per Saturday" / "Hold 6 rooms off Agoda if they sell direct"
- Footnote: "Calculated from sample statements for Hotel Deodar View. All data is fictional." (grey, small).
- Below: a full-width hairline, large green blurred glow (cursor-following glow, likely), and at bottom right
  the top of the next card "List ADR vs net ADR" / "per room night" (see page-05).

## page-05: Marketing website, List ADR vs net ADR explainer

- Caption: "Fig 4. List vs net ADR explainer · screenshots/07-website-adr.png"
- State: public website, "The flip" section, light, desktop.
- Two columns. A blurred grey bar sits above the left column (a ghosted element mid-animation, about 300 px
  wide pill, ignore/transition).
- **Left column**: eyebrow "THE FLIP" (small caps grey, letterspaced); H2 "Your biggest channel can pay you
  the least." (about 30 px bold, 2 lines); body "List ADR is what the guest paid. Net ADR is what reached your
  bank after hotel-funded discount, commission, GST on commission and payment fees." (grey 13 px); two stat
  numbers side by side: "₹1,566" over "List RevPAR", "₹1,176" over "Net RevPAR" (numbers about 28 px bold
  black, captions small grey).
- **Right card** (light grey #F4F4F4 card, radius about 16 px, thin border): title "List ADR vs net ADR"
  (semibold), right "per room night" (grey small). Rows: channel name left, right "₹list" in grey then
  "₹net" in bold green, beneath a thin double bar (green fill = net share, grey extension = gap to list):
  - "Walk-in" ₹4,500 **₹4,500** (bar almost full green)
  - "Direct" ₹4,300 **₹4,283**
  - "Travel agents" ₹3,800 **₹3,420**
  - "Booking.com" ₹4,400 **₹3,119**
  - "MakeMyTrip" ₹4,200 **₹2,737**
  - "Agoda" ₹4,000 **₹2,598**
  - Footer: "Blue is kept. Grey is the gap lost to channels." (note: copy says Blue but the bar is green;
    copy/colour mismatch to fix).
- Green glow blob behind the card's lower left.

## page-06: Marketing website, footer

- Caption: "Fig 5. Footer columns and badge row · screenshots/08-website-footer.png"
- State: public website, footer, light, desktop.
- Same nav at top. Footer on white with green glow blob in the centre.
- Row 1 (4 columns: brand column about 40% width, then 3 link columns):
  - "Seedha" (bold) / "The revenue desk for owner-run hotels and homestays." (grey)
  - "Product": "The flip", "Growth", "Pulse", "Seedha Desk"
  - "Account": "Sign in", "Create account", "Demo hotel", "Pricing"
  - "Company": "Careers", "Guest map", "Pitch deck", "Design system"
- Row 2 (columns aligned to a 4-col grid starting at left):
  - "Seedha Site": "Sample hotel site", "Rate card", "Agent deck", "Desk and guest"
  - "Support": "Questions", "WhatsApp us"
  - "Legal": "Privacy" (hovered: darker), "Terms", "Cookies", "Security", "Security review"
- Column headings 13 px semibold black; links 12 to 13 px grey #6E6E73, about 20 px line spacing.
- Hairline, then **badge row** (plain grey text items spaced out): "Two-step sign-in", "Encrypted in transit
  and at rest", "PCI DSS payment gateway", "Guest consent logged", "No OTA scraping".
- Hairline, then bottom bar: left "© 2026 Seedha. All sample data is fictional."; right links "Privacy",
  "Terms", "Security", "Cookie settings", "India · English".

## page-07: Auth, Sign in and Sign up

- Section heading (PDF): "Sign in and onboarding".
- **Fig 6. "Sign in with Direct beta login · screenshots/01-auth.png"**
  - State: auth, sign in, light, desktop (centred card).
  - Background: very light grey #F3F4F3 with large soft blurred grey-green radial glows (top left darker
    grey-green, bottom right pale mint).
  - Top left of card column: "‹ Back to website" (pine green, small, wraps to two lines: layout defect).
  - Centred logo: green rounded-square app icon (about 28 px, gradient #2FA45E to #1E7A46, with a white
    "=" / two-line glyph) + wordmark "Seedha" (bold, about 22 px, black).
  - Card: white, radius about 24 px, soft shadow, width about 360 px, padding about 24 px.
    - H1 "Sign in" (about 26 px bold).
    - Body "We send a one-time code to your WhatsApp. No password to remember or leak." (grey 14 px).
    - **Beta banner button**: dark gradient (deep teal-navy #0F2A3A to dark green #0E3B2A), radius about 14 px,
      strong shadow. Left: green rounded square with white "β". Title "Direct beta login" (white, semibold) +
      small pill chip "Beta" (white text on translucent grey). Sub "One tap into Hotel Deodar View. No code
      needed." (light grey). Right chevron "›".
    - Label "Mobile number" (13 px semibold). Input: rounded (radius about 12 px), light border; prefix "+91"
      then vertical divider then placeholder "10-digit number".
    - Below (cut off): top of a green checkbox (ticked, pine).
- **Fig 7. "Sign up · screenshots/02-auth.png"**
  - Same frame, back link, logo.
  - H1 "Create your account"; sub "Three details. Setup takes under 3 minutes."
  - Fields (label semibold above rounded input with placeholder): "Your name" / "Full name"; "Hotel name" /
    "Hotel or homestay"; "WhatsApp number" / "10-digit number" (cut off).

## page-08: Auth, WhatsApp OTP and onboarding step 1

- **Fig 8. "WhatsApp code (OTP) · screenshots/03-auth.png"**
  - Same frame. H1 "Enter the code"; sub "Sent on WhatsApp to +91 ." (number empty in capture: bug, should
    show the entered number).
  - Label "6-digit code"; wide input with six grey dots centred "• • • • • •" (letterspaced placeholder).
  - Helper row: left "Code expires in 4:59" (countdown, wraps), right "5 of 5 tries left" (grey, wraps).
  - Full-width pill button "Verify and continue" (pine #1E6B4E, white semibold text, about 44 px tall).
  - Link row: left "Change number", right "Resend code" (pine green semibold, each wrapping onto 2 lines:
    layout defect).
- **Fig 9. "Onboarding step 1 of 4 · screenshots/04-auth.png"**
  - Capture actually shows the Sign in card again (identical to Fig 6: "Sign in", Direct beta login,
    "Mobile number", "+91", "10-digit number"). The onboarding step itself was not captured; caption and
    image disagree.

## page-09: Owner app, Overview (approved "save 1" design, top)

- Section heading (PDF): "Owner app". Caption: "Fig 10. Overview (approved "save 1") · screenshots/02-owner-overview.png"
- State: owner app, Overview, light, desktop, sidebar layout. **This is the approved layout.**
- **Top bar** (white/translucent glass, about 48 px): macOS traffic lights; circular back button "‹" (light
  grey circle); logo tile (black rounded square with white "=" glyph) + "Seedha" (bold); property pill
  (light grey) with green dot "Hotel Deodar View"; **segmented control** "Owner" (selected, white pill) |
  "Front desk" | "Guest" on a grey track; search field (white, rounded) with magnifier icon "Search Seedha"
  and key hint chip "⌘K"; bell icon with red badge "3"; black circular avatar "RJ".
- **Left sidebar** (about 240 px, transparent on grey background). Items: icon in a small rounded square tile
  (grey #E9E9EB, 24 px) + label 14 px. Active item has white rounded row background and pine filled icon tile.
  Order:
  1. "Overview" (active)
  2. "My Place"
  3. "Guest inbox"
  4. "Assistant" (sparkle icon)
  5. "Upload" (up arrow)
  6. "Money kept" (up/down arrows)
  7. "Repeat guests" (circular arrow)
  8. "Saturday move" (half-filled circle)
  9. "Approvals" (check) with red count badge "1" on the right
  10. "Savings" (₹)
  11. "Ask on WhatsApp"
  12. "Calendar" (grid)
  13. "Website" (globe-ish)
  14. "Consent proof" (diamond/seal)
  15. "Pro" (star) with grey chip "Pro" on the right
  16. "Billing" (card)
  17. "Settings" (gear)
  Footer: dashed-border box "Open Seedha Desk ↗" (pine text). (Items 15 to 17 and footer seen on page-10.)
- **Main column** (about 700 px):
  - Small grey date "Saturday, 3 October 2026"; H1 "Namaste, Rajesh ji." (about 34 px bold, tight).
    Right: pill button "See the flip" (pine, white text).
  - **Insight banner**: full-width, black/graphite #1C1C1E, radius about 16 px; white sparkle icon "✦"; text
    (white, 15 px, Hinglish): "MakeMyTrip ne sabse zyada bookings di, par har room par sabse kam paisa
    chhoda." Right: pill button "Show in English" (dark grey #3A3A3C, white text).
  - **KPI grid** 3 columns x 2 rows, white cards radius about 16 px, gap about 8 px; label grey 12 px, value
    about 24 px bold, sub grey 12 px:
    - "Net kept" / "+₹47,33,011" (green #1F8A4C) / "of ₹63,05,000 list revenue"
    - "Net ADR" / "₹3,155" / "List ADR ₹4,203"
    - "Net RevPAR" / "₹1,176" / "List RevPAR ₹1,566"
    - "Paid to channels" / "−₹10,39,108" (red) / "16.5% of list revenue"
    - "Direct share" / "16.7%" / "Direct and walk-in room nights"
    - "Saved with codes" / "₹12,600" / "4 coded direct bookings" — this card is **gold #E8A33D fill** with
      dark text.
  - Footnote: "Calculated from your statements · Apr to Sep 2026 · 183 days · 4,026 available room nights".
  - **Checklist card** (white): title "Set up the direct loop", right "5 of 8 done" (grey); progress bar (pine
    fill about 62%, light grey track, 4 px, rounded); 2-column grid of steps each with a green filled circle
    check, label and chevron "›": "Upload statements", "AI reads every row" (rest below fold).

## page-10: Owner app, Overview lower half, and current build Overview

- **Fig 11. "Overview: last night rooms and Needs you · screenshots/03-owner-rooms-needs-you.png"** (approved
  sidebar design, scrolled down)
  - Sidebar visible from "Money kept" down: "Money kept", "Repeat guests", "Saturday move", "Approvals" (badge
    "1"), "Savings", "Ask on WhatsApp", "Calendar", "Website", "Consent proof", "Pro" (chip "Pro"), "Billing",
    "Settings"; footer dashed box "Open Seedha Desk ↗".
  - **Last night rooms grid** card (top cut off): room tiles about 52 x 52 px, radius about 8 px, 10 per row.
    Each tile: room number (bold, top-left) and channel code (small, bottom-left). Colours by channel:
    MakeMyTrip = black #1C1C1E "MMT"; Booking.com = dark grey #4A4A4C "BDC"; Agoda = mid grey #8E8E93 "AGO";
    Agent = light grey #AEAEB2 "AGT"; Walk-in = lighter grey #D1D1D6 "WLK"; Direct = pine #1E6B4E "DIR"; Empty =
    very light grey #EDEDED with grey "Empty". Visible top row codes: MMT, MMT, MMT, BDC, MMT, DIR, WLK, AGT,
    MMT, BDC. Next row: "111 DIR", "201 MMT", "202 AGO", "203 DIR", "204 Empty", "205 Empty", "206 Empty",
    "207 Empty", "208 Empty", "209 Empty"; last row "210 Empty", "211 Empty".
  - Legend (small dots + labels): "MakeMyTrip", "Booking.com", "Agoda", "Agent", "Walk-in", "Direct".
  - **"Needs you" card** (white): title "Needs you"; list rows separated by hairlines; each row: grey rounded
    icon tile (36 px), bold title, grey sub, chevron "›" right:
    - (check, light green tile) "Approve Neha Gupta’s thank-you" / "Consent 7:42 PM at Desk"
    - (refresh) "Confirm 1 repeat-guest match" / "A. Verma family · 74% sure"
    - (half circle) "Saturday move: +₹10,110" / "Hold 6 rooms off Agoda"
    - (grid) "Diwali weekend, 7 to 8 Nov" / "One channel decision ready"
- **Fig 12. "Overview (current build) · screenshots/03-owner-b.png"** (older/current build, top tabs instead
  of sidebar)
  - Top bar: traffic lights, back circle "‹", logo + "Seedha", pill with green dot "Hotel Deodar View · 22
    rooms"; right bell with badge "3", avatar "RJ". No Owner/Front desk/Guest switch, no search.
  - **Horizontal nav pills** (scrolling row): each pill grey #E9E9EB with small icon tile + label: "Overview"
    (active: white pill, pine-ringed icon), "My Place", "Guest inbox", "Assistant", "Upload", "Money kept",
    "Repeat g[uests]" (cut off).
  - Same header: "Saturday, 3 October 2026" / "Namaste, Rajesh ji." / "See the flip" (pine pill).
  - Same black insight banner and "Show in English".
  - KPI row of 4 cards: "Net kept" "+₹47,33,011" "of ₹63,05,000 list revenue"; "Net ADR" "₹3,155" "List ADR
    ₹4,203"; "Net RevPAR" "₹1,176" "List RevPAR ₹1,566"; "Paid to channels" "−₹10,39,108" "16.5% of list
    revenue". Next row starts "Direct share", gold "Saved with codes".
  - **Toast** (bottom centre, black pill, white text, radius full): "MakeMyTrip drops from 1st to 5th" (text
    wraps: layout defect).

## page-11: Owner app (current build), Upload and Money kept by bookings

- **Fig 13. "Upload · screenshots/07-owner.png"**
  - Top bar + tab pills as page-10 Fig 12, "Upload" active (pine icon tile, white pill).
  - H1 "Bring your statements." (about 34 px bold). Sub: "MakeMyTrip, Booking.com and Agoda payouts with your
    hotel register. Seedha checks that every row adds up." (grey 15 px).
  - White card: title "6 files read" (semibold). File rows separated by hairlines: grey file-type chip ("PDF",
    "XLSX"), channel name (semibold) over period (grey small), right count in pine green, then a full-width
    progress bar (pine, complete) under each row:
    - "PDF" "MakeMyTrip" "Apr to Jun 2026" "410 rows"
    - "PDF" "MakeMyTrip" "Jul to Sep 2026" "412 rows"
    - "XLSX" "Booking.com" ... "214 rows" (cut off)
- **Fig 14. "Money kept, By bookings · screenshots/01-owner.png"**
  - "Money kept" tab active.
  - H1 "Bookings are not money." Sub (black, 16 px): "MakeMyTrip ne sabse zyada bookings di, par har room par
    sabse kam paisa chhoda." Right: pine text link "Show in English" (wraps).
  - Segmented control (grey track, about 280 px): "By bookings" (selected, white raised) | "By money kept".
    Right grey caption "Apr to Sep 2026 · 1,500 room nights".
  - Channel cards (white, radius about 14 px, stacked with 8 px gap): rank number (grey, large) | small channel
    colour square + channel name (semibold) | red sub "−₹… paid away" | right amount bold about 20 px over grey
    "list revenue"; full-width split bar at bottom: green #34C26A (kept) then salmon #E57F73 (paid away).
    - 1 "MakeMyTrip" "−₹9,07,358 paid away" "₹26,04,000" "list revenue" (green about 66%)
    - 2 "Booking.com" "−₹3,97,142 paid away" "₹13,64,000" "list revenue" (green about 71%)

## page-12: Owner app (current build), Money kept by money kept, and Repeat guests

- **Fig 15. "Money kept, By money kept (after the flip) · screenshots/02-owner-b.png"**
  - Same header as Fig 14; segmented control now "By money kept" selected.
  - Rows now sorted by net ADR, amount caption "net ADR":
    - 1 (light grey square) "Walk-in" "₹0 paid away" (grey) "₹4,500" "net ADR" (full green bar)
    - 2 (pine square) "Direct" "−₹2,752 paid away" (red) "₹4,283" "net ADR"
  - Toast (black pill bottom centre): "MakeMyTrip drops from 1st to 5th" (wraps; overlaps card).
  - Motion: rows animate reorder when toggled; toast announces the flip.
- **Fig 16. "Repeat guests · screenshots/02-owner.png"**
  - "Repeat g[uests]" tab active (pine icon).
  - H1 "Guests you paid for twice." Sub "They came back through an OTA. You had already won them."
  - Two stat cards side by side: left **black** card "12" (white, about 36 px bold) / "repeat guests via OTA"
    (grey); right white card "−₹41,800" (red, about 36 px bold) / "commission paid twice" (grey).
  - Guest list card: row "Rahul S., Delhi" (bold) / "MakeMyTrip, May 2025 → MakeMyTrip, May 2026" (grey);
    chips: "Same guest? 92% sure" (light green bg #E3F5E9, green text) and "Not new demand" (grey bg, black
    text). Right: red "−" and "₹3,480" with a green word overlapping it (looks like "Matched"; overlap bug).
    Chip text wraps (layout defect).

## page-13: Owner app (current build), Saturday move and Approvals

- **Fig 17. "Saturday move · screenshots/03-owner.png"**
  - No tab is highlighted in the visible pill row (Saturday move is further right, off-screen).
  - H1 "One move for Saturday." (captured mid fade-in: greyed).
  - Large white card: text (semibold 18 px): "Hold 6 Saturday rooms off Agoda. Keep them for direct and
    walk-in guests. Expected extra kept: ₹10,110 per Saturday if they sell direct."
  - Chart area (before/after bar comparison, mostly empty in capture): label "After · 6 rooms direct" (centre,
    grey small) and "Before · 6 rooms on Agoda" (left, grey small); a grey bar (#D9D9D9, radius 6 px) at bottom
    left (Before); at bottom right a light green card #E6F4EA "Extra kept per Saturday" (value cut off).
  - Motion: bars animate in (captured early).
- **Fig 18. "Approvals · screenshots/04-owner.png"**
  - H1 "Messages waiting for you." Sub "Seedha drafts a thank-you with a perk for guests who said yes at the
    Desk. Nothing is sent until you approve."
  - Draft card (white): name "Neha Gupta" (bold); chips right: "✓ Consent 7:42 PM at Desk, 14 Jun 2026"
    (light green bg, green text; wraps) and "● Pending proof" (grey chip, grey dot).
  - Grey inner row: "Consent proof is written in tonight’s bundle at 9 PM." + right pine text button "Write
    tonight’s bundle".
  - Meta row (grey small): "English" · "Perk: Free breakfast" · "Code DEODAR-NG26" (wrapping in narrow columns).
  - Message preview bubble (light grey #F0F0F2, radius about 14 px): "Namaste Neha ji, thank you for staying at
    Deodar View. Book your next stay directly with us and breakfast is on us. Code DEODAR-NG26. Reply STOP to
    opt out."
  - (Approve / Reject buttons below the fold, not visible.)

## page-14: Owner app (current build), Savings and Ask on WhatsApp

- **Fig 19. "Savings and Season in review · screenshots/05-owner.png"**
  - H1 "Saved by booking direct."
  - **Gold hero card** (#E8A33D fill, radius about 20 px, full width): label "Commission avoided this season"
    (dark, 14 px semibold); value "₹12,600" (about 64 px bold, near black); sub "4 coded direct bookings ·
    Calculated from your statements".
  - Line below: "Counted only when a perk code is used. **No code, no saving claimed.**" (second sentence bold).
  - Next white card starts (cut off; first row reads like "Kapoor family, Delhi").
- **Fig 20. "Ask on WhatsApp · screenshots/06-owner.png"**
  - H1 "Ask on WhatsApp." Sub "Six questions. Exact answers from your statements."
  - **WhatsApp-style chat mock** (card about 520 px wide, radius about 16 px, shadow): header black #1C1C1E
    with white circle avatar "S", "Seedha" (white semibold) and "Business account" (grey, wraps/clipped).
    Body light grey #F0F0F2. Incoming white bubble: "Suprabhat Rajesh ji. Kal 14 room bike, aapke paas ₹47,900
    bache." Under bubble: "From your statements" (grey small).
  - (Six question chips are below the fold.)

## page-15: Owner app (current build), Assistant and Season calendar

- **Fig 21. "Assistant · screenshots/01-owner-b.png"**
  - "Assistant" tab active (pine sparkle icon tile).
  - H1 "Seedha Assistant." Sub "Ask about any number on your dashboard. Answers use only figures calculated
    from your statements."
  - Chat card (white, radius about 16 px): context chip row "Reading:" then grey pill chips "Overview",
    "Money kept", "Repeat guests", "Savings", "Payouts", "Billing" (some chip labels wrap: defect). Hairline.
  - Assistant message: black circle avatar "S" + grey bubble (#F0F0F2): "Namaste Rajesh ji. I have read your
    overview, channels, repeat guests, savings and billing. What would you like to know?"
- **Fig 22. "Calendar (Pulse) · screenshots/12-owner.png"**
  - H1 "Season calendar." Sub "Each date becomes one channel decision. Seedha Pulse does not predict demand."
  - Two columns. **Left: month calendar card** (white): circular grey prev "‹" / next "›" buttons, title
    "December 2026" (semibold); weekday header "Mon Tue Wed Thu Fri Sat Sun" (grey small); date grid (1 to 6 on
    first row starting Tue; 7 to 13; 14 to 20; …), numbers regular 14 px, wide spacing; bottom row cells show
    grey rounded highlight pills (event dates, partially visible).
  - **Right: event cards** (white): first: grey dot + "25 to 30 Dec" (grey, wraps), right tag "Town event"
    (grey); title "Winter Line Carnival" (bold); "**Channel decision**: Stop OTA discounts for these dates and
    keep 6 rooms for direct guests."; pine pill button "Add to plan". Second card: black dot "31 Dec", right
    "Long weekend" (rest cut off).

## page-16: Owner app (current build), Consent proof and Pro

- **Fig 23. "Consent proof · screenshots/08-owner.png"** (captured mid fade-in: everything greyed)
  - H1 "Consent proof." Sub "Every night at 9 PM, Seedha seals the day's Desk consents into one bundle. Anyone
    can later check a consent was given and not changed. No guest names or numbers leave Seedha."
  - 4 stat cards: "148" / "consents sealed"; "3" / "bundles shown"; "0" / "guest names stored outside Seedha";
    "1" / "record to check".
  - Bundle row card: "Tonight, 3 Oct 2026, 9:00 PM" (bold; "PM" overlaps next line), sub "Fingerprint Not
    sealed yet" (overlapped by "PM": defect); right grey chip "Opens at 9 PM".
- **Fig 24. "Pro · screenshots/09-owner.png"**
  - H1 "Seedha Pro." Sub "For owners who want Seedha to find more money. Coming soon."
  - 3 dark cards (graphite #1C1C1E, radius about 16 px, white text) each with a small "Pro" chip top right
    (grey translucent pill):
    - "Seedha Audit" / "₹18,640 to claim back" (about 22 px bold) / "Commission on 2 cancelled stays and a
      higher rate than your contract on 14 rows." (grey)
    - "Seedha Pulse" / "Winter Line Carnival" / "25 to 30 Dec. Stop OTA discounts for these dates and keep 6
      rooms for direct guests."
    - "Rate Watch" / "Agoda ₹3,950 vs direct ₹4,300" / "From your screenshot today. No scraping."
  - A second row of white cards begins below (cut off).

## page-17: Owner app (current build), Billing and Settings

- **Fig 25. "Billing · screenshots/10-owner.png"**
  - H1 "Billing."
  - Two cards: left **black** card: "Current plan" (grey small) / "Seedha Base" (white 22 px bold) / "₹1,499 a
    month · up to 25 rooms" (grey) / buttons: white pill "Pay ₹1,499 now" (black text) and outlined dark pill
    "Change plan" (white text, thin grey border; wraps). Right white card: "Next charge" / "3 Nov 2026" (22 px
    bold) / "₹1,499 via UPI AutoPay" / "Prices are early estimates. GST invoice sent on WhatsApp after each
    payment." (grey small).
  - Section "Payment methods" (semibold) with right pine link "Add method" (wraps).
- **Fig 26. "Settings · screenshots/11-owner.png"**
  - H1 "Settings."
  - Horizontal scrolling tab chips (white pills; active = black pill with white text) with a visible grey
    scrollbar beneath: "Personal details", "Hotel" (active), "Plan and billing", "Contracts", "Staff logins",
    "Notifications", "Security", "Pri[vacy]" (cut).
  - Settings card (white): rows separated by hairlines, label bold + grey sub left, value right:
    - "Property" / "Hotel Deodar View, Mall Road" → "Mussoorie"
    - "Rooms" / "Used for occupancy and RevPAR" → "22"
    - "Owner WhatsApp" / "8 AM line and 9 PM close" → "+91 98•••" (masked, wraps)

## page-18: Guest inbox (three-column)

- Section heading (PDF): "Guest inbox". Caption: "Fig 27. Three-column inbox: list, thread, guest profile · screenshots/inbox.png"
- State: owner app, Guest inbox, light, desktop, a narrow-icon-rail variant.
- Frame: white app card radius about 20 px on grey background.
- **Icon rail** (about 50 px): top black rounded square "S"; icons: target/overview, inbox (active, light green
  tile, red badge "1"), home, grid/calendar, gear.
- **List column** (about 220 px): title "Guests" (bold 20 px), right "Median reply 4 min" (grey small); search
  field (grey fill, radius 10 px) "Search"; filter chips: "All 5" (selected, black pill white text), "Unread 1",
  "Auto-replied 2" (grey pills; row scrolls). Section label "CONSENTED AT DESK" (caps, grey, letterspaced).
  Conversation rows (avatar 36 px circle with initials + presence dot):
  - "NG" (pine avatar, green dot) "Neha Gupta" "9:12 PM" / "Bot: Namaste Neha ji. Rajes…" / grey chip
    "Auto-replied". Selected row: light grey-green bg #EEF2EF, radius 12 px.
  - "KF" (black avatar, grey dot) "Kapoor fam…" "6:52 PM" / "You: So glad to hear that. S…"
  - "SB" (dark grey avatar, green dot) "S. Bisht" "11:21 AM" / "You: Yes, two covered spot…"
  - "Arjun Mehta" "4:05 PM" (cut off).
  - Horizontal scrollbar; footer note "Guests found through OTA statements never appear here." (grey).
- **Thread column**: header avatar "NG" (pine) + "Neha Gupta" (bold) / "Gurugram · Returning guest · 2 stays";
  right status pill "● Away · bot on" (cream #FFF6E5 bg, amber dot #F0A030, dark text) and circular "ⓘ" info
  button (grey).
  - Body light grey #F2F2F4. Date divider "14 Jun". Outgoing bubble (pine #1E6B4E, white text, radius about
    16 px, right aligned): "Namaste Neha ji, thank you for staying at Deodar View. Book your next stay directly
    with us and breakfast is on us. Code DEODAR-NG26. Reply STOP to opt out." time "10:02 AM".
  - Divider "Today". Incoming bubble (light grey #E9E9EB): "Hi! Planning Diwali weekend with the kids. Is a
    valley view room free on 7 and 8 Nov?" (cut off).
  - Suggestions row: "✦ Suggested" then outlined pale-green chips "Yes, a valley view Deluxe is free on 7…",
    "Breakfast is on us with yo[ur code]…" (row scrolls).
  - Composer: circular grey "₹" button (insert price), rounded input "Write a message", pine circular send
    button with white "↑".
  - Footer: "Prices from your rate card, never AI · offers include Reply ST[OP]…" (grey small) and right pine
    link "Simulate guest".
  - (The third, guest-profile column is collapsed / behind the ⓘ button in this capture.)

## page-19: Front desk and guest, Desk connected banner (approved)

- Section heading (PDF): "Front desk and guest". Caption: "Fig 28. Desk connected banner (approved) · screenshots/01-desk-connected.png"
- State: Front desk and guest page, light, desktop, approved variant (inside design-tool chrome).
- Top bar (white): circular back "‹", "Seedha" (semibold); right segmented control "Owner" (underlined text,
  unselected) | "Front desk and guest" (selected white pill).
- H1 "One scan at check-in. One slip at checkout." (about 34 px bold, tight).
- **Connection banner** (white card, radius about 12 px, about 420 px wide): green dot + "Your Desk is connected
  · Reception, Hotel Deodar View" + right grey pill button "Test print".
- Body (grey): "Run the full loop: show the QR, tick consent on the guest phone, print the checkout slip, then
  book direct on Seedha Link."
- **Desk device mock** (top half): cream/beige bezel #EFE9DF, radius about 20 px, soft shadow; a light LED
  strip (white/grey, about 90 px wide) on top edge (the ring); inner pine-green frame #1F4D3A; black screen
  with "Seedha" (white bold) and "Deodar View · Ready" (grey small).

## page-20: Front desk, D1 Idle and D2 QR + G1 consent

- **Fig 29. "D1 Idle · screenshots/01-desk.png"** and **Fig 30. "D2 QR and G1 consent · screenshots/02-desk.png"**
- Both captures look the same in the visible portion (top of page): back "‹", "Seedha", segmented "Owner" |
  "Front desk and guest" (selected white pill on grey track); H1 "One scan at check-in. One slip at checkout.";
  banner "● Your Desk is connected · Reception, Hotel Deodar View" (wraps to 2 lines: "View") with "Test print"
  grey pill; body "Run the full loop: show the QR, tick consent on the guest phone, print the checkout slip,
  then book direct on Seedha Link."; top of desk device: beige bezel, LED strip (white/off), pine inner frame,
  black screen (content below fold).
- The distinct states (QR screen, guest phone consent with unticked checkbox) are below the crop and not
  visible. Ring LED is white/neutral in both.

## page-21: Front desk, D3 Consent saved and D4 Printing slip

- **Fig 31. "D3 Consent saved, ring green · screenshots/03-desk.png"**
  - Same header and banner as page-20. **LED ring strip is bright green #34C759** (state change). Toast (dark
    graphite pill, white text) overlapping the device: "Consent saved at 7:42 PM" (wraps).
- **Fig 32. "D4 Printing checkout slip · screenshots/04-desk.png"**
  - Same page; LED strip back to white/neutral. Printing content below fold, not visible.

## page-22: Seedha Link (guest booking) and Seedha Site empty state

- **Fig 33. "Seedha Link and slips · screenshots/05-desk.png"**
  - Bottom of a **phone mock** (black thick bezel about 10 px, radius about 40 px, centred, large soft shadow).
    Screen white:
    - Top (cut): grey box with "breakfast included" (bold).
    - Label "Perk code" (semibold); input (rounded, light border) value "DEODAR-NG26" (letterspaced).
    - Success line (green, small): "✓ Free breakfast added for Neha ji".
    - Row: "Total · 2 nights" (left; "nights" wraps and overlaps the next line: defect) and "₹8,600" (bold right).
    - Grey note: "Free breakfast with your code. Same price as everywhere else."
    - Full-width pine pill button "Pay with UPI" (white semibold).
  - Footnote on page background: "Desk screen 480 × 320 px. Slips are 58 mm thermal, black only. QR is illustrative."
- Section heading (PDF): "Seedha Site (owner)".
- **Fig 34. "Empty state · screenshots/01-site.png"**
  - Header block: "‹ Back" (pine), eyebrow "Seedha Site · sample data" (grey small, wraps), H1 "Website" (bold
    about 30 px). Right: segmented control "Site" (selected white) | "Packages" | "Google kit" on grey track.
  - Big white card (radius about 24 px), centred content: pale green rounded-square icon tile (#E3F1EA) with a
    pine house outline icon; H2 "Your hotel, online in 10 minutes." (about 34 px bold); body "No website? Send a
    few photos and we build one with direct booking." (grey, centred); pine pill button "Start on WhatsApp"
    (wraps to 2 lines: defect).

## page-23: Seedha Site, WhatsApp setup (step 2 and complete)

- **Fig 35. "WhatsApp setup: photos and voice note · screenshots/02-site.png"**
  - Same "‹ Back" / "Seedha Site · sample data" / "Website" header and Site|Packages|Google kit segmented
    control (Site selected).
  - Left column: H2 "Setup on WhatsApp"; sub "Five questions, one at a time. About 5 minutes."; stepper list
    with hairlines between rows:
    1. green filled check circle (#34C759) "Photos"
    2. pine filled circle with "2" + bold "Hindi voice note" (current)
    3. grey circle "3" "Rooms and prices" (wraps)
    4. grey circle "4" "Nearby places" (wraps)
    5. grey circle "5" "Contact and…" (cut)
  - Right: **phone mock** (black bezel, radius about 40 px) showing a WhatsApp chat: header avatar black "S",
    "Seedha" / "Step 2 of 5", right progress dots "●●○○○" (2 filled). Chat bg beige #EFEAE2. Incoming white
    bubble: "Namaste Rajesh ji. Let us build your website. 1 of 5: please send 8 to 10 photos of rooms, view,
    food and the building." Outgoing pale green bubble (#DCF8C6) containing a 4+2 grid of photo thumbnails
    (soft gradient placeholders: blue-green, taupe, sand, grey, green, rose) and "6 of 8 photos" (grey small).
- **Fig 36. "Setup complete, building · screenshots/03-site.png"**
  - Same layout; all 5 steps show green check circles ("Photos", "Hindi voice note", "Rooms and prices",
    "Nearby places", "Contact and…"); labels wrap. Phone header "Step 5 of 5", dots "●●●●●" all filled.
    Same chat content visible.

## page-24: Seedha Site, Review before publish and Published

- **Fig 37. "Review before publish (previews are live iframes in the file) · screenshots/04-site.png"**
  - Header as before (Site selected).
  - H2 "Your hotel, online."; sub "Check it, then publish."
  - Right: two segmented controls: theme "● Pine" (selected white; dark green dot #1F4D3A) | "● Stone" (dark
    grey dot) | "● Sky" (blue dot #2F6FD6); language "English" (selected) | "हिंदी".
  - Notice bar (cream/beige #F3EBE0 bg, radius 12 px, black dot): "Not live yet. Only you can see this
    preview. Nothing goes online until you tap Publish site."
  - Previews: left phone mock (black bezel, blank white screen: iframe not captured), right browser mock
    (traffic lights, URL pill "deodarview.seedha.site", blank white body).
- **Fig 38. "Published: "Your site is live" · screenshots/05-site.png"**
  - Sub changes to "Live now. Change anything and publish again."
  - Success card (white): green check circle (#34C759) + "Your site is live" (semibold) / pine link
    "deodarview.seedha.site" + grey "(sample address)"; right buttons "Copy link" (grey pill; wraps) and "Share
    on WhatsApp" (pine pill, wraps).
  - Toast (graphite pill) over preview: "Your site is live" (wraps).
  - Same phone and browser previews.

## page-25: Seedha Site, Packages and Google kit

- **Fig 39. "Packages · screenshots/06-site.png"** (captured mid fade-in, content greyed)
  - Segmented: "Packages" selected.
  - H2 "Packages for your guests."; sub "Seedha suggests packages from your own bookings. You approve each one
    before it shows on your site."
  - Two package cards (white, radius about 16 px): top-left tag "◆ AI suggestion" (grey small, wraps), top-right
    grey chip "Needs your OK" (wraps); title; description; price (about 26 px bold); grey reason box; pine
    button (cut off at bottom) plus a secondary button.
    - "Weekend in the clouds" / "2 nights, breakfast, bonfire" / "₹9,400" / "**Reason:** Your weekends fill fastest."
    - "Char Dham stopover" / "1 night, early breakfast at 5 AM, parking" / "₹4,300" / "**Reason:** Yatra guests
      stay one night on the way."
- **Fig 40. "Google kit · screenshots/07-site.png"**
  - Segmented: "Google kit" selected.
  - H2 "Get found on Google."; sub "Everything ready to paste into your Google Business Profile. Seedha never
    asks for your Google password."
  - Two-column card grid:
    - Left card: "English description" (semibold, wraps) + grey pill button "Copy description" (wraps); text
      "Deodar View is a family-run 22-room hotel a short walk above Mall Road, Mussoorie. Valley-view rooms,
      homely breakfast, and direct booking with UPI."
    - Left card 2: "हिंदी विवरण" + "Copy description"; Hindi text (cut off).
    - Right card: "Best 5 photos, in this order" + pine pill "Download photos" (wraps); 5 square thumbnails
      (radius 8 px, gradient placeholders) captioned "1. View", "2. Deluxe room", "3. Breakfast", "4. Building",
      "5. Family suite".
    - Right card 2 starts "Four steps" (cut).

## page-26: Hotel site (World B), hero and rooms

- Section heading (PDF): "Hotel assets (World B)".
- **Fig 41. "Hotel site hero and booking bar · screenshots/01-hotel.png"**
  - State: public hotel website for Deodar View, English, desktop.
  - Top bar (warm off-white #F5F3EE): "‹" + "Deodar View" (serif, about 20 px); right language toggle pill "EN"
    (selected: black circle white text) | "हिं"; dark pine pill button "Book directly" (#24503A, white).
  - Full-bleed hero: vertical gradient placeholder photo (sky blue-grey #A7B8C8 at top, mist #C9D1D3, to deep
    forest green #2E4A33 at bottom). Top-right grey translucent chip "Sample photo".
    - Small text "Mall Road, Mussoorie" (white); H1 "Deodar View" (serif, white, about 56 px); sub "A quiet stay
      above Mall Road, with the valley at your window." (white humanist sans); white pill button "Book directly"
      (dark text, wraps: defect).
    - Booking bar (white rounded card overlapping hero bottom): fields "Check-in", "Nights", "Room" (labels
      grey small; values cut off).
- **Fig 42. "Why book direct and rooms · screenshots/02-hotel.png"**
  - Warm off-white #F5F4EF section; H2 "Rooms" (serif about 30 px).
  - 2-column room cards (radius about 14 px): image area gradient (left green #5B7A5A to #3F5E42; right taupe
    #8E7D6A to sage #A8B49A) with chip "Sample photo" bottom-left; white footer with serif title "Deluxe Valley
    View" / "Family Suite" (cut).

## page-27: Hotel site, packages and Hindi version

- **Fig 43. "Packages and gallery · screenshots/03-hotel.png"**
  - Room card (single, left column): image top (taupe gradient) with chip "Sample photo"; serif "Standard";
    grey "Cosy room · garden side"; price "₹3,400" (bold) + "a night" (small grey, wraps: defect); dark pine pill
    "Book" right.
  - H2 "Packages" (serif); 2 package cards (light warm grey #EDECE6, radius 14 px): serif titles "Weekend in the
    clouds" / "Char Dham stopover"; sans subs "2 nights, breakfast, bonfire" / "1 night, early breakfast at 5 AM,
    parking" (cut).
- **Fig 44. "Hindi version · screenshots/04-hotel.png"**
  - Same hero in Hindi: top bar "‹ देवदार व्यू"; toggle "EN" | "हिं" (selected, black); button "सीधे बुक करें"
    (pine). Chip "नमूना फोटो". Small "मॉल रोड, मसूरी"; H1 "देवदार व्यू" (Devanagari, white, large);
    sub "मॉल रोड के ऊपर एक शांत ठहराव, खिड़की से घाटी का नज़ारा।"; white pill "सीधे बुक करें"; booking bar labels
    "चेक-इन", "रातें", "कमरा".

## page-28: Rate card A4 and Agent deck cover

- **Fig 45. "Rate card A4 · screenshots/ratecard.png"**
  - A4 sheet on grey background, radius about 6 px, shadow.
  - Top photo strip in 3 panels (about 50% / 25% / 25%): mountain-view gradient captioned "Sample photo ·
    view"; taupe "Deluxe room"; golden "Breakfast" (white small captions bottom-left).
  - Body warm off-white #F5F4EF: serif H1 "Deodar View" (about 34 px); "Mall Road, Mussoorie, Uttarakhand · 22
    rooms" (sans); right aligned "Rate card 2026 to 27" / "Prices per night, in ₹" (wrapping); a dark green
    horizontal rule (#24503A) strikes through the "22 rooms" and "Prices per night" lines (overlap defect).
- **Fig 46. "Agent deck 1 Cover · screenshots/01-agentdeck.png"**
  - 16:9 slide on black presentation background (slide offset right, cut).
  - Full-bleed mountain gradient (blue-grey sky to forest green). Top-right chip "Sample photo · valley view".
    Small "Mall Road, Mussoorie"; serif H1 "Deodar View" (white, about 48 px); "A quiet 22-room stay above Mall
    Road. For travel agents, companies and wedding groups." (white sans).

## page-29: Agent deck slides 2 and 3

- **Fig 47. "2 Rooms · screenshots/02-agentdeck.png"**
  - Off-white slide. Serif H2 "Rooms". 3 room cards: gradient image tiles (radius 8 px: taupe, sage-green,
    pale stone), then name (sans semibold), sub (grey small), price bold + "a night":
    - "Deluxe Valley View" / "Breakfast included" / "₹4,300 a night"
    - "Family Suite" / "Two rooms, up to 4 guests" / "₹6,200 a night"
    - "Standard" / "Garden side" / "₹3,400 a night"
- **Fig 48. "3 Packages · screenshots/03-agentdeck.png"**
  - Dark pine slide #24503A. Serif H2 "Packages" (cream white). 3 cards (lighter green #31604A, radius 8 px):
    serif titles, small subs, price bottom (bold white):
    - "Weekend in the clouds" / "2 nights, breakfast, bonfire" / "₹9,400"
    - "Char Dham stopover" / "1 night, early breakfast at 5 AM, parking" / "₹4,300"
    - "Monsoon midweek" / "3 nights, breakfast, late checkout" / "₹11,900"

## page-30: Agent deck slides 4 and 5

- **Fig 49. "4 Groups and weddings · screenshots/04-agentdeck.png"**
  - Split slide: left half gradient image (peach #E9B58A to mauve #6E4A5E); right off-white: serif H2 "Groups and
    weddings"; key/value rows with hairlines: "Rooms" → "22"; "Meals" → "Veg and non-veg buffets"; "Quotes" →
    "WhatsApp +91 90000 00000" (values wrap and misalign: defect); footnote "Meal options and number are
    placeholders. Sample data."
- **Fig 50. "5 How to reach · screenshots/05-agentdeck.png"**
  - Off-white slide: left light grey map placeholder (radius 8 px) "Map · Mall Road, Mussoorie"; right serif
    H2 "How to reach"; rows: "Mall Road" → "5 min walk"; "Gun Hill" → "10 min"; "Lal Tibba" → "15 min drive";
    "Kempty Falls" → "30 min drive" (labels wrap: defect).

## page-31: Agent deck slide 6 and Pitch deck slide 1

- **Fig 51. "6 Book with us · screenshots/06-agentdeck.png"**
  - Graphite slide #222. Serif H1 "Book with us" (cream). Lines (white sans semibold): "WhatsApp or call +91
    90000 00000", "30% advance by UPI to deodarview@upi", "deodarview.seedha.site". Footer left small "Contact
    and UPI are placeholders. Sample data."; right "Made with Seedha".
- Section heading (PDF): "Pitch deck".
- **Fig 52. "Slide 1 · screenshots/01-pitch.png"**
  - Black slide with thin dark border. Eyebrow "ONE BOOKING ON MAKEMYTRIP" (grey caps, letterspaced). Two huge
    numbers (about 64 px bold): "₹4,000" (white) captioned "booked", "₹2,788" (mint green #4CC38A) captioned
    "kept". Footnote: "After a 15% hotel-funded discount and 18% commission, before GST on commission. Sample data."

## page-32: Pitch deck slides 2 and 3

- **Fig 53. "Slide 2 · screenshots/02-pitch.png"**
  - Light grey slide #F4F4F4. Eyebrow "Rajesh ji · 22 rooms · Mall Road, Mussoorie" (grey small). H1 (about 36 px,
    heavy, tight): "The family loved the stay. Next year they booked through MakeMyTrip again." Body (grey): "He
    never got a contact he was allowed to use. Bookings went up. The second commission stayed invisible."
- **Fig 54. "Slide 3 · screenshots/03-pitch.png"**
  - Light slide. H1 "Why tools miss small hill hotels". 3 columns each with top rule: "They count bookings" /
    "Gross revenue looks healthy. Net kept per room is never shown."; "Built for big hotels" / "An owner with 10
    to 40 rooms has no revenue manager and no time to learn."; "No way to win guests back" / "No consent at the
    desk means no direct contact next year."

## page-33: Pitch deck slides 4 and 5

- **Fig 55. "Slide 4 · screenshots/04-pitch.png"**
  - Black slide. Eyebrow "THE FLIP · LIVE DEMO"; H1 "Bookings are not money." (white).
  - Two ranked tables side by side, rows as dark grey #1A1A1A rounded boxes (radius 6 px), value bold right:
    - Left "By list revenue": "1 · MakeMyTrip ₹26,04,000" (highlighted with a lighter border), "2 · Booking.com
      ₹13,64,000", "3 · Direct ₹6,88,000", "4 · Travel agents ₹6,84,000", "5 · Agoda ₹5,60,000", "6 · Walk-in
      ₹4,05,000".
    - Right "By net ADR, money kept per room": "1 · Walk-in ₹4,500", "2 · Direct ₹4,283", "3 · Travel agents
      ₹3,420", "4 · Booking.com ₹3,119", "5 · MakeMyTrip ₹2,737" (highlighted border), "6 · Agoda ₹2,598".
    - Channel names wrap below the number in several rows (layout defect).
  - Footnote: "Calculated from sample statements, Apr to Sep 2026. Net = list revenue minus hotel-funded
    discount, commission, GST on commission and payment fees."
- **Fig 56. "Slide 5 · screenshots/05-pitch.png"**
  - Light slide, two columns: "Repeat guests" (grey small) / huge red "−" and "₹41,800" (red #D93B2E, about
    64 px) / "commission paid twice for 12 guests the hotel already won." / tiny "Internal report only. Seedha
    never messages these guests."; "Saturday move" / huge green "+" and "₹10,110" (green #1F8A4C) / "per
    Saturday if 6 rooms held off Agoda sell direct." / tiny "6 × (₹4,283 − ₹2,598). Calculated from sample
    statements."

## page-34: Pitch deck slides 6 and 7

- **Fig 57. "Slide 6 · screenshots/06-pitch.png"**
  - Black slide. Left: desk device mock (beige bezel, green LED strip on, pine inner frame, black screen) showing
    green check circle (#34C759) and "Thank you, Neha ji" (white bold). Right: H1 "One scan at check-in. One
    slip at checkout." (white heavy) + body "Guest ticks an unticked box, the ring turns green, the slip prints
    the bill and a perk code. Every message says how to stop." (grey).
- **Fig 58. "Slide 7 · screenshots/07-pitch.png"**
  - Light slide. H1 "Where AI works". 4 columns with top rule: "Reads" / "Any statement format. Flags rows that
    do not add up."; "Matches" / "Repeat guests, with a confidence the owner confirms."; "Explains" / "One plain
    Hindi or English line per screen."; "Drafts" / "Win-back messages the owner approves." Bottom line (bold):
    "Every rupee is plain arithmetic, never written by AI."

## page-35: Pitch deck slides 8 and 9

- **Fig 59. "Slide 8 · screenshots/08-pitch.png"**
  - Black slide. H1 "Built to stay on the right side". 3 columns (thin top rule): "Own data only" / "Statements
    the hotel uploads. No scraping. No OTA guest contacts for marketing."; "Consent first" / "Unticked box, STOP
    on every message. DPDP consent duties start May 2027."; "Perks, not undercutting" / "Breakfast for returning
    guests. The public rate stays the same everywhere."
- **Fig 60. "Slide 9 · screenshots/09-pitch.png"**
  - Light slide. H1 "Plans". 3 plan cards (radius 10 px): "Base" (white) "₹1,499" "a month, up to 25 rooms.
    Flip, repeat guests, Desk, win-back, Seedha Link, simple site."; "Pro" (**black card**, white text)
    "₹2,499" "Base plus Pulse, Audit, Rate Watch, full site, rate card and agent deck."; "Max" (white) "₹3,999"
    "Pro for two properties, one login, one WhatsApp." Below: "No website? We build one in 10 minutes." (bold)
    and "Prices are early estimates." (tiny grey).

## page-36: Pitch deck slide 10 and Design system task board

- **Fig 61. "Slide 10 · screenshots/10-pitch.png"**
  - Black slide. Small grey "[UNWTO line to confirm and insert]" (placeholder). H1 "Know what you really keep."
    (white, heavy, about 40 px). "The ask: 10 hill hotels in Mussoorie for a 60-day pilot." (white). Tiny "Pilot
    size is a placeholder to confirm."
- Section heading (PDF): "Design system".
- **Fig 62. "Conflicts, task board · screenshots/01-ds.png"**
  - Light grey page. Eyebrow "Phase 1 · A1 Orchestrator and A2 Design System"; H1 "Seedha design system" (about
    36 px bold); H2 "Task board".
  - Table in white card (radius 12 px, vertical scrollbar): headers "Task", "Agent", "Status", "Loops" (grey).
    Rows (hairlines):
    - "Conflict list and plan" | "A1" | chip "Done" (light green bg, green text) | "2"
    - "One token set, pine accent" | "A2" | "Done" | "2"
    - "Home page with live flip" | "A3" | chip "In review" (pale grey-green bg, dark green text) | "6"
    - "Owner app, flip first" | "A4" | "In review" | "9"
    - "Home setup checklist and Season in review" | "A4" | "In review" | "1"
    - (next row cut)

## page-37: Design system, colour/type and components

- **Fig 63. "Colour, type, space · screenshots/02-ds.png"**
  - Swatch card (white, radius 14 px; swatch area at top blank/very light): "Glass" / "rgba(245,245,247,.72) ·
    dark rgba(22,22,24,.72)" / "Headers, sheets".
  - Ratio note (grey): "Ratio: 60% light surfaces, 30% graphite text and dark sections, 10% blue for the one
    action per screen. Red only for money lost, green only for money kept, gold only for money saved, always
    with a sign or label." (Note: says blue for the action; the approved app uses pine green for the action.)
  - H2 "Type". Type specimen card (white, rows separated by hairline): label "Hero number" / "40 to 96 px · 700"
    → "₹47,33,011" (bold); "Large title" / "56 to 64 px · 700" → "Bookings are not money." (bold, tight
    tracking).
- **Fig 64. "Components · screenshots/03-ds.png"**
  - White card with three frame specimens:
    - "Phone frame": tall rounded rectangle (radius about 28 px), thick black border about 4 px, light grey
      #F5F5F7 screen.
    - "Desk frame": beige bezel #E9E4DC (radius about 12 px), green LED strip on top (#34C759), black screen with
      "Ready" (white small).
    - "Slip frame": white receipt with thin grey border, monospace text: "DEODAR VIEW" / "Room ₹4,000" /
      "Kept ₹2,678" (last digit low-res; reads ₹2,678).
