# V3 · Design and accessibility review (live features, 12 Oct 2026)

Read only. Scratch servers: API 8896 (scratch sqlite, seed), web `next dev --webpack` 3896, both stopped.
Playwright + @axe-core/playwright (wcag2a/aa, 21a/aa, 22aa), light and dark, at 390x844, 390x700,
844x390, 1180x820 and 1440x900. Kiosk states were driven for real (Show QR, consent on the guest page,
check out, paper toggle), and the QR position was also checked with a mocked `desk/poll`.
Proof: local pending, local written, mocked amoy (sent, verified, failed, low balance), mocked local
low_balance, dialog, Settings notice. Calendar: sheet empty, field errors, over limit, 503, results with
mocked rejected rows, "Not saved", owner card, Hindi preview, Delete confirm.

What passes: no sideways scroll anywhere. Axe is clean on every screen and state except K2. Focus ring
(3px accent) shows on every control. Sheet and proof dialog trap Tab, close on Escape and return focus
(Add events and the entry row). After Save and Delete, focus lands on Add events. Kiosk has one main,
a polite live summary ("Thank you, Kritika ji. Consent saved."), the ring is still under reduced motion,
and no animation runs at idle. Hindi bubble has lang="hi" and Mukta. Segmented sets aria-pressed.
No em dashes or exclamation marks in the reviewed copy.

## Findings

| id | sev | screen / width / theme | file:line | problem | suggested fix |
|----|-----|------------------------|-----------|---------|---------------|
| K1 | high | /desk/device QR, 844x390 and 667x375 landscape phone, both themes | components/desk/Kiosk.module.css:27-32, 404-412 | The QR is cut off at the bottom: it ends at 419px on a 390px screen (396 on 375). The top bar wraps to 2 rows (83px) and the 2-column grid still applies above 820px, so the guest has to scroll to scan. Landscape phone is the main kiosk target. | In `(orientation: landscape) and (max-height: 500px)`: keep the top bar on one row (hide the hotel name and awake line, use icon or short labels), set `.qr { width: min(calc(100dvh - 150px), 34vw) }`, or hide `.side` while a QR is showing. Add an e2e check that the QR box bottom is at or above innerHeight at 844x390. |
| K2 | high | /desk/device slip, every width up to 1180 (fine at 1440), both themes | Kiosk.module.css:304-328; Kiosk.tsx:352-354 | The 32-column receipt is wider than the side card. Amounts are clipped ("Rs 4,30", "-Rs 51" at 844) and the footer line is cut ("keeps it al"). The `figure` scrolls sideways but cannot get focus. Axe: scrollable-region-focusable (serious). | Fit the receipt to its width: `font-size: clamp(11px, calc((100cqi - 28px) / 19.5), 14px)` with `container-type: inline-size` on `.slipCard`, or `white-space: pre-wrap` for lines after the second rule. If it still scrolls, add `tabIndex={0}` to the figure (its aria-label is already set). |
| K3 | medium | /desk/device staff panel and slip, all widths | Kiosk.tsx:355-361, 435-451; globals.css:435 (`.btn.small` 40px) | "Show QR", "Check out and print" and "Put the slip away" are 40px tall on a touch kiosk. The top tools were raised to 44px, these were not (spec: 48, 44 for dense). | Extend `.tools :global(.btn){min-height:44px}` to `.side :global(.btn)`, or use `btn` (48px) for the staff actions. |
| P1 | medium | /proof, after "Write tonight's proof", all widths | app/(owner)/(screens)/proof/page.tsx:109-117 | After a write, nothing is pending, so the button becomes `disabled` and focus drops to `<body>`. Keyboard and screen reader users lose their place (the toast is announced, but Tab restarts at the top). | After success, focus the new bundle's heading (`#bundle-<id>`, tabIndex -1). Or keep the button focusable with `aria-disabled` instead of `disabled`. |
| C1 | medium | /calendar Add events sheet, results view, 390 touch | components/settings/Modal.tsx:28-41; components/calendar/AddEventsSheet.tsx:246-269 | The sheet has no visible close control. In the results view the only actions are Save and Edit notice, so a touch user can leave only by tapping the thin scrim above the sheet (Escape is keyboard only). The input view has Cancel. | Add a Cancel or Close button to the results actions. Better: give Modal a visible 44px close button in the header, which also helps every other settings sheet. |
| C2 | low | /calendar Delete confirm, all | app/(owner)/(screens)/calendar/page.tsx:378-388 | The alertdialog opens with focus on the destructive "Delete event", so Enter deletes right away. | Put "Keep it" first in DOM order, or focus it on open (useDialogFocus takes the first focusable). |
| C3 | low | Add events sheet, empty submit | AddEventsSheet.tsx:151-161 | The "Paste the notice text first." error is announced by the live div but is not in the textarea's aria-describedby, and focus stays on Read events. | Give the error an id, add it to aria-describedby when shown, and focus the first invalid field on submit. |
| C4 | low | Morning preview, Hindi, 390 and 1440 | components/calendar/MorningPreview.tsx:74 (ui.bubble) | The bubble text is 15px. Devanagari at 15px reads small next to the 17px body (FRONTEND_MASTER: body 17). | `.waBubble:lang(hi){font-size:17px;line-height:1.6}`. |
| K4 | low | /desk/device green ring, dark | Kiosk.module.css:4, 141-155 | The pulse and the reduced-motion halo use hard-coded light gain rgba(31,138,85), and `--ring-white` is a raw #8e8e93, not `--hint`. In dark the halo is a darker green than `--gainFill` #4cc38a. | Use `color-mix(in srgb, var(--gainFill) 45%, transparent)` and `--ring-white: var(--hint)`. |
| K5 | low | /desk/device top tools | Kiosk.tsx:241-252 | "Sound off/on" and "Full screen/Exit full screen" change their label and also set aria-pressed, so a screen reader hears "Sound on, pressed" and "Sound off, not pressed". | Keep a fixed label ("Sound", "Full screen") with aria-pressed, or drop aria-pressed and keep the changing label. |
| K6 | low | /desk/device, dark | globals.css:431-434 (`.btn.ghost`) | Ghost buttons are #111113 on #000, so their edges barely show (about 1.1:1). The kiosk has no other affordance for them. App-wide pattern. | Kiosk only: `.tools :global(.btn.ghost){background:var(--card)}` or a `--line` border. |
| P2 | low | /proof bundles | proof/page.tsx:197; ProofChainCard.tsx | Every bundle status `<p>` is its own aria-live region. A Refresh announces the status line and the toast, so it is read twice. Copy address always toasts "copied", even when the clipboard write fails. | Drop aria-live on the status lines (the toast already announces). Toast "copied" only when the writeText promise resolves. |
| P3 | low | /proof entries of a local "Stored on Seedha" bundle | proof/page.tsx:231-234 | Entry chips say "Verified" under a bundle that says "Stored on Seedha", next to bundles that say "Verified on Polygon Amoy testnet". Readers may take it as on-chain verified. (V2 territory.) | Use "Sealed" or "Checked on Seedha" for local bundles, and keep "Verified" for the chain. |

Out of scope and noted only: the Next dev badge covers the bottom-left sheet buttons at 390 (dev only).
One axe hit on the shell sidebar label in dark came from my mid-run theme switch, not a real state.
