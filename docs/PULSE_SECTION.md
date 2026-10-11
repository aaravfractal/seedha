# Pulse section redesign brief (saved word for word, 12 October 2026, started 00:10 IST)

REDESIGN: SEEDHA PULSE SECTION ON THE PUBLIC WEBSITE
Scope: the Pulse section of the marketing website only. No backend, owner
app or demo changes. Time box: 3 hours. Save this brief to
docs/PULSE_SECTION.md and commit first.

GOAL
Turn the static event list into an interactive, scroll-driven story that
shows Pulse's promise: "Every festival, one channel decision." It must
stay honest: sample events, a channel decision, never a demand
prediction, no rupee figures.

CONTENT (keep exactly; all labelled "Sample")
Kicker "SEEDHA PULSE · PRO". Heading "Every festival, one channel
decision." Sub: "Pulse lists the dates that matter to a hill hotel and
suggests which channel to hold back. It is a channel decision. It does
not predict demand."
Events (date, decision line):
- Dussehra · Tue 20 Oct · Long weekend for Delhi families. Hold Saturday
  rooms for direct and repeat guests first.
- Diwali · Sun 8 Nov · Families book late. Open OTA rooms only for the
  quiet weekdays after.
- Guru Nanak Jayanti · Tue 24 Nov · Midweek holiday. Offer the direct
  perk to every walk-in enquiry.
- Winter Line Carnival · 25 to 30 Dec · Your busiest week. Sell direct
  first; open the lowest-net channel only for nights still empty.
- New Year's Eve · Thu 31 Dec · Packages sell better than discounts. Keep
  the public rate.
- Republic Day weekend · 23 to 26 Jan · Long weekend with a bridge day.
  Hold rooms off the channel that leaves the least.
Footer: "Sample events for a Mussoorie hotel. Confirm dates locally
before you act."

DESIGN
1. Sticky scroll story (desktop 980px and up): the section pins while
   the user scrolls through the six events.
   - Left: a vertical season timeline Oct 2026 to Jan 2027 with month
     labels; a pine progress line fills with scroll; the active event
     node glows; past nodes stay ticked.
   - Right: the "decision card" for the active event:
     a. Event name, date chip, "Sample" pill.
     b. The decision line, large and readable.
     c. Channel rail: MakeMyTrip, Booking.com, Agoda, Travel agents,
        Walk-in, Direct as rows using the channel colours. For each
        event, channels the decision holds back slide to a "Held"
        state (dimmed, lock icon, label "Held back"); channels it
        favours rise to the top with a pine ring. Rows move with the
        same flip motion as the Money kept screen (translateY, 700ms,
        cubic-bezier(0.22, 1, 0.36, 1)), never fade.
     d. Mini hotel: a 22-room grid; rooms marked "For direct" light up
        pine in a stagger (40ms per room) for hold-back events; for
        Diwali, weekday rooms open to OTA; for New Year's Eve, a
        "Package" tag appears instead. Purely illustrative, labelled
        "Illustration".
   - Event transitions: card content cross-fades with a 12px rise,
     500ms; numbers never animate because there are none.
2. Interaction: click or tap any timeline node to jump to that event;
   arrow keys move between events when the section has focus; a small
   "Play season" button auto-advances every 3 seconds and stops on any
   input; progress dots under the card.
3. Phone and tablet (under 980px): no pinning. A horizontal month strip
   with snap-scrolling event chips at the top; tapping a chip swaps the
   decision card below with the same channel rail and room grid at a
   compact size; swipe left and right between events.
4. Look: design tokens from docs/FRONTEND_MASTER.md, dark-first like the
   rest of the website with the light theme supported; cards radius 24;
   subtle glass for the sticky card; gold used only if a perk is shown.
5. Optional connection: a quiet link under the section, "See Event Radar
   (Beta)", scrolling to the Event Radar block if it exists. Event Radar
   must still appear exactly once on the page.

MOTION AND PERFORMANCE
- Framer Motion only (already approved). Scroll-linked progress via
  useScroll; no scroll hijacking; native scroll stays smooth.
- prefers-reduced-motion: no pinning, no auto-play, instant state
  changes, everything still readable as a simple list of cards.
- Under 40 KB extra JS gzipped for this section; 60 fps; no layout shift
  (reserve card height).

ACCESSIBILITY
Timeline is a list of buttons with aria-current on the active event;
decision card is an aria-live polite region; channel states announced in
text ("Agoda held back"); every colour state also has an icon and label;
keyboard and screen reader complete; contrast 4.5:1; 48px tap targets.

COPY RULES
No em dashes, no exclamation marks, no "not X but Y", no rupee figures,
no demand predictions. Keep every "Sample" and "Illustration" label.

TEAM (max 3 background agents, own worktrees, only the lead commits)
- R1 (read-only): read the current Pulse section, website tokens, the
  Money kept flip code and the globe/Event Radar blocks; report reusable
  pieces and file ownership.
- B1: timeline, scroll story, jump, keyboard, play season, mobile strip.
- B2: decision card, channel rail with flip motion, 22-room grid,
  per-event states, reduced-motion fallback.
- Then V1 (read-only): design QA at 390, 760, 980, 1440 in light and
  dark, accessibility and performance; report to
  docs/agent-reports/pulse-section.md.
Lead fixes every high and medium finding.

VERIFY
Playwright: six events render with Sample labels; clicking a node and
arrow keys change the card; channel rail shows "Held back" text for the
right events; reduced motion shows the plain list; Event Radar appears
once; no rupee symbol inside the section. Run web tests, e2e and make
check. Commit locally, update docs/progress.md, then tell me when
http://localhost:3000 shows the new Pulse section and how long it took.
