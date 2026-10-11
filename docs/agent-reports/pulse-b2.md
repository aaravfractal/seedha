# Pulse B2: decision card, channel rail, room grid, list fallback

## Files (all new, uncommitted, in worktree pulse-b2)
- apps/web/components/website/pulse/DecisionCard.tsx ("use client")
  `DecisionCard({ event, index, total, reducedMotion, compact? })`: h3 name, date chip, Sample pill,
  decision line, ChannelRail, RoomGrid, progress dots (aria-hidden) + sr-only "Event 2 of 6".
  Header cross-fades in with a 12px rise over 500 ms (keyed motion.div, fade-in of the new content;
  no AnimatePresence, no layout). Rail and grid stay mounted so rows flip. No aria-live.
  Sr-only summary sentence carries `data-pulse-summary` (B1 can also call `cardSummary(event)`).
- ChannelRail.tsx: `ChannelRail({ event, reducedMotion, compact? })` and `StateIcon({ state })`.
  Fixed DOM order, rows absolute, `translateY(rank * step)` (54px, compact 48px), transition
  `var(--dur-flip) var(--spring)`. Favoured: pine ring + "First" + up chevron. Held: dashed, dimmed
  swatch, lock + "Held back", text at full contrast. Visible text aria-hidden; sr-only `stateText(...)`.
- RoomGrid.tsx: `RoomGrid({ event, reducedMotion })`. 22 tiles aria-hidden (11 columns, 6 when the card
  is 520px+ wide via container query); "For direct" pine + check, stagger 40 ms per lit room;
  Diwali dashed "OTA weekdays" + dot; New Year's Eve "Package" tag with gift icon over the grid;
  Guru Nanak Jayanti caption with a small gold "Perk" tag. Visible "Illustration" pill, legend
  (hold/weekdays only), caption, sr-only `roomSummary(event)` (no counts).
- PulseList.tsx: `PulseList({ events })`, `<ol>` of six static cards (1/2/3 columns at 760/1180).
- pulse-card.module.css: site-theme channel colours `--pc-*` on `.card`/`.list`, overridden under
  `[data-site-theme="light"]`. Glass card radius 24. Reserved min-heights (header + caption) so card
  height is identical for all six events at 320, 390, 760 and 1440 (measured).
- apps/web/lib/pulseCard.ts + pulseCard.test.ts: `channelSummary`, `roomSummary`, `cardSummary`,
  `progressText` (6 tests). lib/pulse.ts untouched.

## Verified
- Preview route screenshots 390/1440, dark/light, reduced motion (route deleted, server stopped).
- axe on card, compact card and list: 0 violations in both themes at 390 and 1440.
- Flip: MMT row mid-transition translateY 65px, end 0; with reduced motion instant.
- typegen, tsc, eslint (0 warnings), prettier --check, node --test lib/*.test.ts (131 pass).
- New code about 3.7 KB TSX + 2.4 KB CSS gzipped (framer already in the home chunk).

## Notes / open issues
- Card heights: desktop (card about 640 wide) 554px; compact at 390 about 757px. B1's sticky pin needs
  the right column at most about 640px wide or the card grows (stacked layout under 520px content).
- If B1 wants a true overlapping cross-fade (old out while new in), wrap the swap block with
  AnimatePresence; kept out to avoid layout work.
- Sr-only summary repeats the visible header for linear screen-reader reading; B1 may drop it by
  using `cardSummary()` in its own live region if V1 flags the duplication.
