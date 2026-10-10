# Video screens catalogue

Text catalogue of the 33 screenshots in `design/video-screens/` (frames from the
104-second Claude Design recording, 10 Oct 2026) plus a summary of
`design/VIDEO_SPEC.md`. All frames are 1600 x 1186 px captures of a macOS window
(light theme). Hex values are approximate, sampled by eye. "Rs" amounts are written
with the ₹ sign exactly as shown on screen; where a number in the design conflicts with
our rulings, the conflict is noted (see section 6 of the spec summary).

---

## VIDEO_SPEC summary

Source: 104-second screen recording of the Seedha project in Claude Design.
Exported code was not captured. Where exact values are unknown (hex, font names) match
the screenshots and record choices in `docs/decisions.md`.

Claude Design pages in the project (13): Seedha Website · Seedha Security Review ·
Seedha Dashboard · Seedha Desk and Guest · Seedha Design System · Seedha Site Owner ·
Hotel Site · Seedha App · Seedha My Place · Seedha Inbox · Rate Card · Agent Deck ·
Seedha Pitch Deck.

### 1. Four surfaces, four looks
- Owner app (dashboard): light grey page, white rounded cards, near-black text, pine
  green primary, red for money lost, green for money kept, one orange/gold card for
  savings. Desktop-app feel with a top bar and left sidebar.
- Front desk and guest: light page with a large cream Desk device mock (pine screen
  bezel) beside a phone frame.
- Marketing website: white page, soft green and violet blurred glow blobs, very large
  bold sans headlines, pill nav buttons, dark-mode toggle, word-by-word blur-in reveal
  on the hero.
- Hotel site (World B): cream background, elegant serif headings (Cormorant-style),
  deep green buttons, large photo cards labelled "Sample photo", booking bar under the
  hero.

### 2. Owner app
Top bar (every owner screen): back arrow, Seedha logo, hotel switcher pill with a green
dot "Hotel Deodar View"; segmented control Owner · Front desk · Guest; search field
"Search Seedha" with a ⌘K hint; notification bell with red count badge; avatar circle
"RJ".

Left sidebar, exact order: Overview · My Place · Guest inbox · Assistant · Upload ·
Money kept · Repeat guests · Saturday move · Approvals (red count badge) · Savings ·
Ask on WhatsApp · Calendar · Website · Consent proof · Pro (Pro tag) · Billing ·
Settings. Bottom card: "Open Seedha Desk ↗". Each item has a small icon in a rounded
square; active item has a white pill background.

Overview:
- Date line "Saturday, 3 October 2026", heading "Namaste, Rajesh ji.", primary button
  "See the flip" top right.
- Black insight banner with sparkle icon: "MakeMyTrip ne sabse zyada bookings di, par
  har room par sabse kam paisa chhoda." and a "Show in English" pill.
- Six KPI cards, two rows of three: Net kept (green, "of list revenue") · Net ADR (with
  list ADR) · Net RevPAR (with list RevPAR) · Paid to channels (red, % of list revenue)
  · Direct share (sub-label) · Saved with codes (orange card, "N coded direct
  bookings").
- Source line: "Calculated from your statements · Apr to Sep 2026 · 183 days · 4,026
  available room nights".
- "Set up the direct loop" card: progress bar, "5 of 8 done", two-column checklist of
  the 8 steps with green ticks and chevrons.
- "Where ₹63,05,000 went" waterfall: list revenue bar, discount, commission, GST on
  commission, fees as red drops, green net kept bar. Caption: "Calculated from your
  statements. TDS is a tax credit and is not counted."
- "Channel mix" card: donut with "37% occupancy" centre, legend with room nights and
  share per channel.
- "Last night" card: "14 of 22 rooms sold · net ₹47,900 · direct share 21%", grid of
  room tiles (room number plus MMT, BDC, AGO, DIR, WLK, AGT or "Empty", coloured by
  channel), legend, "Print close slip on Desk" button.
- "Needs you": Approve Neha Gupta's thank-you · Confirm 1 repeat-guest match (A. Verma
  family, 74% sure) · Saturday move +₹10,110 · Diwali weekend, 7 to 8 Nov (one channel
  decision ready).

Guest inbox: left guest list with search, filters (All, Unread, Auto-replied), section
"Consented at Desk", avatar initials, last message, time, "Auto-replied" tag. Centre
WhatsApp-style thread for Neha Gupta (Gurugram, returning guest), voice note bubble
"Hindi · transcribed", "Direct booking" card (7 to 9 Nov, room, nights, breakfast) with
"Open Seedha Link". Suggested reply chips above composer; footer note "Guests found
through OTA statements never appear here." Top right status pill "Away · bot on".

Website: tabs Site · Packages · Google kit, back link, "Seedha Site · sample data".
Site tab empty state: house icon, "Your hotel, online in 10 minutes.", "Start on
WhatsApp", five step labels. Packages tab: "Packages for your guests.", cards marked
"AI suggestion" and "Needs your OK", price, reason box, Approve · Edit · Skip. Google kit
tab: "Get found on Google.", English and Hindi descriptions with "Copy description",
best 5 photos with "Download photos", four steps, suggested categories, website link
"deodarview.seedha.site".

### 3. Front desk and guest
- Heading "One scan at check-in. One slip at checkout."
- Status pill "Your Desk is connected · Reception, Hotel Deodar View" with "Test print".
- Cream Desk device with pine bezel, dark screen "Seedha · Deodar View · Ready", Seedha
  mark and "Print" button; phone frame beside it ("Show the QR on the Desk. The guest
  screen opens here.").
- Controls: "Show QR · Room 104" (primary), "Check out and print", "9 PM close slip",
  "Simulate no paper".
- Footnote: "Desk screen 480 × 320 px. Slips are 58 mm thermal, black only. QR is
  illustrative."

### 4. Marketing website
- Nav: Seedha wordmark with Devanagari; Product · Growth · Pulse · Desk · Pricing ·
  Careers; dark-mode toggle; Sign in; green "Get started" pill.
- Hero kicker "FOR HOTELS, HOMESTAYS AND MOUNTAIN STAYS", giant headline "Know what you
  really keep." with word-by-word blur-in.
- "Six months. One 22-room hotel. Every rupee accounted for." with four count-up
  counters (paid to channels, % of list revenue, commission paid twice, extra per
  Saturday).
- Product grid 2 x 3: Seedha Desk, Seedha Link, Seedha Site, Seedha Proof, Seedha Pulse
  (Pro), Seedha Audit (Pro), each with a short outcome line.
- "The flip": "Your biggest channel can pay you the least." with list-vs-net ADR table.
- ROI calculator: slider "Room nights moved direct each month", extra kept per month
  and per 12 months, minus Seedha Base, "You keep after Seedha" in a black box,
  cumulative chart. Caption: illustration from sample net ADRs, not a promise.
- Guest map (Seedha Pulse · Pro): globe with guest home cities from demo ledger and a
  city list.
- "No website yet?" Seedha Site card with "See a sample site" and "Build mine".
- Pricing: three cards (Base, Pro highlighted in black, Max) with yearly prices and
  feature lists, "Start with Base/Pro/Max".
- FAQ accordion; Careers ("Build the revenue desk for India's hill hotels."); big CTA
  "Stop paying commission twice."; footer columns Product, Account, Company, Seedha
  Site, Support, Legal.

### 5. Hotel site, rate card, decks
- Hotel site: hero photo, "Mall Road, Mussoorie", serif "Deodar View", "Book directly",
  booking bar (check-in, nights, room, Book), sections Why book direct, Rooms, Packages,
  Photos, Nearby, Location and contact. Design-tool controls: mood (pine), language (en).
- Rate card: printable A4 with photo strip, rooms table, packages.
- Agent deck: 6 dark photo-led slides with speaker notes.
- Pitch deck: black slides, big numbers ("₹4,000 booked, ₹2,788 kept").

### 6. Conflicts to resolve (do not copy blindly)
| In the design | Rule | Do this |
|---|---|---|
| Net kept ₹47,33,011 | Ruling 1: ₹47,33,012 | Always show the API value |
| "Direct share 16.7%, direct and walk-in" | Ruling 3 | Label "Commission-free share 16.7%", sub-line "Direct bookings 10.7%" |
| "Saved with codes ₹12,600, 4 coded bookings" | Savings from real rows | Show API value; zero until codes used |
| Inbox "Auto-replied", "Away · bot on" | Rule 7 | Suggested replies the owner taps to send; no auto-sending. Label "Bot drafts, you send." |
| Footer badges two-step sign-in, encrypted at rest, PCI DSS gateway | Not built | Remove or mark "planned"; keep "Guest consent logged" and "No OTA scraping" |
| Guest map from home cities | Privacy | Aggregated city counts only, sample data label, no names |
| Pricing features VCC Line, Agent Khata, Group Displacement, Pulse calendar | Some slide-only | Mark unbuilt "coming soon" |
| Hard-coded numbers anywhere | Rule 1 | Every number from the API |

### 7. Screens the current build lacks
Overview dashboard · top bar (hotel switcher, search, notifications, avatar) · My Place
· Guest inbox · Assistant · Calendar · Billing · Website tabs (Packages, Google kit) ·
marketing website (all sections) · Agent deck and pitch deck pages.
Build order: Overview and app shell first, then Desk restyle, then Website tabs, then
Guest inbox, then marketing site. My Place, Assistant, Calendar, Billing may be honest
"coming soon" pages if time is short.

---

## Shared owner-app chrome (applies to owner-01, 06, 07, 08, 09, 10)

Window: macOS traffic lights top-left (red #FF5F57, yellow #FEBC2E, green #28C840).
Page background light grey ~#F2F2F4; content cards white ~#FDFDFD with large radius
(~28-32 px at this capture scale, i.e. roughly 16-20 px CSS since the capture is ~1.6-2x),
no visible border, very soft or no shadow.

Top bar (height ~96 px captured, thin bottom divider ~#E5E5E8), left to right:
1. Back button: circle ~60 px, light grey fill ~#E9E9EC, chevron "‹".
2. Logo: black rounded-square tile (~40 px, radius ~10) with a white two-line
   "hamburger"/equals glyph, then wordmark "Seedha" in bold system sans (~30 px
   captured, near-black #1A1A1A, tight tracking).
3. Hotel switcher pill: light grey fill ~#ECECEE, radius full, green dot ~#22C55E, text
   "Hotel Deodar View ·" (trailing dot/caret cut off), ~22 px regular.
4. Segmented control: grey track ~#E6E6E9 radius ~16; segments "Owner" (active: white
   pill, bold near-black), "Front desk", "Guest" (inactive: medium grey #666 semibold).
5. Search field: white, 1 px border ~#E3E3E6, radius ~14, magnifier glyph, placeholder
   "Search Seedha" grey #777, right-aligned key hint chip "⌘K" (grey fill #E9E9EC,
   small).
6. Bell outline icon with red badge (#E0322B, white "3").
7. Avatar: black circle ~52 px with white bold "RJ".

Left sidebar (width ~390 px captured, ~200 px CSS), item rows ~71 px apart:
icon tile = rounded square ~42 px, light grey fill ~#E8E8EB, dark glyph; label ~22 px
medium near-black. Active item ("Overview"): whole row is a white pill (radius ~16)
with soft shadow; its icon tile is filled pine ~#1E6B4E with a white ring/dot glyph.
Order and glyphs:
1. Overview (concentric circle)
2. My Place (house outline ⌂)
3. Guest inbox (envelope ✉)
4. Assistant (four-point sparkle ✦)
5. Upload (↑ arrow)
6. Money kept (⇅ up/down arrows)
7. Repeat guests (↻ circular arrow)
8. Saturday move (half-filled circle ◐)
9. Approvals (✓ check) with red circular badge "1" right-aligned (#D92D20, white)
10. Savings (₹)
11. Ask on WhatsApp (phone-in-circle ✆)
12. Calendar (grid ▦)
13. Website (ring ◎)
14. Consent proof (diamond ◈)
15. Pro (★ star) with grey pill tag "Pro" right-aligned (fill #E6E6E9, dark text)
16. Billing (card ▭)
17. Settings (gear ⚙)
Below: dashed-border rounded card (dash ~#D0D0D4, radius ~16) containing a pine
underlined link "Open Seedha Desk ↗".

---

## owner-01-overview-top.png

Screen: Owner app, Overview, scrolled a few px down (date line partially clipped under
the top bar). Cursor visible mid-page.

Layout: shared chrome (above). Main column x≈432-1538.
- Date line (clipped): "Saturday, 3 October 2026", grey #6B6B6B ~22 px.
- H1 "Namaste, Rajesh ji." huge bold system sans (~64 px captured), very tight negative
  letter-spacing, near-black #161616.
- Right-aligned primary button "See the flip": pine fill ~#1E6B4E, white bold ~26 px,
  fully rounded pill ~206 x 72 px.
- Insight banner: full width, near-black fill ~#1C1C1E, radius ~36, white four-point
  sparkle icon at left, text in white ~26 px regular on two lines: "MakeMyTrip ne sabse
  zyada bookings di, par har room par sabse kam paisa chhoda." Right: pill button "Show
  in English", fill ~#3A3A3C, white semibold.
- KPI grid: 3 columns, gap ~20 px, cards white radius ~28, padding ~32. Each: label
  ~22 px grey #555 regular, value ~38 px bold, sub-line ~22 px grey #555.
  Row 1:
  - "Net kept" / "+₹47,33,011" (green ~#1E7A4C bold) / "of ₹63,05,000 list revenue"
  - "Net ADR" / "₹3,155" (near-black) / "List ADR ₹4,203"
  - "Net RevPAR" / "₹1,176" / "List RevPAR ₹1,566"
  Row 2 (taller):
  - "Paid to channels" / "−₹10,39,108" (red ~#D0312D) / "16.5% of list revenue"
  - "Direct share" / "16.7%" / "Direct and walk-in room nights" (wraps to 2 lines)
  - "Saved with codes" card filled orange/gold ~#E59A33, text dark brown ~#3A2A10 /
    "₹12,600" bold dark / "4 coded direct bookings" (brown ~#5A3A10).
- Source line: "Calculated from your statements · Apr to Sep 2026 · 183 days · 4,026
  available room nights" grey #777 ~20 px.
- Card "Set up the direct loop" (H2 ~30 px bold) with right-aligned grey "5 of 8 done";
  progress bar full width ~8 px tall, pine fill ~62% (5/8), track ~#E6E6E9, rounded.
  Visible first row of checklist: green filled circle with white ✓ + "Upload
  statements" + "›" ; "AI reads every row" + "›".
Conflicts: Net kept should read ₹47,33,012 from API; "Direct share" relabel per ruling 3;
Saved with codes from API.

## owner-02-guest-inbox.png

Screen: Guest inbox (Seedha Inbox page), a separate compact app layout (not the main
sidebar). Neha Gupta thread selected.

Layout: rounded window panel (radius ~40, white) on light grey backdrop. Three columns:
1. Narrow icon rail (~100 px captured, bg ~#F4F4F6, right divider): top black rounded
   square ~56 px with white bold "S"; then icons stacked: ring/radio ◉, envelope (active:
   pale green tile ~#E3EFE8, red badge "1"), house ⌂, grid ▦, gear ⚙.
2. Guest list column (~430 px):
   - Header "Guests" bold ~32 px; right grey "Median reply 4 min".
   - Search field: grey fill ~#EDEDF0, radius ~18, magnifier, placeholder "Search".
   - Filter chips (pill, ~44 px tall): "All 5" active (black fill, white text, count in
     lighter grey), "Unread 1", "Auto-replied 2" (grey fill ~#EBEBEE, dark text), a
     fourth chip clipped at edge.
   - Section label "CONSENTED AT DESK" small caps grey, letter-spaced.
   - Rows (avatar circle ~62 px with white initials, presence dot bottom-right green
     #22C55E or grey #BBB with white ring; name bold ~22 px; time right grey; preview
     grey single-line ellipsis):
     a. Selected row (bg pale grey-green ~#E9EEEC, radius ~20): avatar pine "NG" green
        dot; "Neha Gupta" · "9:12 PM"; "Bot: Namaste Neha ji. Rajesh ..."; tag
        "Auto-replied" (grey pill).
     b. "KF" black avatar, grey dot; "Kapoor family" · "6:52 PM"; "You: So glad to hear
        that. See..."
     c. "SB" dark grey avatar ~#3A3A3C, green dot; "S. Bisht" · "11:21 AM"; "You: Yes,
        two covered spots. I..."
     d. "AM" grey avatar ~#5A5A5E, grey dot; "Arjun Mehta" · "4:05 PM"; "Can I get a late
        checkout ..." with pine circular unread badge "1".
     e. "IF" light grey avatar ~#8E8E93; "Iyer family" · "11:47 PM"; "No rush, just
        wanted the Wi-F..."; tag "Auto-replied".
   - Footer (top divider): "Guests found through OTA statements never appear here." grey.
3. Thread column:
   - Header: pine avatar "NG" ~62 px, "Neha Gupta" bold ~28 px, sub "Gurugram ·
     Returning guest · 2 stays" grey. Right: status pill "Away · bot on" (cream fill
     ~#FBEBD3, 1 px border ~#F2D3A6, orange dot ~#F59E0B, dark bold text); circular info
     button "ⓘ" grey fill.
   - Day divider "Today" grey centred.
   - Incoming bubble (grey ~#EBEBEE, radius ~24, left): "Hi! Planning Diwali weekend with
     the kids. Is a valley view room free on 7 and 8 Nov?" time "9:12 PM" bottom right.
   - Label "Seedha bot · while you were away" (grey semibold small).
   - Bot bubble (lighter grey/lilac ~#EEEEF3): "Namaste Neha ji. Rajesh ji is away right
     now and will reply by 8 AM. Your code DEODAR-NG26 is saved for free breakfast."
     "9:12 PM".
   - Voice note pill (grey ~#EBEBEE, radius full): pine circular play button ▶, waveform
     of vertical bars (dark grey), "0:14 · Hindi · transcribed".
   - Card (white, 1 px border ~#E5E5E8, radius ~24, shadow subtle): kicker "DIRECT
     BOOKING" small caps grey letter-spaced; "7 to 9 Nov" bold ~34 px; "Deluxe valley
     view · 2 nights · breakfast included" grey; link "Open Seedha Link" pine bold.
   - Suggested row: "✦ Suggested" label, then pale green outlined chips (fill ~#EAF3EE,
     border ~#BFD9CB, pine-dark text): "Yes, a valley view Deluxe is free on 7..." ,
     "Breakfast is on us with your code. I ...", third chip clipped.
   - Composer: circular grey button with "₹" glyph; input pill "Write a message" (white,
     border ~#E0E0E3, radius full); pine circular send button with white "↑".
   - Footer line: "Prices from your rate card, never AI · offers include Reply STOP" grey
     small; right pine bold link "Simulate guest".
Conflict: "Auto-replied", "Away · bot on" and the bot bubble contradict rule 7; rebuild
as owner-tapped suggested replies, label "Bot drafts, you send."

## owner-03-website-site-tab.png

Screen: Website page (Seedha Site Owner), Site tab, empty state. No app chrome visible
(full-bleed page, grey bg ~#F2F2F4).

Layout:
- Top left pine link "‹ Back" (~24 px semibold #1E6B4E).
- Grey caption "Seedha Site · sample data" (~20 px #666).
- H1 "Website" (~60 px, heavy, tight tracking).
- Right: segmented control (track ~#E6E6E9 radius ~20; ~410 x 70 px): "Site" active
  white pill bold; "Packages", "Google kit" grey semibold.
- Large white card (radius ~40, full width, ~800 px tall) centred content:
  - Icon tile ~98 px, pale green-grey fill ~#E6EEEA, radius ~24, pine house outline ⌂.
  - Headline "Your hotel, online in 10 minutes." (~64 px heavy, tight tracking,
    near-black).
  - Sub "No website? Send a few photos and we build one with direct booking." grey #666
    ~28 px, centred, 2 lines.
  - Primary button "Start on WhatsApp" pine pill ~320 x 80, white bold ~26 px.
  - Row of five grey step labels (no icons, ~22 px #666, evenly spaced): "8 to 10
    photos" · "One Hindi voice note" · "Rooms and prices" · "Nearby places" · "Contact
    and UPI".

## owner-04-website-packages.png

Screen: Website page, Packages tab active (cursor hovering Google kit).

Layout: same header as owner-03 (‹ Back, "Seedha Site · sample data", "Website",
segmented control with "Packages" active).
- H2 "Packages for your guests." (~48 px heavy, tight).
- Sub "Seedha suggests packages from your own bookings. You approve each one before it
  shows on your site." grey ~24 px.
- 2-column grid of white cards (radius ~36, gap ~24, padding ~40):
  Card header row: left "✦ AI suggestion" (small semibold grey #555 with sparkle);
  right grey pill tag "Needs your OK" (fill ~#EBEBEE, semibold #555).
  1. "Weekend in the clouds" (bold ~32 px) / "2 nights, breakfast, bonfire" grey /
     "₹9,400" (bold ~44 px) / reason box (grey fill ~#F0F0F2, radius ~16): "**Reason:**
     Your weekends fill fastest." / buttons: "Approve" (pine pill, white), "Edit" (grey
     pill ~#E9E9EC, dark), "Skip" (text only, grey).
  2. "Char Dham stopover" / "1 night, early breakfast at 5 AM, parking" / "₹4,300" /
     "**Reason:** Yatra guests stay one night on the way." / Approve · Edit · Skip.
  3. (second row, left, clipped) "Monsoon midweek" / "3 nights, breakfast, late
     checkout".
Package prices must come from the rate card/API, not hard-coded.

## owner-05-website-google-kit.png

Screen: Website page, Google kit tab, scrolled so the tab control is just clipped at top.

Layout:
- H2 "Get found on Google." (~52 px heavy).
- Sub "Everything ready to paste into your Google Business Profile. Seedha never asks
  for your Google password." grey ~24 px.
- Two columns of white cards (radius ~36, gap ~24):
  Left column:
  1. "English description" (bold ~24 px) + grey pill button "Copy description" (fill
     ~#EBEBEE, bold). Body ~24 px: "Deodar View is a family-run 22-room hotel a short
     walk above Mall Road, Mussoorie. Valley-view rooms, homely breakfast, and direct
     booking with UPI."
  2. "हिंदी विवरण" (Devanagari bold) + "Copy description". Body in Devanagari:
     "देवदार व्यू मसूरी के मॉल रोड से थोड़ी दूरी पर 22 कमरों वाला पारिवारिक होटल है। घाटी के
     नज़ारे वाले कमरे, घर जैसा नाश्ता, और UPI से सीधी बुकिंग।"
  3. "Suggested categories" bold; outlined pill chips (white, 1 px border ~#D5D5D8,
     radius full, ~22 px text): "Hotel", "Family hotel", "Mountain resort", "Bed and
     breakfast". Line "Website link: deodarview.seedha.site" with the URL as pine bold
     link.
  Right column:
  1. "Best 5 photos, in this order" bold + pine pill button "Download photos" (white
     bold). Five square thumbnails (~126 px, radius ~16, gradient placeholders: green-
     teal, taupe brown, golden tan, grey-brown, pale sky blue) captioned grey: "1. View",
     "2. Deluxe room", "3. Breakfast", "4. Building", "5. Family suite".
  2. "Four steps" bold; numbered list with black filled circles (white numerals, ~38 px)
     separated by 1 px dividers: "1 Open your Google Business Profile on your phone." /
     "2 Paste the description." / "3 Upload the 5 photos in this order." / "4 Add your
     website link." Footer grey: "Guidance only. You stay signed in to your own Google
     account."

## owner-06-overview-direct-loop-waterfall.png

Screen: Overview scrolled down; shows bottom of KPI row 2, direct-loop checklist and the
top of the waterfall. Cursor near Saturday move in sidebar. A faint orange glow is
visible top-right behind the bar (recording artefact/hover glow).

Content:
- KPI row 2 tail: "−₹10,39,108" / "16.5% of list revenue"; "16.7%" / "Direct and walk-in
  room nights"; orange card "₹12,600" / "4 coded direct bookings".
- Source line (as owner-01).
- Card "Set up the direct loop" / "5 of 8 done" / progress bar ~62% pine.
  Two-column checklist, rows ~86 px separated by 1 px dividers (#ECECEE), chevron "›"
  grey at the right of each cell. Done steps: green filled circle (#1E7A4C) with white ✓.
  Pending steps: pale grey circle (#EDEDF0) with grey numeral.
  Left col / right col:
  - ✓ "Upload statements" | ✓ "AI reads every row"
  - (3) "See the flip" | (4) "Confirm repeat guests"
  - ✓ "Check-in consent at the Desk" | ✓ "Print a checkout slip"
  - (7) "Approve the win-back" | ✓ "Guest books direct"
  (Steps numbered 1-8 reading left-to-right, row by row.)
- Card "Where ₹63,05,000 went" (H2 ~32 px bold), sub "List revenue to net kept, six
  months" grey. Waterfall top visible: black bar (list revenue, ~#1A1A1A, radius ~10 top
  corners), floating red bars (#D0312D): discount (medium), commission (taller), GST on
  comm. (thin), fees (hairline), and green net kept bar (~#22B84A bright green) at right.

## owner-07-overview-channel-mix-last-night.png

Screen: Overview scrolled to Channel mix and Last night. Cursor over "Ask on WhatsApp".

- Card "Channel mix" (H2 bold ~32 px), sub "Share of 1,500 room nights".
  Donut (~270 px diameter, thick ring ~45 px, starts at 12 o'clock clockwise):
  MakeMyTrip black #1A1A1A (largest), Booking.com dark grey #3A3A3C, Agoda mid grey
  #7A7A7E, Travel agents light grey #A5A5AA, Walk-in very light #D0D0D4, Direct pine
  #1E6B4E. Centre: "37%" bold ~44 px, "occupancy" grey below.
  Legend list (square swatches ~14 px radius 3; name ~24 px; right-aligned grey count,
  bold percentage):
  - MakeMyTrip 620 **41.3%**
  - Booking.com 310 **20.7%**
  - Agoda 140 **9.3%**
  - Travel agents 180 **12.0%**
  - Walk-in 90 **6.0%**
  - Direct 160 **10.7%**
- Card "Last night" (H2), right grey "Sample close"; sub "14 of 22 rooms sold · net
  ₹47,900 · direct share 21%"; right grey pill button "Print close slip on Desk" (fill
  ~#EBEBEE, bold dark).
  Room grid: 10 columns, tiles ~92 x 92 px radius ~14, gap ~12. Top-left room number
  bold ~22 px, bottom-left channel code bold ~16 px. Colours: MMT black #1C1C1E white
  text; BDC dark grey #3F3F42 white; AGO mid grey #828287 white; AGT light grey #A5A5AA
  white; WLK very light #CDCDD1 white text; DIR pine #1E6B4E white; Empty very pale
  #EBEBEE with grey #666 text.
  Row 1: 101 MMT, 102 MMT, 103 MMT, 104 BDC, 105 MMT, 106 DIR, 107 WLK, 108 AGT, 109 MMT,
  110 BDC.
  Row 2: 111 DIR, 201 MMT, 202 AGO, 203 DIR, 204 Empty, 205 Empty, 206 Empty, 207 Empty,
  208 Empty, 209 Empty.
  Row 3: 210 Empty, 211 Empty.
  (14 sold: 6 MMT, 2 BDC, 1 AGO, 1 AGT, 1 WLK, 3 DIR; 8 empty.)
  Legend row: ■ MakeMyTrip ■ Booking.com ■ Agoda ■ Agent ■ Walk-in ■ Direct (grey text,
  colour squares as above).

## owner-08-overview-needs-you-sidebar.png

Screen: Overview scrolled to bottom; sidebar also scrolled showing the lower items and
the Open Seedha Desk card (cursor on it).

- Sidebar visible items: Money kept, Repeat guests, Saturday move, Approvals (badge 1),
  Savings, Ask on WhatsApp, Calendar, Website, Consent proof, Pro ("Pro" tag), Billing
  (▭ card icon), Settings (⚙). Dashed card "Open Seedha Desk ↗" (pine, underlined on
  hover).
- Tail of Last night grid (rows 1-3) and legend (see owner-07).
- Card "Needs you" (H2 ~32 px bold). List rows ~115 px, 1 px dividers, each: icon tile
  ~56 px grey ~#EDEDF0 radius ~12 (first one pale green ~#E3EFE8 with pine ✓), title
  bold ~26 px, sub grey ~22 px, chevron "›" right.
  1. ✓ "Approve Neha Gupta's thank-you" / "Consent 7:42 PM at Desk"
  2. ↻ "Confirm 1 repeat-guest match" / "A. Verma family · 74% sure"
  3. ◐ "Saturday move: +₹10,110" / "Hold 6 rooms off Agoda"
  4. ▦ "Diwali weekend, 7 to 8 Nov" / "One channel decision ready"

## owner-09-overview-waterfall-chart.png

Screen: Overview scrolled to the waterfall bottom, Channel mix and top of Last night.
Top bar shows faint red/green hover glow artefacts.

- Waterfall chart bottom: black list-revenue bar at left and bright green (#22B84A)
  net kept bar at right, both sitting on a 1 px baseline (#E3E3E6). Six evenly spaced
  columns with labels below: value bold ~22 px, category grey ~20 px:
  - "63.0L" (black) / "List revenue"
  - "−5.3L" (red #D0312D) / "Discount"
  - "−8.9L" (red) / "Commission"
  - "−1.5L" (red) / "GST on comm."
  - "−2.8K" (red) / "Fees"
  - "47.3L" (green #1E7A4C) / "Net kept"
  Caption: "Calculated from your statements. TDS is a tax credit and is not counted."
  grey ~22 px.
- Channel mix card identical to owner-07 (same legend values).
- Last night header, sub-line, "Sample close", "Print close slip on Desk", and first row
  of tiles 101-110 (top halves only).

## owner-10-overview-full.png

Screen: Overview at scroll top (unscrolled). Cursor near hotel switcher.
Identical content to owner-01 but not clipped:
- "Saturday, 3 October 2026" grey (~24 px) above H1 "Namaste, Rajesh ji.".
- "See the flip" pine pill top right aligned with H1.
- Black insight banner, six KPI cards (same values), source line, "Set up the direct
  loop" card with "5 of 8 done" and first checklist row ("Upload statements", "AI reads
  every row").
- Sidebar from Overview to Consent proof, Pro row clipped at bottom.
Vertical rhythm: date→H1 ~10 px; H1→banner ~32 px; banner→cards ~26 px; card gap ~20 px.

---

## desk-01-front-desk-and-guest.png

Screen: "Seedha Desk and Guest" page, Front desk and guest mode, idle state (Desk
"Ready", phone waiting). Page at scroll top.

Layout:
- Top bar (white-ish ~#F6F6F8, bottom divider): left circular back button "‹" (grey
  ~#E6E6E9, ~60 px), plain wordmark "Seedha" (bold ~26 px, no logo tile). Right:
  segmented control (track ~#E6E6E9): "Owner" (inactive grey) | "Front desk and guest"
  (active white pill, bold near-black, soft shadow).
- Page bg ~#F2F2F4.
- H1 "One scan at check-in. One slip at checkout." (~64 px heavy system sans, tight
  negative tracking, near-black).
- Status card (white, radius ~28, ~1115 px wide, ~105 px tall): green dot ~#1E7A4C,
  text "Your Desk is connected · Reception, Hotel Deodar View" (~22 px near-black);
  right grey pill button "Test print" (fill ~#E9E9EC, bold ~26 px).
- Body copy grey #666 ~24 px: "Run the full loop: show the QR, tick consent on the guest
  phone, print the checkout slip, then book direct on Seedha Link."
- Two device mocks side by side, each with a very large soft drop shadow:
  - Left: Desk device. Outer cream/beige body ~#EEEAE0 (gradient to ~#E3DED2), radius
    ~40, thin white "slot" line at top (~230 x 6 px, radius full). Inside a pine bezel
    ~#1B4632 (radius ~28) holding a black screen #000 (radius ~20) showing centred
    "Seedha" (white bold ~36 px) and "Deodar View · Ready" (grey #8E8E93 ~20 px).
    Below screen (clipped here): orange/gold wordmark "Seedha" (~#E8A33D) bottom-left and
    cream pill button "Print" bottom-right.
  - Right: phone frame. Black bezel ~#1C1C1E ~18 px thick, radius ~70, dynamic-island
    pill (~186 x 46, black). Screen white; bottom-centred grey text "Show the QR on the
    Desk. The guest screen opens here." (~24 px #666).
Cursor mid-page.

## desk-02-qr-controls.png

Screen: same page scrolled down to show the Desk's lower half, controls and footnote.
Still idle state.

- Desk device lower half: black screen bottom; on pine bezel, "Seedha" in gold/orange
  semibold (~#E8A33D, ~20 px) bottom-left; "Print" button: cream pill ~#F1EDE4, pine-dark
  bold text ~26 px, ~128 x 66 px. Below the bezel a dark horizontal printer paper slot
  bar (~448 x 12 px, near-black, radius full, with faint shadow). Cream body continues
  to a rounded bottom with a slightly darker bottom edge.
- Phone: blank white screen with "Show the QR on the Desk. The guest screen opens here."
  near top (scrolled), bottom of bezel visible, rounded.
- Control buttons (pills ~66 px tall, radius full, bold ~22 px):
  Row 1: "Show QR · Room 104" (primary: pine fill ~#1E5E43 / #1E6B4E, white text);
  "Check out and print" (disabled-looking: very pale grey fill ~#ECECEE, grey text
  #9A9A9E).
  Row 2: "9 PM close slip" (white fill, near-black text); "Simulate no paper" (white
  fill, near-black text).
- Footnote grey ~20 px: "Desk screen 480 × 320 px. Slips are 58 mm thermal, black only.
  QR is illustrative."
- Top bar shows blur/glass artefact on the left (backdrop blur while scrolling).

---

## Shared hotel-site chrome (hotel-site-01 to 05)

These are the "Hotel Site" Claude Design page (World B, guest-facing hotel website).
- Design-tool control strip at very top (white, ~70 px, bottom border): label "mood"
  (grey small) + select "pine ▾" (white, 1 px border ~#D5D5D8, radius ~8); label "lang"
  + select "en ▾". These are tool controls, not part of the site.
- Site header (sticky, cream ~#F4F1EC, translucent with blur, bottom divider ~#E2DED6):
  left chevron "‹", hotel name "Deodar View" in serif (Cormorant-like, ~36 px regular,
  near-black #1B1B1B). Right: language toggle pill (outlined ~#E0DCD4) with "EN" active
  (black circle, white bold) and "हि" (Devanagari, inactive); then pine button "Book
  directly" (deep green ~#1B4A35, white bold sans ~22 px, radius full, ~172 x 62).
- Page bg cream ~#F3F1EC. Headings serif (Cormorant Garamond style, large, regular
  weight); body sans is a humanist sans (looks like "Source Sans"/"Mukta"-like, not the
  SF system font) ~24 px, grey-brown #5A5650.
- All photos are gradient placeholders with a "Sample photo" chip (dark translucent
  ~rgba(40,40,40,0.7), white ~18 px text, radius full).

## hotel-site-01-rooms.png

Screen: Hotel site scrolled to the Rooms cards, start of Packages.

- Three room cards in a 3-column grid (gap ~32, card radius ~28, white body with 1 px
  border ~#E6E3DD, photo top ~360 px tall):
  1. Photo: deep green gradient (#4A6B4E → #33503B), chip "Sample photo". Title "Deluxe
     Valley View" (serif ~38 px). Sub "Breakfast included · valley view" (grey sans).
     Price "₹4,300" (bold sans ~32 px) + "a night" (grey ~22 px). Button "Book" (deep
     pine pill ~#1B4A35, white bold, ~120 x 68).
  2. Photo: taupe → sage gradient (#7E7262 → #9BAF94). "Family Suite" / "Two rooms · up
     to 4 guests" / "₹6,200 a night" / "Book".
  3. Photo: sand → dark taupe (#BBA98A → #5E5A50). "Standard" / "Cosy room · garden side"
     / "₹3,400 a night" / "Book".
- Section heading "Packages" (serif ~72 px). Below, tops of three pale grey-green cards
  (~#E6E6E0) with clipped serif titles (Weekend in the clouds / Char Dham stopover /
  Monsoon midweek, inferred from owner-04).

## hotel-site-02-photos-nearby.png

Screen: Hotel site scrolled to Photos gallery and Nearby.

- Photo grid: 4 columns, square-ish tiles (~366 px, radius ~22, gap ~16), label bottom-
  left in white sans ~18 px:
  Row 1 (tops clipped): "View" (sage→sand gradient), "Deluxe room" (olive→deep green),
  "Breakfast" (sage→beige), "Building" (dark olive grey→green).
  Row 2: "Garden" (green sage gradient), "Sunset" (warm brown-grey).
  (No "Sample photo" chip visible on these gallery tiles.)
- H2 "Nearby" (serif ~72 px).
- List row: "Mall Road" (sans ~26 px near-black) left, "5 min walk" (grey) right, 1 px
  divider below. Further rows clipped.

## hotel-site-03-hero-booking-bar.png

Screen: Hotel site, hero bottom with booking bar, and start of Why book direct.

- Hero (dark green gradient ~#5E7566 top → #1A2A1F bottom), text white:
  kicker "Mall Road, Mussoorie" (sans ~22 px), H1 "Deodar View" (serif ~120 px regular),
  sub "A quiet stay above Mall Road, with the valley at your window." (~28 px), button
  "Book directly" (white pill, near-black bold ~26 px, ~236 x 80).
- Booking bar: white card overlapping the hero bottom edge (radius ~32, large soft
  shadow, full width minus 30 px margins). Four columns:
  - "Check-in" label (grey ~18 px) / date input "07/11/2026" with calendar icon (white,
    1 px border ~#DAD7D0, radius ~16, ~74 px tall).
  - "Nights" / select "2" with chevron ⌄.
  - "Room" / select "Deluxe Valley View" ⌄.
  - Button "Book" (deep pine ~#1B4A35 fill, white bold ~26 px, radius ~16, same height,
    no label above).
- H2 "Why book direct" (serif ~72 px).
- Three columns each topped by a 3 px deep-green rule (~#1B4A35):
  - "Breakfast for returning guests" (sans bold ~28 px) / "Book again with your perk code
    and breakfast is on us."
  - "Pay by UPI" / "Simple and secure. No card needed."
  - "Talk to the hotel" / "Your message reaches us directly on WhatsApp."

## hotel-site-04-hero-full.png

Screen: Hotel site at scroll top, full hero.

- Header as shared (cream bg). Hero full width ~950 px tall: vertical gradient sky blue
  ~#8FA8BC top → pale mist ~#B9C9C6 middle → forest green ~#3E5644 → near-black green
  ~#1A2A1E bottom (stylised mountain-sky placeholder). "Sample photo" chip top-right
  (grey ~#666A6E fill, white text).
- Bottom-left text block: "Mall Road, Mussoorie" / "Deodar View" (serif ~120 px white) /
  "A quiet stay above Mall Road, with the valley at your window." / white pill "Book
  directly".
- Booking bar starts at bottom (Check-in 07/11/2026, Nights 2, Room Deluxe Valley View,
  Book) overlapping hero edge.

## hotel-site-05-why-book-direct.png

Screen: Hotel site scrolled to Why book direct and Rooms heading.

- "Why book direct" (serif ~72 px) with the three ruled columns (same copy as
  hotel-site-03).
- Large gap (~170 px) then H2 "Rooms" (serif ~72 px).
- Three room cards' photo areas with "Sample photo" chips (green, taupe-sage, sand
  gradients as hotel-site-01); titles clipped.
- Header shows a faint pink/peach blur glow (scroll artefact).

---

## Shared marketing chrome (marketing-01 to 12)

"Seedha Website" page. Page bg near-white ~#FCFCFC. Soft blurred glow blobs (mint green
~#CFE6DA and pale violet ~#E2E0F7, very large radius, heavy blur) drift behind sections.
Headlines: very large heavy system sans (SF-like), tight negative tracking, near-black
#0E0E0E. Body grey #666.
Sticky nav (~90 px, translucent white/grey with backdrop blur; turns light grey
~#EBEBEB once scrolled, thin bottom divider): left wordmark "Seedha" (bold ~30 px black)
+ "सीधा" (Devanagari, grey ~#777, ~24 px). Centre-right links (grey #555 ~22 px):
"Product" · "Growth" · "Pulse" · "Desk" · "Pricing" · "Careers". Then crescent-moon
dark-mode toggle icon (black), "Sign in" (near-black), "Get started" pill (sage/pine
green fill ~#5BA584, near-black bold text, ~158 x 50, radius full).

## marketing-01-hero.png

Screen: marketing hero mid-animation (word-by-word blur-in).
- Kicker centred, uppercase, letter-spaced ~4 px, grey #666 ~20 px: "FOR HOTELS,
  HOMESTAYS AND MOUNTAIN STAYS".
- Headline single line, ~120 px heavy, tight tracking: "Know what you really keep."
  Captured mid-reveal: "Know" and "what" crisp black; "you" nearly crisp; "really"
  blurred grey; "keep." heavily blurred and green-tinted (the last word appears to end
  in pine green ~#5BA584 → the word "keep." is likely coloured green/accent).
- Large mint blob behind headline left/centre, violet blob right. Rest of the viewport
  empty white (sub-copy / CTAs not yet revealed or below).

## marketing-02-six-months-stats.png

Screen: stats section with counters at their starting value (count-up not yet run).
- H2 two lines (~64 px heavy): "Six months. One 22-room hotel." / "Every rupee accounted
  for."
- Four columns, each topped by a 1 px grey rule (~#D8D8DA), gap ~42 px:
  1. "₹0" (~64 px bold) / "Paid to channels" (~26 px near-black) / "Commission, GST on
     commission and fees" (grey ~20 px)
  2. "0.0%" / "Of list revenue" / "Lost to channel cost"
  3. "₹0" / "Commission paid twice" / "12 guests who came back through an OTA"
  4. "+₹0" / "Extra per Saturday" / "Hold 6 rooms off Agoda if they sell direct"
  (Final values per spec: ₹10,39,108, 16.5%, ₹41,800, +₹10,110 — from API.)
- Footnote grey ~20 px: "Calculated from sample statements for Hotel Deodar View. All
  data is fictional."
- Mint glow behind columns 2-3.

## marketing-03-product-grid.png

Screen: product grid section. Heading clipped at top: "...needs. Nothing it does not."
(second line of an H2 ~64 px heavy; first line hidden behind nav, likely "Everything a
hill hotel needs." — [?]).
- One large container (1 px border ~#DCDCDE, radius ~40) split into a 3 x 2 grid by
  1 px internal dividers; no fill (white). Cell padding ~50 px. Each cell: small grey
  kicker (~20 px #666), title (~40 px bold), description (~26 px grey #555, 3 lines),
  bold outcome line (~26 px near-black) at bottom.
  1. "Desk" / "Seedha Desk" / "A reception box. Guests tick consent by QR, the ring turns
     green, the slip prints." / "4-second consent"
  2. "Link" / "Seedha Link" / "One-page direct booking with the perk code prefilled and
     UPI." / "Book direct"
  3. "Site" / "Seedha Site" / "No website? Send photos on WhatsApp and get one with
     direct booking." / "Online in 10 minutes"
  4. "Proof" / "Seedha Proof" / "Every guest yes is sealed nightly so you can prove
     consent later." / "Every yes provable"
  5. "Pulse · Pro" / "Seedha Pulse" / "Festivals and long weekends turned into one
     channel decision each." / "Not a prediction"
  6. "Audit · Pro" / "Seedha Audit" / "Flags commission overcharges and commission on
     cancelled stays." / "Money to claim back"
- Mint glow sits behind the Link cell (cursor hover glow follows the pointer).

## marketing-04-roi-calculator.png

Screen: ROI calculator section, slider at 20.
- H2 clipped at top (reads like "...direct. Watch what you keep." [?]).
- Sub (~26 px grey): "Each room night moved from MakeMyTrip to direct keeps ₹1,546 more:
  net ADR ₹4,283 minus ₹2,737."
- Two cards side by side (light grey ~#F2F2F2 fill, 1 px border ~#DCDCDE, radius ~40):
  Left card:
  - Label "Room nights moved direct each month" (grey ~20 px).
  - Value "20" (~110 px heavy).
  - Slider: track ~10 px, filled part sage green ~#5BA584, remaining part black; thumb
    sage circle ~24 px at ~33%.
  - Rows (label grey ~24 px left, value bold right):
    "Extra kept per month" / "+₹30,920"; "Extra kept in 12 months" / "+₹3,71,040";
    "Seedha Base, 12 months" / "−₹17,988".
  - Black box (#0B0B0B, radius ~20, ~114 px tall): "You keep after Seedha" (white bold
    ~24 px) left, "₹3,53,052" (white bold ~42 px) right.
  Right card:
  - Title "Cumulative extra kept" (bold ~28 px); legend right: solid pine line "Extra
    kept", dashed grey line "Seedha cost".
  - Line/area chart: 12 points (small white-filled circle markers with pine stroke)
    rising linearly from lower-left to upper-right, pine line ~#1E6B4E ~3 px, area fill
    gradient pale sage → transparent; dashed grey near-flat cost line at the bottom;
    faint horizontal gridlines (4-5), no axis labels.
  - Caption grey ~20 px: "Illustration from sample net ADRs. Not a promise of direct
    bookings. Seedha counts a saving only when a perk code is used."

## marketing-05-roi-calculator-49.png

Screen: same ROI calculator after dragging the slider to 49 (cursor on thumb).
- Left card: "Room nights moved direct each month" / "49" / slider thumb at ~80%,
  filled portion now lighter sage ~#8EC2A8 (hover/drag state), remainder black.
  Rows: "Extra kept per month" "+₹75,754"; "Extra kept in 12 months" "+₹9,09,048";
  "Seedha Base, 12 months" "−₹17,988". Black box "You keep after Seedha" "₹8,91,060".
  (Check: 49 × ₹1,546 = ₹75,754; × 12 = ₹9,09,048; minus ₹17,988 = ₹8,91,060. Same
  formula gives 20 → ₹30,920 / ₹3,71,040 / ₹3,53,052. Seedha Base = ₹17,988 a year.)
- Right card: same chart, line rescaled (12 points, linear rise), dashed Seedha cost
  line flat near bottom, same caption.
- Mint glow follows the cursor inside the left card.

## marketing-06-guest-map.png

Screen: Guest map (Seedha Pulse) section scrolled so the globe bottom and the end of the
city list are visible; next section starts.
- Left: card (1 px border ~#E0E0E2, radius ~40, white) containing bottom of a 3D globe:
  pale grey sphere ~#F1F1F2 with thin grey lat/long grid lines (~#DCDCE0), grey outline,
  heavy mint glow halo around it. Pine dots (#1E6B4E) near left edge connected by thin
  sage arcs (guest city → hill town).
- Right: tail of city list card: "Dehradun" "1 guest"; "Bengaluru" "1 guest".
- Legend: green dot "Guest home city", black dot "Hill town" (grey text ~22 px).
- Note grey ~22 px: "Sample guest origins from the demo ledger. Your own map fills in
  after you upload statements."
- Section divider (1 px full width) then next section kicker at bottom: "SEEDHA PULSE ·
  PRO" (uppercase letter-spaced grey ~20 px).

## marketing-07-guest-map-cities.png

Screen: Guest map fully in view; cursor is a grab hand inside a circle (drag-to-rotate
globe affordance, ~76 px ring).
- Left card (~880 x 880, radius ~40, 1 px border): globe ~775 px diameter centred, grid
  lines, soft inner shading mint, mint halo. Data points cluster at the left limb: three
  pine dots joined by sage lines plus two lone dots (India seen at the edge).
- Right: city list card (white, 1 px border ~#D8D8DA, radius ~32), rows ~89 px with 1 px
  dividers; pine dot ~12 px, city name ~26 px near-black, count right grey ~24 px:
  Delhi "2 guests"; Gurugram "1 guest"; Noida "1 guest"; Lucknow "1 guest"; Dehradun "1
  guest"; Bengaluru "1 guest".
- Legend "● Guest home city ● Hill town" and the sample note (as marketing-06).
Ruling: aggregated city counts only, sample-data label, no names.

## marketing-08-no-website-yet.png

Screen: "No website yet?" Seedha Site promo card (empty band above, after a 1 px section
divider).
- Card: light grey fill ~#F2F2F2, 1 px border ~#DCDCDE, radius ~40, padding ~70 px,
  full content width; mint glow behind (follows cursor).
- Kicker "SEEDHA SITE" uppercase letter-spaced grey ~20 px.
- H2 "No website yet?" (~60 px heavy, tight tracking).
- Body (~26 px grey #555): "Send 8 photos and a Hindi voice note on WhatsApp. Get a site
  with direct booking, packages, a rate card and an agent deck. Nothing goes live until
  you publish."
- Buttons (pills ~74 px tall, bold ~26 px): "See a sample site" (outlined: transparent,
  1 px border ~#BDBDC0, near-black text); "Build mine" (sage green fill ~#5BA584,
  near-black text).

## marketing-09-pricing.png

Screen: lower half of the pricing cards (top of cards and prices scrolled under nav).
- Three cards side by side (~480 px each, gap ~28, radius ~40):
  - Base (left): light grey fill ~#F3F3F3, 1 px border. Feature list rows ~67 px with
    1 px dividers (~#DCDCDE), ~24 px near-black: "Direct True Cost" (clipped) · "Repeat
    guests and Saturday move" · "Desk, slips and win-back" · "Seedha Link and Code
    Ledger" · "Six Hindi WhatsApp answers" · "Simple one-page site with direct booking".
    Button "Start withBase" (outlined pill, full width, bold ~26 px — note missing space
    between "with" and "Base", a design bug; use "Start with Base").
  - Pro (centre, highlighted): black fill ~#0B0B0B, white text, dividers ~#2A2A2C:
    "Full site, AI packages, rate card PDF, agent deck, Google kit" (clipped) · "Seedha
    Audit" · "Seedha Pulse calendar" · "Rate Watch" · "VCC Line and Agent Khata" ·
    "Group Displacement". Button "Start withPro" (sage fill ~#4E9A78 full width,
    near-black bold).
  - Max (right): grey like Base: "Two properties, one login" (clipped) · "One WhatsApp
    for both". Button "Start withMax" (outlined).
- Footnote centred grey ~22 px: "Only need a website? Seedha Site setup ₹4,999, one
  time. Optional ₹2,999 to clean six months of old statements. Prices are early
  estimates. The Desk is included with yearly plans."
Ruling: mark VCC Line, Agent Khata, Group Displacement, Pulse calendar (and other
unbuilt items) "coming soon". Plan prices themselves not visible in this frame; Seedha
Base yearly = ₹17,988 per marketing-04.

## marketing-10-no-website-cta.png

Screen: same "No website yet?" card as marketing-08, slightly earlier scroll position
(card lower on screen, more empty space above, section divider at y≈380). Identical
copy: "SEEDHA SITE" / "No website yet?" / "Send 8 photos and a Hindi voice note on
WhatsApp. Get a site with direct booking, packages, a rate card and an agent deck.
Nothing goes live until you publish." / "See a sample site" / "Build mine". Mint glow
centred above-left of the card where the cursor is.

## marketing-11-footer.png

Screen: marketing site footer (page bottom).
- Grid: brand block left (~600 px) then link columns (~308 px each). Column headings
  bold ~22 px near-black; links grey #666 ~22 px, ~53 px row spacing.
  - Brand: "Seedha" (bold ~32 px) / "The revenue desk for owner-run hotels and
    homestays." (grey).
  - Product: The flip · Growth · Pulse · Seedha Desk
  - Account: Sign in · Create account · Demo hotel · Pricing
  - Company: Careers · Guest map · Pitch deck · Design system
  Second row:
  - Seedha Site: Sample hotel site · Rate card · Agent deck · Desk and guest
  - Support: Questions · WhatsApp us
  - Legal: Privacy · Terms · Cookies · Security · Security review
- 1 px divider, then trust badges row (grey text, no icons, ~22 px, spaced ~42 px):
  "Two-step sign-in" · "Encrypted in transit and at rest" · "PCI DSS payment gateway" ·
  "Guest consent logged" · "No OTA scraping".
  Ruling: remove or mark "planned" the first three; keep the last two.
- 1 px divider, bottom bar: left "© 2026 Seedha. All sample data is fictional."; right
  links "Privacy" · "Terms" · "Security" · "Cookie settings" · "India · English".
- Mint glow behind the left/middle columns.

## marketing-12-faq.png

Screen: FAQ accordion, all items collapsed (first question above is clipped).
- Centred column (~1210 px wide, x≈180-1388). Rows ~113 px separated by 1 px dividers
  (~#E2E2E4); question text ~28 px medium near-black left; thin "+" icon (~24 px, grey
  #555) right.
- Questions visible, in order:
  1. "Is TDS counted as a cost?"
  2. "Will Seedha message my OTA guests?"
  3. "Do I have to lower my public rate?"
  4. "Does direct booking cost nothing?"
  5. "What is the Seedha Desk?"
  6. "Is this allowed under OTA rules and DPDP?"
  7. "What does the AI do, and not do?"
  8. "Do I need a computer?"
  (One more row clipped above item 1; answers not shown in any frame.)
- Mint glow top-right.

---

## pitch-deck-01.png

Screen: "Seedha Pitch Deck" in a slide viewer, slide 1 of 10 selected.
Viewer layout (shared with agent-deck-01):
- Left thumbnail rail (~290 px, near-black bg ~#141414): slide numbers grey left
  ("1".."7" visible, scrollable), 16:9 thumbnails ~210 x 118 radius ~8; selected one
  has an orange/coral outline ~#E0623A (~3 px).
- Stage (black #000): slide centred 16:9 with thin separator lines above and below.
- Controls bar below slide: "‹" · "1 / 10" (current bold white, total grey) · "›" ·
  vertical divider · "Reset" + key chip "R" (dark grey ~#2A2A2C, white).
- Speaker notes panel (white, bottom ~230 px): header "SPEAKER NOTES" (uppercase
  letter-spaced grey bold ~18 px) + "Slide 1 / 10" grey; 1 px divider; note text ~22 px.
Slide 1 (black):
- Kicker "ONE BOOKING ON MAKEMYTRIP" (uppercase letter-spaced grey ~22 px).
- "₹4,000" huge (~150 px heavy, off-white #F2F2F2) with "booked" below (grey ~28 px);
  "₹2,788" huge in bright green ~#2FBF71 with "kept" below.
- Caption grey: "After a 15% hotel-funded discount and 18% commission, before GST on
  commission. Sample data."
- Notes: "A family books at ₹4,000. After a 15% hotel-funded discount and 18%
  commission, the hotel keeps ₹2,788, before GST on commission."
Thumbnails (small text, partly [?]):
2. White: kicker [?] ("Rajesh · 22 rooms · Mall Road, Mussoorie" [?]); "The family loved
   the stay. Next year they booked through MakeMyTrip again." + small body [?].
3. White: "Why tools miss small hill hotels" with three columns "They count bookings",
   "Built for big hotels", "No way to win guests back" (body text unreadable).
4. Black: "Bookings are not money." with two ranked tables (by bookings vs by net per
   room night; e.g. "1. MakeMyTrip ₹26,84,000", "1. Walk-in ₹4,500"... mostly [?]).
5. White: red "−" "₹41,800" "commission paid twice for 12 guests the hotel already won."
   and green "+" "₹10,110" "per Saturday if 6 rooms held off Agoda sell direct." [small
   text approximated].
6. Black: Desk device mock (screen showing green check, "Thank you, Neha ji") + "One scan
   at check-in. One slip at checkout." + small body.
7. White: "Where AI works" with columns "Reads", "Matches", "Explains", "Drafts" and line
   "Every rupee is plain arithmetic, never written by AI."
(Slides 8-10 not visible.)

## agent-deck-01.png

Screen: "Agent Deck" in the same slide viewer, slide 1 of 6 (cursor on thumbnail 1).
Slide 1: full-bleed placeholder photo (sky blue ~#8FA8BC → mist → forest green
gradient), chip top-right "Sample photo · valley view" (grey translucent pill, white
text). Bottom-left text in white: "Mall Road, Mussoorie" (sans ~26 px) / "Deodar View"
(serif Cormorant-style ~130 px) / "A quiet 22-room stay above Mall Road. For travel
agents, companies and wedding groups." (~28 px sans).
Controls "‹ 1 / 6 › | Reset R". Speaker notes "Slide 1 / 6": "Introduce Deodar View in
one line."
Thumbnails:
2. Cream: serif "Rooms"; three photo tiles with captions "Deluxe Valley View"
   ("Breakfast included", "₹4,300 a night"), "Family Suite" ("Two rooms, up to 4
   guests", "₹6,200 a night"), "Standard" ("Garden side", "₹3,400 a night").
3. Deep green ~#1F4A35: serif "Packages"; three darker cards "Weekend in the clouds"
   "₹9,400", "Char Dham stopover" "₹4,300", "Monsoon midweek" "₹11,900" with tiny
   descriptions.
4. Split: left warm sunset gradient (peach → mauve) photo, right cream panel "Groups and
   weddings" with a key/value table: "Rooms 22", "Meals Veg and non-veg buffets",
   "Quotes WhatsApp +91 90000 00000" + footnote [?].
5. Cream: left map placeholder ("Map · Mall Road, Mussoorie"), right "How to reach"
   table: "Mall Road 5 min walk", "Gun Hill 10 min", "Lal Tibba 15 min drive",
   "Kempty Falls 30 min drive" (small, approximate).
6. Near-black: serif "Book with us"; "WhatsApp or call +91 90000 00000", "30% advance by
   UPI to deodarview@upi", "deodarview.seedha.site"; tiny footer text [?].

## rate-card-01.png

Screen: "Rate Card" page, printable A4 sheet centred on grey bg (~#F0F0F0), top portion.
- Sheet: cream ~#F3F1EC, ~1230 px wide, radius ~16 top corners, soft shadow.
- Photo strip (~520 px tall), three panels edge to edge: wide left (~50%) "Sample photo
  · view" (sky-blue → mist → forest green gradient); "Deluxe room" (taupe gradient
  ~#BBA98A → #7E6E5C); "Breakfast" (golden tan ~#DCC08E → #B5834A). Labels white sans
  ~18 px bottom-left.
- Title block (padding ~86 px): "Deodar View" serif (Cormorant-style ~80 px) / "Mall
  Road, Mussoorie, Uttarakhand · 22 rooms" (sans ~24 px grey-brown). Right-aligned grey
  ~20 px: "Rate card 2026 to 27" / "Prices per night, in ₹". Full-width 2 px deep-green
  rule (~#1B4A35) below.
- "Rooms" serif H2 (~40 px). Table: headers grey sans ~20 px "Room" | "Includes" | "Per
  night" (right-aligned), 1 px dividers ~#D8D4CC:
  - **Deluxe Valley View** | Breakfast, valley view | **₹4,300**
  - **Family Suite** | Two rooms, up to 4 guests | **₹6,200**
  - **Standard** | Garden side | **₹3,400**
- "Packages" serif H2 starting at bottom (clipped).
Body sans is the same humanist sans as the hotel site.

## design-pages-list.png

Screen: Claude Design "Pages" popover open over the Agent Deck viewer (agent-deck-01
behind it: slide 1/6, notes "Introduce Deodar View in one line.").
- Popover: white, ~520 px wide, radius ~12, shadow, scrollable list with a scrollbar.
  Header "Pages" (grey ~20 px). First row "New blank page" with a dashed-outline square
  "+" icon.
  Rows (~84 px, peach document icon ~#F6C9B5 with lines, title bold ~22 px, sub grey
  ~18 px); hovered first row shows grey bg and three action icons (duplicate, edit
  pencil, "···"):
  1. "Seedha Website" — "Edited 30m ago"
  2. "Seedha Security Review" — "Edited over a week ago"
  3. "Seedha Dashboard" — "Edited over a week ago"
  4. "Seedha Desk and Guest" — "Edited over a week ago"
  5. "Seedha Design System" — "Edited over a week ago"
  6. "Seedha Site Owner" — "Edited over a week ago"
  7. "Hotel Site" — "Edited over a week ago"
  8. "Seedha App" — "Edited over a week ago"
  9. "Seedha My Place" — "Edited over a week ago"
  (List continues below; per spec also Seedha Inbox, Rate Card, Agent Deck, Seedha
  Pitch Deck.)
  Footer row "All project files" with "→".
