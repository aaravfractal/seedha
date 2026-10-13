# Review 2 (read-only), hotel-minisite 704b72d..7c09c95

| id | sev | file:line | problem | fix |
|---|---|---|---|---|
| R2-1 | high | components/site/v2/CardWelcome.tsx:127,152,175; site/ratings/FeedbackList.tsx:28 | The C1 card API was never built or merged (card-api == HEAD; no `card/verify`, `card/rate`, `card/feedback`, `site/feedback` route in apps/api). Every card form shows "That did not work", and the owner Ratings tab shows a permanent ErrorState. e2e passes only because page.route mocks these routes. The real-API test is skipped. | Build C1 (verify by booking ref + last 4, stay ended, one rating per stay shared with link tokens, feedback table 0018, owner list/read, sample refs, reset). Unskip the real-API e2e. Do not deploy the panel until then; otherwise hide the forms. |
| R2-2 | med | components/site/v2/copy.ts (card.refHelp, refBad, notFound); services/slips.py:88-110 | "Booking reference: From your checkout slip" is not true. The checkout slip has no booking reference line. | Change the copy (for example "from your booking confirmation"), or add a ref line to the slip. slips.py is in MONEY_CODE, so keep 100% coverage. |
| R2-3 | med | services/desk.py:197; app/(app)/desk/page.tsx:157 + components/DeskDevice.tsx:99 | The appended "Rate your stay: <url>" line means the print_slip text no longer equals `slip.text`. `knownSlips.find` misses, so the owner Front desk page shows the raw ASCII fallback ("Rs", 32-col) instead of the structured slip. The long token URL also overflows the 32-col kiosk slip. | Match on the prefix (`text.startsWith(s.text)`), or send the link as a separate payload field (`rating_url`) and render it below the slip. |
| R2-4 | med | services/desk.py:195; routers/rooms.py:213; routers/desk.py:238,250 | The Front desk screen (/desk/device, web) renders show_text as-is: "Printing slip / Please take your receipt", "Printing slip / Close of day", and the reachable POST test-print shows "Test print / Please check the paper". This is hardware wording users see. | Change the texts to "Slip ready" / "Show the slip on screen". Remove or 404 the test-print route outside firmware dev mode. |
| R2-5 | med | docs/CARD_PAGE.md (deleted in 2a7f5cd) | The no-hardware commit deleted the saved card brief that the code comments cite (CardWelcome.tsx:52, cardWelcome.ts:2). | Restore it: `git show 704b72d:docs/CARD_PAGE.md`. |
| R2-6 | low | components/website/Pricing.tsx:157; Sections.tsx:394; README.md:27 | "The slip is ... sent by WhatsApp": no code sends the slip by WhatsApp. Only the win-back draft carries the perk code. | Say "shown on screen; the perk code follows by WhatsApp after you approve". Or build it. |
| R2-7 | low | lib/no-hardware.test.ts:12,18 | The guard meets the brief's 5 words for public pages and README only. It does not cover the owner app, components/pro, the /desk pages, API display strings, "paper", "thermal", "test print", "Seedha Desk" or "device key". R2-4 slipped through this gap. | Add the owner/desk/pro roots, and a second regex for paper, thermal, test print and Seedha Desk on owner surfaces. |
| R2-8 | low | services/site_cards.py:639 | The card PDF says "CMYK values for the printer" (it should say print shop, as 3c9781b did elsewhere). | Change it to "for the print shop". |
| R2-9 | low | privacy/page.tsx:18,79,218; terms:19; faq:33; data-deletion:9,16; Pricing.tsx:145 | Bare "Desk" is still used for consent, while everything else says "front desk". | Change it to "front desk" for consistency. This is not hardware wording. |
| R2-10 | low | CardWelcome.tsx:319 | `<script>` is rendered by a client component during hydration (React 19 warns in dev). The script is a constant with no query or interpolation, so injection-safe. CLS approach OK (`display:none` until `html[data-hs-card]`). | Optional: move GATE into the server page head/layout via next/script `beforeInteractive`. |
| R2-11 | low | CardWelcome.tsx:260 | The ref input has no aria-invalid when refBad/not_found shows. The error is not tied by aria-describedby. Otherwise the forms are labelled, there is a star fieldset/legend, role=alert and 44px targets. | Add `aria-invalid` and add the error id to `aria-describedby`. |

OK:
- siteHost POST allowlist is exact (`===`, own slug only).
- deps.py `scope="function"`: FastAPI 0.143 runs serialization inside the function stack, so responses are serialized before close. There are no StreamingResponse or BackgroundTasks uses. Rollback-on-error is unchanged.
- MONEY_CODE files are untouched.
- Consent is still unticked by default, and the STOP line is untouched.
- No price is shown or computed on the card page. The perk comes from the owner's `cardPerk`, and Book again goes to /link at the public rate.
- No invented ratings.
- The rating time gate and erasure look right.
- 0017 edited in place is OK (not on main or deploy).
