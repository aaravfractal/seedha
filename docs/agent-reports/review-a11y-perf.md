# Accessibility and performance review (master a4dfd05, runtime pass 3)

Reviewer: a11y/perf agent, read-only. Date: 2026-10-11. Playwright chromium + @axe-core/playwright from
apps/web/node_modules; throwaway scripts deleted. Web :3000 and API :8000 both up; sample statements loaded.

## Status: full runtime pass done

- axe WCAG 2.1 A/AA: 11 public routes and 19 owner/guest routes (incl. "/" live flip and /link/DEODAR-RS26 with
  data) x light/dark x 1440/980/760/390 = 240 runs; 9 interactive states x 2 themes x 1440/390 = 36 runs; /otp.
  Best-practice at 1440 light. Tap targets, computed fonts, overflow at 390 (and 1440).
- Demo data touched by the pass (UI only): one consent created through Desk Show QR (guest "Neha Gupta", so
  /proof and /inbox have an entry), /site moved to the Review stage via the setup chat. Reset restores both.
- Side note (not a11y): /link/DEODAR-RS26 shows "That code is not right" on load; the sample code seems already
  redeemed in the demo DB, so the Pay button stays disabled until "Remove code".

## Findings

| id | sev | page/state | selector | problem | measured | fix (file) |
|---|---|---|---|---|---|---|
| A1 | fixed | every page | `lib/fonts.ts` | Google Fonts outage | all routes 200 | done |
| A2-A5 | fixed | auth chip, upload type, bubble foot, site foot | various | were 11-12px | 0 computed text <13px anywhere | done |
| A6 | fixed | inbox Away, cookie dialog | `role="switch"` | missing switch role | present, `aria-checked` correct | done |
| A7 | open (low) | /home insight | `InsightBanner` HI/EN button (`app/(owner)/home/parts.tsx:48`) | state only via label | static | `Segmented` + `aria-pressed` |
| A8 | fixed | ⌘K | `.paletteInput:focus-within` | no ring on input | 3px accent ring via wrapper | done |
| A9 | fixed | dialogs | `useDialogFocus.ts` | focus escape | 0 escapes in 7 dialogs | done |
| A10 | fixed | Desk | `.printBtn` gold ring | | removed | done |
| A11 | fixed | `/` cookie dialog | `CookieConsent.tsx` | focus lost on close | focus returns to "Choose" | done |
| A12, A13 | fixed | website footer at 390 | `.footCol a`, `.bottomLinks a` | 21-33px | now 44px | done |
| A14 | medium | every app-frame page at 390 (all owner screens, /link, /otp, /login, /plans, /onboard...) | `footer.site-footer nav.inner a` (`app/globals.css:713`) | footer links far below 44 | 21px tall, 26-95 wide | `.site-footer a { display:inline-flex; align-items:center; min-height:44px }` |
| A15 | low | auth, /plans, /onboard, /rate-card | `.iconbtn` theme button (`globals.css:318`) | below 44 | 40x40 | `min-width/height: 44px` |
| A16 | low | /flip, /plans, `/` pricing, `/` live flip | `.segWrap .seg .segBtn` (`components/owner/owner.module.css:214`), `.toggle button` (`globals.css:780`), website segmented (`site.module.css`) | segmented buttons below 44 | 40px; `/` live flip 37px | `min-height: 44px` |
| A17 | low | app header; website/app-frame headers | brand link `a[aria-label="Seedha overview"]`, `a.brand` | below 44 | 28x28 owner, 31px tall website | pad to 44 |
| A18 | closed | `/`, /link error | "Try again" | | not reproduced: data loads now | n/a |
| A19 | low | /plans | `.toggle button { transition: all .3s }` (`globals.css:785`) | outline colour fades in over 300ms | 300ms | list properties, not `all` |
| A20 | low (bp) | /plans, /approvals, /savings, /proof | first `h3` | axe heading-order (h1 -> h3) | 1 node each | use h2 |
| A21 | low (bp) | /inbox, /assistant, /link/DEODAR-RS26 | `html` | axe page-has-heading-one | 1 each | add an h1 (can be visually hidden) |
| A22 | low | notifications, account popovers | `AppHeader.tsx:93,190` | trap focus but no `aria-modal` | aria-modal null | add `aria-modal="true"` |
| A23 | **high** | every owner screen at phone width once the sidebar shows an unread count (here Guest inbox after a consent) | `nav.side a.item span.sr-only-text` (`components/shell/Shell.module.css:547,564`) | Whole page scrolls sideways: the absolutely positioned sr-only count escapes the `overflow-x:auto` pill row because `.side`/`.item` are not positioned | scrollWidth 1287-1302 at 390, `scrollX` 899 after scrollTo | `.item { position: relative }` (or `.side { position: relative }`) |
| A24 | medium | /flip light, all widths (and "By bookings"/"By money kept" state) | inactive `.segBtn` (`owner.module.css:222`, `color: var(--ink2)`) | text contrast | 4.07:1 (#6E6E73 on #E6E6E9) | inactive label `color: var(--ink)` or a lighter track; affects every `Segmented` on a fill |
| A25 | medium | /scenario light | `.extraNote` (`app/(owner)/(screens)/scenario/scenario.module.css`) | text contrast | 4.38:1 (#6E6E73 on #E6F1EC, 13px) | `color: var(--ink)` on the tinted note |
| A26 | medium | ⌘K palette light | `.paletteHint` (`components/shell/Shell.module.css`) | text contrast on glass | 4.37-4.41:1 (#6E6E73 on #EEEEF0) | `color: var(--ink)` or opaque palette background |
| A27 | medium | /inbox thread open | `.rowPrev > span` on selected row; `.avatar.big` (`components/inbox/Inbox.module.css:290`) | text contrast | 4.38:1 (#6E6E73 on #E6F1EC); big avatar 3.31:1 light (#6E6E73 on #1D1D1F), 4.41:1 dark (#A1A1A6 on #3A3A3C) | selected row preview `var(--ink)`; big avatar initials `#F5F5F7` on its dark fill |
| A28 | low | light theme dark surfaces | /home insight "Show in English", /pro dark card link, /site phone preview viewport (`components/site/Review.tsx:48`) | pine ring on near-black | 2.62:1 on #1D1D1F, 2.94:1 on #111 (needs 3:1) | on dark surfaces set the ring to dark accent `#4CC38A` (e.g. `--accent` override in those containers) |
| A29 | low | owner screens at 390 | app header `.round` (Back, Search, Notifications, Account) (`Shell.module.css:101`); `.btn.small` (`globals.css:435`): Confirm/Not same (/repeat), Keep it out/Count it anyway (/upload), Open Seedha Desk, Print close slip; inbox filters; assistant chips; scenario steppers; `/` growth input | below 44 | 40px (steppers 44x40, growth input 32px) | `.round` and `.btn.small` `min-height/width: 44px`; repeat and upload decisions are primary actions, use full `.btn` (48) |

Counts: open 1 high (A23), 5 medium (A14, A24-A27), 10 low (A7, A15-A17, A19-A22, A28, A29); fixed or closed 13
(A1-A6, A8-A13, A18).

## Measurements

- axe A/AA: public routes 0 violations. Owner/guest routes: 2 rules-x-page (A24 /flip, A25 /scenario), light
  only. States: flip money (A24), palette (A26), inbox thread (A27 light+dark); notifications, account menu,
  UPI sheet, proof dialog, Desk after Show QR, site Review, cookie dialog: 0. /otp: 0 (1440, 390 light).
- Keyboard (light and dark, 794 Tab stops each over 18 pages): skip link is the first stop on app, guest,
  website and World B pages; Enter on it focuses `main#main`. Header order: Skip, Back, Seedha overview, Owner,
  Front desk, Guest, Search, Notifications, Account, then sidebar. Every stop `:focus-visible` with a 3px
  ring. Ring contrast 5.9-8.9:1 on page/card backgrounds (stops over translucent fills read low in a naive
  calc but are >=5:1 effective); real failures only A28.
- ⌘K: Meta+K focuses the input, 3px ring via `:focus-within`; typing "sav" filters to 1 result; Enter goes to
  /savings.
- Dialogs (Tab and Shift+Tab x(n+2), Escape, focus return): notifications (3 controls), account (8), palette
  (21), UPI sheet (5), proof (2), inbox away dialog (3, 1 disabled), cookie (2 enabled, 2 disabled switches):
  0 escapes, all close on Escape, focus returns to the trigger (palette opened from body returns to main).
- Segmented (aria-pressed): Enter and Space both switch; Inbox Away `role=switch`: Space with no away text
  opens the away-message dialog (by design), `aria-checked` stays false until saved.
- Computed font-size < 13px: 0 on every route and state.
- Overflow at 390: none on public routes; owner screens overflow per A23.
- Reduced motion (emulated): 0 running animations and 0 elements with non-zero animation/transition duration
  at +100ms on /home, /flip, /savings, /upload, /ask, /site, /proof, /inbox, /approvals, /scenario, /desk, /link,
  /; flip row transforms are final at +50ms after toggling (no glide); UPI sheet at +30ms: 0 transitions;
  hero blur-in instant. Savings count-up not exercisable (sample has Rs 0 saved); slip not exercised (needs a
  checkout) but the global rule leaves no transition anywhere.
- Perf (next dev, Turbopack, 1440): time to interactive (navigation start to ranked rows visible and toggle
  enabled) /flip 625 ms cold, 261-330 ms warm; /home (money and step rows visible) 348 ms cold, 182-311 ms
  warm. DCL 43-99 ms. Long tasks over 200 ms: none (max 87 ms owner, 111 ms "/"). Largest JS (decoded, dev):
  react-dom 1027 KB, next client 887 KB, next-devtools 866 KB (shared, dev-only, cached after first page).
  Page chunks 6-32 KB transfer. "/" adds a 138 KB transfer / 917 KB decoded vendor chunk
  (`node_modules_0-b13f3...`, website only).

## Fine

- One 3px accent focus ring everywhere incl. ⌘K, World B and dark; skip link first on every page type.
- All 7 dialogs trap, close on Escape and restore focus; disabled first/last controls handled.
- `aria-pressed` segmented and `role=switch` toggles work from the keyboard.
- No text under 13px; reduced motion is instant across screens, flip, sheets and hero.
- Public pages: 0 axe A/AA issues in both themes at all widths; no horizontal scroll.
- No long tasks; /flip and /home interactive in about a third of a second in dev.
