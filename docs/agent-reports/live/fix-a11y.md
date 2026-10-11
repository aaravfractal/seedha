# Fix: live design and accessibility findings (12 Oct 2026)

Source review: docs/agent-reports/live-design-a11y.md. Web only; no money code, API, loop or Pulse files touched.

## What changed
- K1 (Kiosk.module.css, Kiosk.tsx): in `(orientation: landscape) and (max-height: 500px)` the top bar stays
  on one row (hotel name hidden, link status shows a short word; the full sentence stays for screen readers),
  tighter frame, QR row layout kept below 820px wide, QR `width: min(calc(100dvh - 140px), 40vw)`, and while a
  QR shows (`data-screen="qr"` on the kiosk root) the side panel and awake line step aside.
- K2: `.slipCard` is a size container; the receipt font is `clamp(9px, calc((100cqi - 32px) / 19.8), 14px)`,
  so the 32 columns fit, and `pre-wrap` wraps the longer footer lines. New `Receipt` component adds
  `tabIndex=0` only if it ever scrolls sideways (ResizeObserver).
- K3: every `.btn.small` in the kiosk is at least 44px (`.kiosk :global(.btn.small)`).
- K4: ring glow uses `color-mix` of `--gainFill`; `--ring-white` is `var(--hint)`.
- P1 (proof/page.tsx): bundle headings get `tabIndex=-1`; after a write, focus moves to the new bundle heading.
- P2: status lines lose `aria-live` (the toast announces); "Wallet address copied" only when writeText resolves,
  otherwise "Could not copy the address".
- C1 (AddEventsSheet.tsx): results view has a visible Cancel (48px); input view already had one. Focus return kept.
- C2 (calendar/page.tsx): "Keep it" comes first, so the delete confirm opens on the safe choice.
- C3: empty or over-limit error has an id in the textarea's aria-describedby; submit focuses the first bad field.
- e2e/desk-kiosk.spec.ts: slip fits (or is focusable) at 320, 390, 844, 1180; new test that the QR is fully
  inside the viewport at 844x390.

## Verification (API 8897 scratch sqlite, next dev --webpack 3897, both stopped)
- QR: 844x390 bottom 364 of 390; 667x375 bottom 349 of 375 (top bar 44px, one row); 390x844 bottom 648;
  1180x820 bottom 658. No sideways scroll. Axe clean with QR at all four.
- Slip: scrollWidth equals clientWidth at 320 (11px), 390 (14px), 844 (12.2px), 1180, 1440; no tabindex
  needed. Axe (wcag2a/aa, 21a/aa, 22aa) clean with the slip at every width, light and dark.
- Kiosk button heights: Sound, Full screen, Simulated: no paper, Put the slip away, Show QR, Check out and print
  all 44px.
- /proof: after Write tonight's proof, focus is on H2 #bundle-1.
- Calendar sheet at 390: empty submit focuses the textarea, described by "Paste the notice text first."; Cancel
  visible in input and results views; Cancel closes and focus returns to Add events.
- Playwright against the scratch servers: desk-kiosk.spec.ts 4/4, events.spec.ts 3/3, proof-live.spec.ts 4/4.
- Checks: next typegen, tsc, eslint (0 warnings), prettier, node --test lib (139 pass) all pass.

Not done: C4, K5, K6, P3 (lows outside the brief).
