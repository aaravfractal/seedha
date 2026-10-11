# Pulse section V1: design QA, accessibility, performance (12 Oct 2026)

Read-only review of HEAD 69a468f. next dev --webpack on 3898, API on 8898 (scratch sqlite, seeded),
Playwright + @axe-core/playwright scripts in the scratchpad, servers stopped afterwards.
Bundle measured from two `next build --webpack` runs in APFS-cloned scratch copies (HEAD vs
7fd901b's HomePage/Sections/site.module.css without components/website/pulse).

## Measured
- Extra JS: `(website)/page` chunk 12,967 -> 18,598 B gzip (+5.6 KB). Shared framer chunk +22 B.
  CSS +2.8 KB gzip. Well under the 40 KB budget.
- Frame rate, 1440x900 dark, rAF-driven scroll 14 px/frame through the pinned story only:
  326 frames, mean 16.67 ms (60.0 fps), p99 16.8 ms, max 16.8 ms, 0 frames over 20 ms.
  Full pass that also enters Event Radar: 52.5 fps mean, one 650 ms and one 133 ms frame exactly when
  the globe block mounts (dev mode, EventRadar/WorldGlobe, outside this section).
- CLS: scroll through the story 0.0007 (progress-dot width transition); six node clicks 0.0010, all
  hadRecentInput so 0 counted; load of `/` 0.0001. Card slot height constant (554 px at 1440 for all six).
- axe (wcag2a/2aa/21a/21aa/22aa) scoped to #pulse: 0 violations for all six events at 1440 (pinned) and
  390 (strip), dark and light, pointer parked; 0 at 760 strip; 0 on the reduced-motion list at 390 and
  1440. One serious color-contrast only while a timeline node is hovered in light (V1-02).
- Layout: no horizontal scroll at 390/760/980/1440 in both themes. Pinned panel top 72 px (header 64).
  Rail fill scaleY 0.1/0.3/0.7/0.9/1.0 at mid events 0/1/3/4/5; past nodes ticked with sr ", done";
  active node glow. `#event-radar` count 1; "See Event Radar (Beta)" lands it at top 64.
- Flip: MakeMyTrip row translateY 95 -> 134 -> 152 -> 159 -> 162 px over 600 ms, opacity 1 throughout.
  Room stagger delays 0/40/80/120/160/200 ms. Diwali dashed OTA weekday tiles, New Year's Eve
  "Package" tag, "Illustration" pill present; Held rows dashed, lock, "Held back", sr "Agoda held back".
- Interaction: node click jumps (aria-current="step"); ArrowDown/Up/End/Home correct; Play season
  advances at 3.0 s and 6.0 s, stops on keydown, on wheel, and at the last event (aria-pressed false).
  aria-live polite text e.g. "Winter Line Carnival, 25 to 30 Dec, sample event. ... Agoda held back
  until direct sells first, Direct first." Swipe left/right at 390 works; strip snaps (x proximity).
- Tap targets: timeline nodes 292x64, Play 147x48, chips 167 to 281 x 48, Radar link 162x48.
  Focus ring 3 px accent on Tab.
- Reduced motion: 0 sticky elements, no Play button, 6 static cards, 6 "Sample", 6 "Illustration",
  instant (no live region needed).
- Copy: kicker, heading, sub, six dates and decision lines, footer match the brief exactly. No em or en
  dash, "!", rupee sign, "Rs", or digit grouping inside #pulse. No demand prediction beyond brief copy.

## Findings
| id | sev | width/theme | file:line | problem | fix |
|---|---|---|---|---|---|
| V1-01 | medium | 980 to about 1015 wide, any height under about 900 (1000x800, 980x700), both | storyHooks.ts:7; pulse-story.module.css:41-51; pulse-card.module.css:136 | Card container is under 520 px so the card stacks to 806 px inside a `100vh - 72` panel. While pinned, the room grid, caption and progress dots (and at 700 high the Play season button) sit below the fold and can never be seen. At 1280x640 and 1440x620 the card bottom is clipped by 2 to 22 px. | Narrow the timeline column below 1040 (e.g. `minmax(240px, 280px)` and a 24 px gap) so the card gets 520 px, or raise STORY_QUERY to `(min-width: 1040px) and (min-height: 680px)`; fall back to the strip otherwise. |
| V1-02 | medium | 1440 and 980, light | pulse-story.module.css:140-142, 227-230 | Hovered timeline node: `--fill` over `#fbfbfd` gives `#ebebee`; `--ink2` name/date on it is 4.26:1 (axe serious). Happens whenever the pointer rests on a node after clicking. | Hover background `var(--bg2)` (#f5f5f7 gives 4.7:1) or set `.node:hover, .node:hover .nodeDate { color: var(--ink) }`. |
| V1-03 | low | all, both | PlaySeason.tsx:39-41 | Stop handler ignores every event whose target is the Play button except keydown, so a wheel or touchstart over the button keeps auto-play running while the user scrolls (measured: still pressed, advanced one event). | Only exempt `pointerdown` and Enter/Space on the button; wheel and touchstart always stop. |
| V1-04 | low | 390, 760, 980, both | pulse-card.module.css:63-79 | Reserved `.swap` min-height 9.6em leaves about 90 px of blank space between the decision line and the rail for every event (visible in all compact screenshots). | Reserve the measured tallest header per width (about 4 lines of 19 px x 1.32 plus head row) or use `useReservedHeight` on the swap block only. |
| V1-05 | low | all | DecisionCard.tsx:44-49 | Only the incoming header fades in with the 12 px rise; the outgoing content disappears instantly, so it is a fade-in, not a cross-fade. | Wrap in `AnimatePresence mode="popLayout"` with the exiting copy absolutely positioned, or accept and note. |
| V1-06 | low | all | pulse-card.module.css:434-449 | Progress dots transition `width`, the only layout-affecting animation in the section (CLS 0.0007, non-composited). | Fixed 20 px slot per active dot animated with `transform: scaleX()`, or a translateX indicator. |
| V1-07 | low | >= 980, both | storyHooks.ts:23-26; PulseSection.tsx:43-46 | Server snapshot is the mobile strip; desktop swaps to the 6-viewport story after hydration. Harmless on `/` (below the fold), but a `/#pulse` load (header and footer link) lands on the strip first. Note: anchor loads already shift 64 px site-wide (/#desk, /#pricing CLS 1.0 to 2.0, pre-existing, not Pulse). | Render a `min-height` placeholder or decide the layout with CSS media queries and keep both trees until hydration. |
| V1-08 | low | all | DecisionCard.tsx:37-39 | sr-only `cardSummary` repeats the header, decision and channel states that the rows and the live region already read, so linear reading hears the card twice. | Drop it (the live region uses `announce()`), or keep only the channel summary. |
| V1-09 | low | all, light | pulse-card.module.css:17-25 | Walk-in `#c7c7cc` and Travel agents `#aeaeb2` swatches are 1.6 to 2.2:1 on the white rail row; label text carries the meaning so not a WCAG fail, but the swatch reads as empty. | Add a 1 px `--ink3` inset ring in light or darken those two values. |

Out of scope, seen during the run: Hero word spans hydrate with mismatched inline styles under
reduced motion (console error, Hero.tsx framer `initial`), and the globe mount long frame above.
No high findings. Screens: 390/760 strip, 980/1440 pinned at events 0/1/3/4/5, reduced list, all
dark and light, kept in the V1 scratchpad.
