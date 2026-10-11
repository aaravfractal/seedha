# Pulse B1 status (12 Oct 2026)

## Files (all in apps/web)
- New `components/website/pulse/`: `PulseSection.tsx` (shell, `id="pulse"`, active index, layout switch,
  aria-live region via `announce()` + `stateText`, footer, "See Event Radar (Beta)" link to `#event-radar`),
  `ScrollStory.tsx` (sticky panel top 72px, `useScroll` offset `["start 72px","end end"]`, index from progress,
  jump = `window.scrollTo` with a short lock so smooth scroll does not flicker through events),
  `Timeline.tsx` (`<ol>` of buttons, `aria-current="step"`, tick + sr "done", glow, pine `scaleY` line),
  `PlaySeason.tsx` (`aria-pressed`, 3 s, stops on pointerdown/wheel/keydown/touchstart or at the last event),
  `MonthStrip.tsx` (<980px: snap chip strip, compact card, swipe with `touch-action: pan-y`),
  `storyHooks.ts` (`useMedia`, `keyIndex`, `useReservedHeight`), `pulse-story.module.css`.
- `HomePage.tsx`: `<PulseSection />` then `<div className={site.container}><EventRadar /></div>`.
- `Sections.tsx`: removed `PULSE`, `PulseStrip`, the EventRadar import. `site.module.css`: removed the dead Pulse block.
- `e2e/pulse.spec.ts`: 7 tests (desktop 1440, reduced motion, mobile 390 with touch).

## Behaviour notes
- Layout: reduced motion -> `PulseList`; `(min-width: 980px) and (min-height: 600px)` -> ScrollStory; else MonthStrip.
  The height guard stops a pinned panel taller than a short viewport. Server snapshot is the strip.
- Keys (story group is `role=group`, tabIndex 0): arrows clamp at both ends in both layouts, Home/End.
  `keyIndex(..., wrap=true)` uses `stepIndex` if the lead wants wrapping on mobile.
- Card slot `[data-pulse-card]` keeps its tallest height (ResizeObserver) so card swaps never shift content below.
- Progress dots and the sticky-card glass are left to B2's DecisionCard (it gets `index`/`total`).
- Own code is about 7 KB gzipped source (well under 40 KB); motion is transform/opacity only.

## Verified (with temporary stubs, now deleted)
- next dev --webpack on 3895 + API 8895: screenshots at 390, 760, 980, 1440, dark and light, reduced motion.
- `npx playwright test e2e/pulse.spec.ts` against 3895: 7/7 passed with stubs.
- typegen, tsc, eslint (0 warnings), prettier --check, `node --test lib/*.test.ts` (125 pass) all clean with stubs.
  With stubs deleted, tsc fails only on the missing `./DecisionCard` and `./PulseList` imports (expected).

## Assumptions on B2 (spec may need a tweak after merge)
- Channel rows are `listitem`s whose text holds the channel name and "Held back" (spec uses
  `card.getByRole("listitem").filter({ hasText })`).
- `PulseList` shows exactly six "Sample" labels and no element with `position: sticky`.
- The card shows the event name and a "Sample" pill; it has no live region of its own.

## Open issues
- `lib/pulse.ts`: no changes needed.
- The cookie banner covers the lower viewport on first visit; the mobile swipe test scrolls the card to the top first.
