# Design QA review

11 Oct 2026, read-only, master. Pass 1 covered the public pages while the API was down. Pass 2 (after the lead
fixed the API) covered every other requested screen at 1440 and 390, light and dark. Shots are in
`docs/agent-reports/design-qa/` (light 1440 unless named). Skipped: /calendar, /billing, /settings.
Older-shell references (tab pills, page-10 Fig 12 to page-17) are compared for content only.

**Data state at review time:** `apps/api/seedha.db` has 0 `direct_booking` and 0 `perk_code` rows, so the
four D9 coded bookings (D-080) are missing. That explains O1, S1 and I1. `seed/load.py` loads them, so the
live DB was not built by `make seed`. Fix: rebuild it with `make reset && make seed` and re-check.

## Shell (all owner screens; page-09, owner-01, owner-08)
| id | sev | difference | intentional? | fix | file |
|---|---|---|---|---|---|
| SH1 | medium | Phone pill row does not scroll to the active screen. On /flip at 390 the pills show "Overview, My Place, Guest inbox" and "Money kept" is off screen (`e-flip-390.png`) | no | `scrollIntoView({inline:"center"})` on the `aria-current` pill at mount | `components/OwnerSidebar.tsx` |
| SH2 | low | At 1440x900 the "Open Seedha Desk ↗" card sits below the fold; only its dashed top edge shows (the sidebar scrolls) | no | tighten item min-height (44 to 40) or gap so the card fits at 900px | `components/shell/Shell.module.css` (.side, .item) |
| SH3 | low | Page titles differ by screen: Inbox and Assistant about 40px, other screens about 44px. Website content runs to 1410px; other screens stop at 1370px | no | one title token and one max-width for all owner screens | `components/owner/owner.module.css`, `components/site/owner.module.css` |

## Overview /home (page-09, page-10; owner-01, 06 to 10)
Shots: `home-light-1440.png`, `home-dark-1440.png`, `e-home-waterfall-390.png`.
| id | sev | difference | intentional? | fix | file |
|---|---|---|---|---|---|
| O1 | high | Gold tile shows "₹0 / No coded direct bookings yet"; the design shows ₹12,600 and "4 coded direct bookings" | no (D9, D-080 require it) | reseed the live DB (see data state) | data |
| O2 | medium | At 390 the waterfall labels collide: "DiscountCommission", "GST on comm." overlaps "−1.5L" | no | wrap labels in fixed-width cells with `overflow-wrap:anywhere`, or use 2-letter labels below 420px | `app/(owner)/home/parts.tsx`, `overview.module.css` |
| O3 | low | Insight reads "…par 4 channels ne har room par zyada paisa chhoda." Handoff wording is "…sabse kam paisa chhoda." | yes: data-true, because MakeMyTrip ranks 5th of 6, not last (`services/insight.py`) | record in decisions.md | `apps/api/app/services/insight.py` |
| O4 | low | Room grid numbers 101 to 112 and 201 to 210; reference uses 101 to 111 and 201 to 211 | no | align the sample room list to the reference | `apps/api/seed/` rooms |
| O5 | low | Net kept tile sub reads "75.1% of ₹63,05,000 list revenue"; reference reads "of ₹63,05,000 list revenue" | addition | keep, or drop the % to match | `home/parts.tsx` |

## Upload (page-11) — `upload-light-1440.png`
Matches the design: drop zone, 6 file rows with pine bars, "✓ 1,500 rows matched. 3 need a look.", "⚠ Check" tags, "See my real money". No gaps.

## Money kept /flip (page-11, page-12) — `flip-light-1440.png`, `flipmoney-light-1440.png`, `e-flip-390.png`
| id | sev | difference | intentional? | fix | file |
|---|---|---|---|---|---|
| F1 | medium | "Paid to channels" stat shows red "₹10,39,108" with no minus sign (Overview shows "−₹10,39,108") | no (loss always carries a minus, section 2) | prefix "−" | `app/(owner)/(screens)/flip/page.tsx` |
| F2 | low | By-bookings right column shows room nights (620) as the big number with "room nights · ₹26,04,000 list"; reference shows "₹26,04,000 / list revenue". Rows say "lost vs list price"; reference says "paid away" | partly (P2 column header) | confirm in decisions.md | `flip/page.tsx` |
| F3 | low | Ring on MakeMyTrip in money mode, toast "MakeMyTrip drops from 1st to 5th", before/after Direct bar and "Build one ›" all present | yes | none | |

## Repeat guests (page-12) — `repeat-light-1440.png`
| R1 | low | Cards in a row stretch to equal height, so the Neha card has empty space under its chips | no | `align-items:start` on the grid | `app/(owner)/(screens)/repeat/` |
|---|---|---|---|---|---|
Otherwise matches: 12 / −₹41,800 tiles, chips, Confirm / Not same under 80%, privacy note, "Confirm matches".

## Saturday move (page-13) — `scenario-light-1440.png`
Matches: verbatim sentence, before/after bars, +₹10,110 tile, Accept / Not now. Added: a "Rooms to hold" stepper. No gaps.

## Approvals (page-13) — `approvals-light-1440.png` (empty), `flow-approvals-light-1440.png` (after Desk consent and checkout)
| id | sev | difference | intentional? | fix | file |
|---|---|---|---|---|---|
| A1 | medium | Draft reads "…Code DEODAR-RS26: http://localhost:3000/link/DEODAR-RS26 Reply STOP to opt out." There is no full stop between the link and "Reply STOP"; the handoff reads "Code DEODAR-NG26. Reply STOP to opt out." | no | `f"Code {code}: {link}. {STOP_LINE}"` or put STOP on a new line; update the validator | `apps/api/app/services/drafter.py` line 60 |
| A2 | low | Meta row uses chips (English, Perk, Code); the reference uses plain grey text. The chips read better | yes (improves the reference's wrap defect) | none | |
Empty state copy matches ("No guests waiting." / "New drafts appear after checkout." / "Open Seedha Desk").

## Savings (page-14) — `savings-light-1440.png`
| id | sev | difference | intentional? | fix | file |
|---|---|---|---|---|---|
| S1 | high | Gold hero shows ₹0, "0 coded direct bookings", no ledger rows and no Season in review card. Design: ₹12,600, 4 rows | no (D9) | reseed (see data state) | data |
| S2 | low | Label "Commission saved with perk codes"; reference "Commission avoided this season" | no decision | use the handoff label | `app/(owner)/(screens)/savings/page.tsx` line 22 |
| S3 | low | Empty sub "0 coded direct bookings · Calculated…" | no | say "No coded direct bookings yet" when the count is 0 | `savings/page.tsx` |

## Ask on WhatsApp (page-14) — `ask-light-1440.png`
Matches: black header "Seedha / Business account", 8 AM line, "From your statements", six chips, EN/HI toggle. No gaps.

## Assistant (page-15) — `assistant-light-1440.png`
| AS1 | low | Suggestion chip row is clipped at the card edge ("H…") with no fade or scroll hint | no | add a mask-image fade on the right edge | `app/(owner)/(screens)/assistant/` |
|---|---|---|---|---|---|

## Consent proof (page-16) — `proof-light-1440.png`
| id | sev | difference | intentional? | fix | file |
|---|---|---|---|---|---|
| P1 | low | Four stats sit in a 2x2 grid; the reference puts them in one row of four at desktop | no | `grid-template-columns:repeat(4,1fr)` at >=980px | `app/(owner)/(screens)/proof/` |
| P2 | low | With 0 consents there are no bundles or proof-dialog states to compare | data | re-check after a consent and "write tonight's proof" | |

## Pro (page-16) — `pro-light-1440.png`
| id | sev | difference | intentional? | fix | file |
|---|---|---|---|---|---|
| PR1 | medium | Audit card reads "Commission on 1 cancelled stay and a higher rate than your contract on 0 rows." That reads oddly, and the card has no "Sample" chip while Pulse and Rate Watch do | partly (D10 wants a Sample label on Audit) | drop the clause when the count is 0; add the Sample chip if any part is sample | `app/(owner)/(screens)/pro/` |
| PR2 | low | "Who Paid the Discount" title wraps and pushes the Pro chip down | no | `flex:1; min-width:0` on the title with the chip `flex:none` and aligned to the top | same |

## Website /site (page-22, page-25; owner-03 to 05) — `site-light-1440.png`, `sitePackages-light-1440.png`, `siteGooglekit-light-1440.png`
| id | sev | difference | intentional? | fix | file |
|---|---|---|---|---|---|
| WS1 | low | No "‹ Back" link above the eyebrow | no | add it (to /home) | `components/site/` owner header |
| WS2 | low | Empty-state H2 "Your hotel, online in 10 minutes." wraps to 2 lines at about 56px; reference is one line at about 40px | no | cap at `clamp(32px,3.2vw,44px)` | `components/site/owner.module.css` |
| WS3 | low | Package tag "✦ Suggested from your bookings" vs "✦ AI suggestion"; package cards in a row have unequal heights | wording likely deliberate (clearer) | `align-items:stretch` with the buttons pinned to the bottom | same |

## Guest inbox (page-18, owner-02) — `inbox-light-1440.png`
| I1 | medium | Inbox is empty ("No guest conversations yet."); the reference shows 5 consented threads (Neha, Kapoor, Bisht, Arjun, Iyer) | data (D9 guests missing) | reseed; then re-check the thread, bubbles, voice note, booking card and suggestions | data |
|---|---|---|---|---|---|

## Desk (page-19 to 21; desk-01, desk-02) — `desk-light-1440.png`, `flow-consent-light-1440.png`, `flow-slip-light-1440.png`
| id | sev | difference | intentional? | fix | file |
|---|---|---|---|---|---|
| D1 | medium | Guest phone frame shows the whole guest page, including the site footer link list and "hackathon prototype" line, inside the phone | no | render the consent route without AppFrame footer when embedded (`?embed=1`), or hide the footer for /consent | `app/(app)/desk/page.tsx` line 211, `components/AppFrame.tsx` |
| D2 | medium | In the idle state the caption "Desk box (simulated in the browser)…" is hidden under the device; only "De" peeks out | no | give the device wrapper bottom margin for the slip slot, or move the caption below the controls | `components/desk/Desk.module.css` |
| D3 | low | H1 wraps to 2 lines at 1440 (the container is about 1080px wide); reference is one line | no | widen the desk container to about 1200px or reduce the title clamp | same |
| D4 | low | LED stays green while printing (D4); reference D4 is white or neutral | no | white LED for the printing state | `components/DeskDevice.tsx` |
| D5 | low | Checkout enabled before consent | yes (D-081) | none | |

## Seedha Link and UPI sheet (page-22) — `flow-link-light-1440.png`, `flow-upi-light-1440.png`
| id | sev | difference | intentional? | fix | file |
|---|---|---|---|---|---|
| L8 | low | Valid-code line "Free breakfast on your next direct stay. Your code is valid." vs "✓ Free breakfast added for Neha ji"; button "Pay ₹8,600 with UPI" vs "Pay with UPI" | wording choice | optional | `components/LinkBooking.tsx` |
| L9 | low | Sheet button text "Pay  ₹8,600" has a double space | no | trim | same |
| L10 | low | /link/DEODAR-RS26 before checkout shows "That code is not right." and disables Pay. That matches the code rules; the page is fine once the code exists | yes | none | |
The UPI sheet matches: Google Pay, PhonePe, Paytm, "UPI fee 0.4% is paid by the hotel, not you."

## Hotel site (page-26, page-27; hotel-site-01 to 05) — `hotel-pine-light-1440.png`, `v-hotel-sky.png`, `v-hotel-stone.png`, `v-hotel-hi.png`
| id | sev | difference | intentional? | fix | file |
|---|---|---|---|---|---|
| H1 | resolved | Developer error copy (pass 1); the lead reports neutral copy now | fixed | | |
| H3 | medium | Latin body text renders in the system grotesk; the design uses a humanist sans (Mukta Latin). Only Mukta's Devanagari subset is bundled, so `--wb-text` falls through for English. This also affects the rate card and agent deck | no (spec: mood font + Mukta) | bundle Mukta Latin 400/600 woff2 in `lib/fonts` and add it to `--wb-text` | `apps/web/lib/fonts-worldb.ts`, `components/site/worldb.module.css` line 22 |
| H4 | low | Hero "Book directly" white pill inherits the hero text-shadow, so its label looks smeared | no | `text-shadow:none` on the button | `worldb.module.css` |
| H5 | low | Rooms order Family Suite, Deluxe, Standard and booking bar default "Family Suite"; reference leads with Deluxe Valley View | no | sort by the owner's order or put Deluxe first | site data |
| H6 | low | Packages shows "Packages coming soon." because none are approved yet (state allowed by SCREENS) | yes | none | |
Moods (Pine Cormorant, Stone DM Serif, Sky Outfit) and Hindi (Mukta, "सीधे बुक करें", "नमूना फोटो") look right. World B ignores the app theme in dark mode, which is correct.

## Rate card and agent deck (page-28 to 31; rate-card-01, agent-deck-01) — `ratecard-light-1440.png`, `agentdeck-light-1440.png`
| RC1 | low | Font as H3. Room order differs (Family Suite first). Deck cover sub reads "…with the valley at your window. 22 rooms. For…"; reference reads "A quiet 22-room stay above Mall Road. For travel agents, companies and wedding groups." | no | use the reference sentence | `components/site/` deck |
|---|---|---|---|---|---|

## /login, /signup (page-07, page-08) — `login-light-1440.png`, `login-dark-390.png`, `signup-light-1440.png`
| id | sev | difference | intentional? | fix | file |
|---|---|---|---|---|---|
| L1 | medium | Background glows clipped to a box with hard edges at x≈180, x≈1260 and y≈848 | no | full-bleed `.stage::before` (fixed layer outside the max-width main) | `app/(app)/login/auth.module.css` |
| L2 | medium | App header and footer around the auth card; the reference is a bare stage | partly (D-084) | bare frame for auth routes | `app/(app)/layout.tsx`, `components/AppFrame.tsx` |
| L4 | low | Card has a 1px border; the reference uses shadow only | no | drop the border in light mode | `auth.module.css` |
| L5 | low | Extra divider "or sign in with your number" | no decision | keep, and record it | `app/(app)/login/page.tsx` |
| L6 | low | At 390 dark the glow shows as side stripes | no | as L1 | `auth.module.css` |

## / public website (page-02 to 06; marketing-01 to 12) — `sec-web-00.png`, `pw-light-1.png`, `wd-1.png`, `wd-2.png`, `wd-4.png`, `wd-5.png`, `sec-web-06.png`, `sec-weblight-09.png`, `sec-web390-00.png`
| id | sev | difference | intentional? | fix | file |
|---|---|---|---|---|---|
| W1 | resolved | API-down message and missing sections (pass 1); sample now always served | fixed | | |
| W2 | medium | Hero H1 wraps to 2 lines at 1440; reference is one line | no | lower the desktop clamp max | `components/website/site.module.css` |
| W3 | medium | Footer is a black band in the light theme; reference footer is light. SCREENS.md says "Footer (dark…)", which conflicts with the screenshot | conflict | settle in decisions.md | `WebsiteFooter.tsx` |
| W11 | low | Product window: KPI row is a bordered box with bold values, and flip rows are white with borders; reference uses plain hairline columns with medium-weight values and grey #EDEDED rows | no | match the reference fills and weights | `components/website/Hero.tsx`, `site.module.css` |
| W12 | low | Metrics columns are unequal width (₹10,39,108 crowds column 1) | no | `grid-template-columns:repeat(4,1fr)` | `components/website/Metrics.tsx` |
| W13 | low | Guest map is a 2D city list with "3D view coming soon" | yes (D13) | none | |
| W6 | low | Pricing lists trimmed vs reference; "The Desk is included with yearly plans." missing | partly D8 | record or add the note | `Pricing.tsx` |
| W7 | low | Footer links differ (no Pitch deck, Design system, Desk and guest, Security review) | likely | record | `WebsiteFooter.tsx` |
| W9 | low | Cookie banner covers about 40% of the phone hero | no | compact phone layout | `CookieConsent.tsx` |
| W4, W8, W10 | low | Logo tile in header; "Planned" badges (D8); dots and marquee correct (D14) | W8 and W10 yes | none | |
Flip explainer, "Green is kept" (D14), growth calculator ("Illustration…") and count-up metrics render with API data.

## Top 10 gaps
1. O1, S1, I1 high/medium: the live DB lacks the D9 coded bookings and sample inbox guests; reseed (`make reset && make seed`).
2. D1 medium: Desk guest phone frame shows the full site footer inside the phone.
3. A1 medium: win-back draft has no full stop between the link and "Reply STOP to opt out."
4. H3 medium: World B Latin body text is not Mukta (only Devanagari subset bundled); affects site, rate card and deck.
5. O2 medium: Overview waterfall labels collide at 390.
6. F1 medium: flip "Paid to channels" red figure has no minus sign.
7. SH1 medium: phone pill row does not reveal the active screen.
8. D2 medium: Desk caption hidden under the device in the idle state.
9. PR1 medium: Pro Audit card copy "on 0 rows" and no Sample chip (D10).
10. W2, L1, L2, W3 medium: hero H1 wraps; auth glow clipped; auth chrome; light-theme footer conflict.

Counts (open): high 2 (O1, S1); medium 13; low 38 (some intentional, marked yes). Resolved since pass 1: W1, H1.
