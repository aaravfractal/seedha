# B5 status: interactive Pro page (POLISH_BUILD C)

Branch polish/pro-b5. Nothing committed. Done.

## Files
- `apps/web/app/(owner)/(screens)/pro/page.tsx`: ten ExpandCards (3 big dark, 7 small) inside one framer-motion
  `LayoutGroup`; one open id in state. One quiet tag per card: Sample (audit when `audit_sample`, pulse, rate-watch,
  discount-split, khata, rollup), Illustration (floor, displacement), none (tonight, proof). Pro pill on every card.
- `apps/web/app/(owner)/(screens)/pro/pro.module.css`: card grid (`grid-auto-flow: dense`, the open card spans the
  row), trigger, panel and the B5 view styles.
- `apps/web/components/pro/ExpandCard.tsx`: the whole summary is one `<button>` (aria-expanded, aria-controls
  `pro-<id>-view`, id `pro-<id>-trigger`). The open region has role=region and is labelled "<name>, live view"
  (testid `pro-view-<id>`). Escape and the "Close <name>" button collapse it and focus the trigger. `layout`
  animation at 450ms on the app curve, panel fades in. Reduced motion: layout off and duration 0. When closed, a
  hidden empty div keeps the aria-controls target. The panel always uses the `--card` surface, so B6 views read
  the same on dark and light cards.
- `registry.ts`: unchanged (no change was needed).
- Views: AuditView (GET /statements flagged rows and over-rate lines, GET /statements/disputes RecoverTotals, the
  first dispute that carries an audit claim as a Recover draft with Copy, "Open the disputes" -> /upload#disputes;
  before any upload it shows "Upload statements"). PulseView (lib/pulse.ts timeline with aria-pressed event buttons,
  decision and channel states, no rupees, "It is a channel decision. It does not predict demand."). RateWatchView
  (two price tiles, the gap computed in lib code, "From your screenshot. No scraping."). TonightView (last
  /rooms/nights entry: rooms_total - rooms_sold; highest net ADR from /ledger/channels skipping null, plus the best
  OTA; CalcNote). ProofView (/proof proven, pending, latest bundle status via istStamp, link /proof).
- `apps/web/lib/proSample.ts` + `proSample.test.ts`: Rate Watch sample (Agoda Rs 3,950 vs direct Rs 4,300),
  `parityGap`, `parityLine`, `rateWatchHeadline`, `tonightCard`. 5 node tests.
- `apps/web/e2e/pro-cards.spec.ts`: all ten expand and collapse (Escape and Close), focus returns, one open at a
  time, B5 content, reduced motion instant, axe clean with a card open in light and dark.

## Verified
- typegen, tsc, eslint (0 warnings), prettier --check, node --test lib/*.test.ts (155 pass).
- pro-cards spec 5/5 against next dev on 3901 and an API on 8901 with a scratch DB (six sample statements loaded).
- Axe (wcag2a/aa) clean with audit, pulse, rate-watch, tonight, proof and floor open, at 1440 and 390, light and
  dark. No visible target under 44px. Screenshots checked at both sizes and in both themes.

## Notes for the lead and B6
- The card already shows the Sample or Illustration tag, so B6 views do not need a second pill.
- B6 views render inside `.panel` (padding 18px, `--card` background, `--ink` text).
- No API change needed.
- Rate Watch big-card headline now comes from `lib/proSample.ts`. The text is unchanged.
