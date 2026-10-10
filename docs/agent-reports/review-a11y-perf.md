# Accessibility and performance review (P1 to P4, master 8e02dae + working tree)

Reviewer: a11y/perf agent, read-only. Date: 2026-10-10.

## Status: runtime pass BLOCKED, static pass done

The dev server at http://localhost:3000 returns **HTTP 500 for every route** (`/`, `/login`,
`/privacy`, `/api/session`; only `/favicon.ico` is 200). Polled for 2+ minutes; it did not
recover. `apps/web/.next/dev/logs/next-development.log` shows, on every request:

```
[next]/internal/font/google/mukta_23a1471d.module.css:34:8
Error: Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'
Warning: Connection timed out when requesting https://fonts.gstatic.com/s/mukta/v17/...woff2
```

`lib/fonts.ts` uses `next/font/google` (Mukta). The `next dev` process (Turbopack, port 3000)
cannot reach fonts.gstatic.com, while the same URL returns 200 in 0.3 s from my shell. So the
server process has no network (sandboxed or offline when started). The `--webpack` server on
:3207 is the site worktree at 4c726fc (P1 only), so it is not master and I did not use it.
I was told not to start or stop servers, so axe, keyboard, tap target, overflow, reduced-motion
computed-style and timing measurements (tasks 1 to 3, 5 to 7) could not be run. The scan script
is ready; once :3000 serves pages, resume me and I will finish the runtime pass.

## Findings

| id | sev | page/state | element (selector) | problem | measured | fix |
|---|---|---|---|---|---|---|
| A1 | high | every page | `app/layout.tsx` -> `lib/fonts.ts` `Mukta()` | App is down when the Next process cannot reach Google Fonts. Same failure would hit `make demo` on venue wifi (hackathon) or any offline `next dev`. Demo-breaking. | 500 on all routes | Vendor Mukta woff2 (400/600/700, devanagari+latin) into `apps/web/app/fonts/` and switch to `next/font/local`; keeps CSP `font-src 'self'`. Short term: restart :3000 with network. |
| A2 | medium | /login, /signup, /otp | `.betaChip` (`app/(app)/login/auth.module.css:152`) | "Beta" chip text below 13px floor | 12px | `font-size: 13px` |
| A3 | medium | /upload (file list) | `.type` (`app/(owner)/(screens)/upload/upload.module.css:71`) | File type badge (PDF/CSV/XLSX) below 13px | 12px | `font-size: 13px` |
| A4 | medium | /site chat, /approvals sent bubbles | `.bub .foot` (`app/globals.css:1137`) | Bubble footer ("Sent (simulated)", "Seedha") below 13px and opacity .75 lowers contrast further | 12px, opacity .75 | `font-size: 13px`; drop opacity, use `color: var(--ink2)` |
| A5 | medium | /site preview, /my-place | `.hs .foot` (`app/globals.css:1326`, used by `components/SitePreview.tsx:105`) | "Made with Seedha · sample hotel" below 13px; this is the sample-data label (rule 11) so it must be legible | 11px | `font-size: 13px` |
| A6 | medium | spec | toggles | Spec requires `role=switch` on toggles; there is **no `role="switch"` anywhere** in app/ or components/. Binary on/off controls are rendered as buttons/segmented groups (OK where they are segmented with `aria-pressed`). Any future on/off (inbox "Away · bot on", Pro settings) must use it. | 0 occurrences | When an on/off control lands, use `<button role="switch" aria-checked>`; add a shared `Switch` in `components/owner/ui.tsx` |
| A7 | medium | /home insight banner | `InsightBanner` button (`app/(owner)/home/parts.tsx:48`) | HI/EN language switch is a plain button whose label flips; state is conveyed only by label change. Acceptable, but inconsistent with spec (segmented `aria-pressed` for language on /site). | n/a | Either keep (label describes action) or use `Segmented` with `aria-pressed` like /site Language |
| A8 | low | ⌘K palette | `.paletteInput input:focus-visible { outline: none }` (`components/shell/Shell.module.css:482`) | Palette input has no visible focus ring and its wrapper has no `:focus-within` ring (login `.phone` does this correctly). Caret only. | outline 0 | Add `.paletteInput:focus-within { box-shadow: inset 0 -3px 0 var(--accent) }` or similar 3px indicator |
| A9 | low | all dialogs | `components/useDialogFocus.ts` | Tab trap only wraps when focus is on first/last item; if focus escapes (click on dialog padding/backdrop then Tab), Tab goes to the page behind. | static read | In `onKey` Tab branch: if `!dialog.contains(document.activeElement)` then focus `first` and `preventDefault()` |
| A10 | low | Desk print button | `.printBtn:focus-visible { outline-color: #e8a33d }` (`components/desk/Desk.module.css:253`) | Gold focus ring is outside the "accent ring" rule and gold is reserved for money saved | n/a | Use the accent ring, or document as device-skin exception |

## Measurements (static)

- Global focus ring: `:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px }`
  (`app/globals.css:196`). Matches the 2 to 3px spec. Overrides to `outline: none`: palette input
  (A8), login phone input (compensated by `.phone:focus-within` 3px ring), `main:focus` (fine, it
  is the skip-link target).
- Text under 13px in CSS: 4 rules (A2 to A5). Inline styles: smallest `fontSize: 13`
  (`SitePreview.tsx:95`). No em/rem/% font sizes found.
- Reduced motion: global `@media (prefers-reduced-motion: reduce) { *, *::before, *::after
  { animation: none !important; transition: none !important } }` (`app/globals.css:724`), plus
  module overrides in auth, ask, scenario, approvals, upload, owner.module.css. JS motion honours
  it: `useCountUp` returns the target immediately (`components/owner/motion.ts`), flip and ask use
  `useReducedMotion`, Desk chime and LinkBooking check the media query. Not verified at runtime.
- `aria-pressed`: shared `Segmented` (`components/owner/ui.tsx:97`), plans billing toggle, /site
  Look and Language, LinkBooking, guest pages. `aria-live`: toasts (`components/Toast.tsx`),
  ask chat, home, flip, scenario, site, upload, desk, otp, consent, link.
- `aria-modal` + Escape + focus return: SessionDialogs (idle, expired), CommandPalette,
  LinkBooking UPI sheet, ProofDialog via `useDialogFocus`; header popovers use the same hook.
- Performance (task 7): not measured, server down.

## Fine (static)

- One focus-ring rule, 3px accent, offset 2px; skip link present in globals.
- Segmented controls use real `<button>`s with `aria-pressed` inside `role=group` with a label;
  the sliding pill is `aria-hidden`.
- Dialog hook moves focus in, traps Tab, closes on Escape, restores focus on close.
- Idle "expired" dialog intentionally has a no-op Escape (forces sign-in): acceptable.
- Count-up, flip glide, chime and slip respect reduced motion in code.

## Not yet checked (needs :3000 up)

axe A/AA and best-practice on 27 routes x light/dark x 1440/980/760/390 and the listed states;
keyboard walk (skip link, header, sidebar, palette filter/Enter); measured outline widths;
tap targets at 390; computed font sizes (catches inherited sizes the CSS grep cannot); computed
animation/transition durations under reduced motion; horizontal overflow at 390; /flip and /home
time-to-interactive, largest JS chunks, long tasks over 200 ms.
