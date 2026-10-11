# Pulse redesign R1 (read-only research, 12 Oct 2026)

## 1. Current Pulse section
- `components/website/Sections.tsx:377-461`. Data is a static tuple list `PULSE` (379-422), grouped by month,
  with `[name, date, decision]`. No props, no API. Copy already matches the brief word for word.
- `PulseStrip` (424-461): `<section id="pulse" class=section>` > `.container` > kicker, h2#pulse-title, lede,
  `.pulseStrip` grid (h3 month, h4 event, `.sampleTag` "Sample"), footnote, then `<EventRadar />` at 456.
- CSS `site.module.css:1282-1345` goes dead (lead deletes). Mounted at `HomePage.tsx:37`, unconditionally (not gated on `/public/sample`). Header/footer link to `/#pulse`
  (`WebsiteHeader.tsx:11`, `WebsiteFooter.tsx:14`): keep the id.
- EventRadar (`EventRadar.tsx:12-52`) is its own `<section id="event-radar">` with an h3 and `WorldGlobe`
  . `.radar` (`upgrade.module.css:129-133`) only adds margin-top + border-top
  and relies on the parent `.container` for gutters.
- **Recommendation: move EventRadar to a sibling right after the Pulse section** (lead edits `HomePage.tsx`:
  `<PulseSection /><div className={site.container}><EventRadar /></div>`, or wrap inside EventRadar). Reasons: the
  sticky pin and `useScroll({ target })` offsets must end at the last event, not after a tall globe block;
  the reduced-motion list stays clean; the "See Event Radar (Beta)" link becomes a plain `href="#event-radar"`.
- e2e impact: **no spec asserts `#event-radar` inside `#pulse`**. `website-upgrade.spec.ts` only uses
  `page.locator("#event-radar")` (lines 16, 30-36, 99, 129). Nothing to change there. Careful: the text
  "Event Radar" also appears as a globe toggle button inside `#seedha-pass` (`WorldGlobe.tsx:39`), so "appears
  once" must be `expect(page.locator("#event-radar")).toHaveCount(1)`, not a getByText count.

## 2. Website tokens
- `.site` dark default `site.module.css:5-43` (`--bg #000 --bg2 --card #1c1c1e --ink --ink2 #a1a1a6 --line
  --accent #4cc38a --accentSoft --gold --goldText --fill --glass rgba(22,22,24,.72) --shadow`), light at `45-75`
  (`--accent #1e6b4e`, `--glass rgba(245,245,247,.72)`). From `globals.css`: `--spring` (42), `--dur-flip 700ms`,
  `--t-large` (55), `--font`.
- Classes: `.section` 327, `.kicker` 332, `.h2` 341, `.lede` 351, `.footnote` 359, `.card` 365 (radius 28),
  `.sampleTag` 372, `.pill/.pillOutline` 249-287 (min-height 44, use 48 for the brief), `.srOnly` 107. Glass
  recipe: `.header` 121-130 (`backdrop-filter: saturate(180%) blur(20px)`). FRONTEND_MASTER:57 cards 22-24.
- Breakpoints: max 439, min 560, 760, 980, 1180. 980 is the pin breakpoint.
- Sticky header is 64px (`.header` 121, height 140): pin with `top: 64px` + gap. `.site` has
  `overflow-x: clip` (41), which does not break `position: sticky`.
- `useReveal` (`useReveal.ts`) = `useSeenOnce` (`hooks.ts`, IO threshold 0.2) + hydration arm. `hooks.ts` also has
  `prefersReducedMotion()`; framer's `useReducedMotion` is used in Hero/Sections.
- Theme: `data-site-theme` on `#seedha-site` (WebsiteFrame.tsx:12), dark unless cookie. Global reduced motion: `site.module.css:2093-2100` kills every CSS transition/animation in `.site`. It does
  NOT stop WAAPI `el.animate()` or framer JS animations; those need a JS check.

## 3. Flip motion and channel colours
- Owner flip (`app/(owner)/(screens)/flip/page.tsx:60-76`): manual FLIP via `el.animate()` translateY 700 ms,
  skipped under reduced motion; rows absolutely positioned (`flip.module.css:1-2, 48-58`, `--rank`, `--n`).
- **Best reuse is the website Hero copy** (`Hero.tsx:186-212`, CSS `site.module.css:708-783`): `<ol>` with fixed
  height, `<li>` absolute, `style={{transform: translateY(rank*(ROW_H+GAP))}}`, `transition: transform
  var(--dur-flip) var(--spring)`, stable DOM keys, `aria-posinset`. Pure CSS, zero JS cost, and auto-instant under
  reduced motion thanks to the global rule. `.rowRing` (739) is the ring pattern (swap `--ink` for `--accent`).
- Colours: `lib/channels.ts` `channelColour(key)` -> `var(--ch-*)`; keys `mmt bcom agoda ta walkin direct`;
  values `globals.css:36-41` light, `94-99`/`129-134` dark. **Trap**: `--ch-*` follow `html[data-theme]`/OS, not
  `data-site-theme`. Site dark + OS light gives MMT `#1d1d1f` on a `#1c1c1e` card. B2 should redefine them on the
  rail: `.rail{--ch-mmt:#f5f5f7;...}` and `:global([data-site-theme="light"]) .rail{--ch-mmt:#1d1d1f;...}`.

## 4. framer-motion and bundle
- `framer-motion` 14.1.0 is already in the home chunk (`Hero.tsx:4`: motion, useReducedMotion, useScroll,
  useTransform; `Sections.tsx:4`), so the 40 KB budget is new code only. Skip `layout`/`LayoutGroup`.
- Only the globe is lazy (`next/dynamic`, WorldGlobe.tsx:46-47). Reduced motion patterns: framer `useReducedMotion` -> `initial={reduce ? false : ...}` (Hero.tsx:18-30),
  duration 0 (Sections.tsx:169), CSS global rule, upgrade.module.css:178-186.

## 5. Existing e2e coverage to keep green
- No spec references `#pulse` or the Pulse copy. `website-upgrade.spec.ts` checks `#event-radar` copy, Pro tag,
  no rupee, globe fallback, no foreign requests: keep EventRadar unchanged.
- `a11y.spec.ts:51-79`: axe on `/` at 1440/390, both themes, with reducedMotion reduce (only the list fallback is
  checked; V1 should axe the pinned view too). Dim swatch/bar for "Held back", keep label text 4.5:1.
- `perf.spec.ts` is `/flip` only. Unit tests `node --test lib/*.test.ts` (Makefile:71): no `@/` imports in lib/pulse.ts.

## 6. File ownership (no shared files)
- Lead: `HomePage.tsx` (mount, EventRadar sibling), `Sections.tsx` (delete PulseStrip), `site.module.css`, docs.
- Shared, written by B2 first (B1 reads only): `lib/pulse.ts` (types, `PULSE_EVENTS`, `CHANNELS`, `railOrder()`,
  `roomStates()`, `stateText()`), `lib/pulse.test.ts`.
- B1: `components/website/pulse/PulseSection.tsx` (shell, `id="pulse"`, active index, reduced-motion switch,
  Radar link), `Timeline.tsx`, `ScrollStory.tsx` (sticky + `useScroll`), `MonthStrip.tsx` (chips, swipe),
  `PlaySeason.tsx`, `pulse-story.module.css`, `e2e/pulse.spec.ts`.
- B2: `DecisionCard.tsx`, `ChannelRail.tsx`, `RoomGrid.tsx`, `PulseList.tsx` (reduced motion), `pulse-card.module.css`.
- Interface: `type PulseEvent = { id; name; date; month: "2026-10"|...; decision; kind: "hold"|"weekdays"|
  "perk"|"package"; channels: Record<ChannelKey, "favoured"|"open"|"held"|"weekdays">; directRooms: number[];
  tag?: "Package"|"OTA weekdays" }`. `DecisionCard({ event, index, total, reducedMotion, compact })`;
  `PulseList({ events })`. B1 owns the aria-live wrapper; card has no own live region.

## 7. Per-event states (channel decision only; no forecast, no counts in text)
Sample ledger: Agoda is the OTA that leaves the least (net ADR 2,598 vs MMT 2,737; `scenario.py:36`,
`test_public_sample.py:47`). MMT is biggest by bookings and 5th by money kept. Default order: MMT, Booking.com,
Agoda, Travel agents, Walk-in, Direct; per event: favoured (ring) top, open middle, held bottom.
| Event | Favoured | Held back | Other | Grid (22, Illustration) |
|---|---|---|---|---|
| Dussehra | Direct, Walk-in | MMT, Booking.com, Agoda ("Held back Saturday") | TA open | 6 rooms "For direct" |
| Diwali | Direct | none | MMT, Booking.com, Agoda "Open weekdays" | 8 rooms tagged "OTA weekdays", no pine |
| Guru Nanak Jayanti | Walk-in, Direct | none | rest open | no hold; caption "Perk offered at the desk" (gold perk tag allowed) |
| Winter Line Carnival | Direct | Agoda ("Held back until nights are empty") | MMT, Booking.com, TA, Walk-in open | 10 rooms "For direct" |
| New Year's Eve | none | none | all open, order unchanged | "Package" tag, public rate kept |
| Republic Day | Direct | Agoda ("leaves the least on sample data") | rest open | 6 rooms "For direct" |
Room patterns are fixed and illustrative, never shown as a count; labels "Illustration", "Sample". Hardcode Agoda + test ref.
