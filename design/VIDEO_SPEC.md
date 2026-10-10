# Seedha frontend spec (from the Claude Design recording, 10 Oct 2026)

Source: a 104-second screen recording of the Seedha project in Claude Design.
Screenshots of every screen are in `screenshots/`. This file describes what
the recording shows so Claude Code can rebuild `apps/web` to match it.

Claude Design pages seen in the project:
Seedha Website · Seedha Security Review · Seedha Dashboard · Seedha Desk and
Guest · Seedha Design System · Seedha Site Owner · Hotel Site · Seedha App ·
Seedha My Place · Seedha Inbox · Rate Card · Agent Deck · Seedha Pitch Deck

The exported code for these pages was not captured. Where exact values are
unknown (hex codes, font names), match the screenshots as closely as possible
and list your choices in docs/decisions.md.

---

## 1. Four surfaces, four looks

| Surface | Look |
|---|---|
| Owner app (dashboard) | Light grey page, white rounded cards, near-black text, pine green primary, red for money lost, green for money kept, one orange/gold card for savings. Desktop-app feel with a top bar and left sidebar. |
| Front desk and guest | Light page with a large cream Desk device mock (pine screen bezel) beside a phone frame. |
| Marketing website | White page, soft green and violet blurred glow blobs, very large bold sans headlines, pill nav buttons, dark-mode toggle, word-by-word blur-in reveal on the hero. |
| Hotel site (World B) | Cream background, elegant serif headings (Cormorant-style), deep green buttons, large photo cards labelled "Sample photo", booking bar under the hero. |

---

## 2. Owner app

### Top bar (every owner screen)
- Back arrow, Seedha logo, hotel switcher pill with a green dot: "Hotel Deodar View"
- Segmented control: Owner · Front desk · Guest
- Search field "Search Seedha" with a ⌘K hint
- Notification bell with a red count badge
- Avatar circle with initials "RJ"

### Left sidebar
Overview · My Place · Guest inbox · Assistant · Upload · Money kept ·
Repeat guests · Saturday move · Approvals (red count badge) · Savings ·
Ask on WhatsApp · Calendar · Website · Consent proof · Pro (Pro tag) ·
Billing · Settings. Bottom card: "Open Seedha Desk ↗".
Each item has a small icon in a rounded square; the active item has a
white pill background.

### Overview (screenshots owner-01, 06 to 10)
- Date line "Saturday, 3 October 2026", heading "Namaste, Rajesh ji.",
  primary button "See the flip" top right.
- Black insight banner with a sparkle icon: "MakeMyTrip ne sabse zyada
  bookings di, par har room par sabse kam paisa chhoda." and a
  "Show in English" pill.
- Six KPI cards in two rows of three:
  Net kept (green, with "of list revenue") · Net ADR (with list ADR) ·
  Net RevPAR (with list RevPAR) · Paid to channels (red, with % of list
  revenue) · Direct share (with sub-label) · Saved with codes (orange card,
  with "N coded direct bookings").
- Source line under cards: "Calculated from your statements · Apr to Sep
  2026 · 183 days · 4,026 available room nights".
- "Set up the direct loop" card: progress bar and "5 of 8 done", two-column
  checklist of the 8 steps with green ticks and chevrons.
- "Where ₹63,05,000 went" waterfall chart: list revenue bar, then discount,
  commission, GST on commission, fees as red drops, ending in a green net
  kept bar. Caption: "Calculated from your statements. TDS is a tax credit
  and is not counted."
- "Channel mix" card: donut with "37% occupancy" in the centre and a legend
  with room nights and share for each channel.
- "Last night" card: "14 of 22 rooms sold · net ₹47,900 · direct share 21%",
  a grid of room tiles (room number plus channel code MMT, BDC, AGO, DIR,
  WLK, AGT or "Empty", coloured by channel), legend, and a
  "Print close slip on Desk" button.
- "Needs you" list: Approve Neha Gupta's thank-you · Confirm 1 repeat-guest
  match (A. Verma family, 74% sure) · Saturday move +₹10,110 · Diwali
  weekend, 7 to 8 Nov (one channel decision ready).

### Guest inbox (owner-02)
- Left: guest list with search, filters (All, Unread, Auto-replied), section
  "Consented at Desk", each guest with avatar initials, last message, time,
  and an "Auto-replied" tag where relevant.
- Centre: WhatsApp-style thread for Neha Gupta (Gurugram, returning guest),
  a voice note bubble with "Hindi · transcribed", a "Direct booking" card
  (7 to 9 Nov, room, nights, breakfast) with "Open Seedha Link".
- Suggested reply chips above the composer, a footer note
  "Guests found through OTA statements never appear here."
- Top right status pill: "Away · bot on".

### Website (owner-03 to 05)
- Tabs: Site · Packages · Google kit, back link, "Seedha Site · sample data".
- Site tab empty state: house icon, "Your hotel, online in 10 minutes.",
  "Start on WhatsApp", five step labels below.
- Packages tab: "Packages for your guests." cards marked "AI suggestion" and
  "Needs your OK", price, a reason box, Approve · Edit · Skip.
- Google kit tab: "Get found on Google." English and Hindi descriptions with
  "Copy description", best 5 photos with "Download photos", four steps,
  suggested categories, website link "deodarview.seedha.site".

---

## 3. Front desk and guest (desk-01, desk-02)
- Heading "One scan at check-in. One slip at checkout."
- Status pill: "Your Desk is connected · Reception, Hotel Deodar View" with
  "Test print".
- Large cream Desk device with pine bezel, dark screen "Seedha · Deodar View
  · Ready", Seedha mark and a "Print" button; phone frame next to it
  ("Show the QR on the Desk. The guest screen opens here.").
- Controls: "Show QR · Room 104" (primary), "Check out and print",
  "9 PM close slip", "Simulate no paper".
- Footnote: "Desk screen 480 × 320 px. Slips are 58 mm thermal, black only.
  QR is illustrative."

---

## 4. Marketing website (marketing-01 to 12)
- Nav: Seedha wordmark with Devanagari, Product · Growth · Pulse · Desk ·
  Pricing · Careers, dark-mode toggle, Sign in, green "Get started" pill.
- Hero: kicker "FOR HOTELS, HOMESTAYS AND MOUNTAIN STAYS", giant headline
  "Know what you really keep." with a word-by-word blur-in.
- "Six months. One 22-room hotel. Every rupee accounted for." with four
  counters that count up (paid to channels, % of list revenue, commission
  paid twice, extra per Saturday).
- Product grid (2 rows x 3): Seedha Desk, Seedha Link, Seedha Site,
  Seedha Proof, Seedha Pulse (Pro), Seedha Audit (Pro), each with a short
  outcome line.
- "The flip" section: "Your biggest channel can pay you the least." with a
  list-vs-net ADR table.
- ROI calculator: slider "Room nights moved direct each month", extra kept
  per month and per 12 months, minus Seedha Base, "You keep after Seedha"
  in a black box, plus a cumulative chart. Caption: illustration from
  sample net ADRs, not a promise.
- Guest map (Seedha Pulse · Pro): globe with guest home cities from the demo
  ledger and a city list.
- "No website yet?" Seedha Site card with "See a sample site" and "Build mine".
- Pricing: three cards (Base, Pro highlighted in black, Max) with yearly
  prices and feature lists, "Start with Base/Pro/Max".
- FAQ accordion, Careers section ("Build the revenue desk for India's hill
  hotels."), big CTA "Stop paying commission twice.", full footer with
  Product, Account, Company, Seedha Site, Support, Legal columns.

---

## 5. Hotel site, rate card, decks
- Hotel site: hero photo, "Mall Road, Mussoorie", serif "Deodar View",
  "Book directly", booking bar (check-in, nights, room, Book), sections Why
  book direct, Rooms, Packages, Photos, Nearby, Location and contact.
  Top controls in the design tool: mood (pine) and language (en).
- Rate card: printable A4 with photo strip, rooms table, packages.
- Agent deck: 6 dark photo-led slides with speaker notes.
- Pitch deck: black slides, big numbers ("₹4,000 booked, ₹2,788 kept").

---

## 6. Conflicts Claude Code must resolve (do not copy blindly)

| In the design | Our rule | Do this |
|---|---|---|
| Net kept ₹47,33,011 | Ruling 1: ₹47,33,012 | Always show the API value |
| "Direct share 16.7%, direct and walk-in" | Ruling 3 | Label "Commission-free share 16.7%", sub-line "Direct bookings 10.7%" |
| "Saved with codes ₹12,600, 4 coded bookings" | Savings come from real rows | Show the API value; zero until codes are used |
| Guest inbox "Auto-replied", "Away · bot on" | Rule 7: nothing sent without owner approval | Build as suggested replies the owner taps to send; no auto-sending. Label "Bot drafts, you send." |
| Footer badges: two-step sign-in, encrypted at rest, PCI DSS gateway | Not built | Remove these badges or mark "planned"; keep "Guest consent logged" and "No OTA scraping" |
| Guest map from home cities | Privacy | Aggregated city counts only, sample data label, no names |
| Pricing features: VCC Line, Agent Khata, Group Displacement, Pulse calendar | Some are slide-only | Mark unbuilt items "coming soon" |
| Hard-coded numbers anywhere | Rule 1 | Every number comes from the API |

---

## 7. Screens in the design that the current build does not have
Overview dashboard · top bar with hotel switcher, search, notifications,
avatar · My Place · Guest inbox · Assistant · Calendar · Billing ·
Website tabs (Packages, Google kit) · marketing website (all sections) ·
Agent deck and pitch deck pages.

Build order suggestion: Overview and app shell first (most visible), then
Desk restyle, then Website tabs, then Guest inbox, then the marketing site.
My Place, Assistant, Calendar and Billing can be simple, honest
"coming soon" pages if time is short.
