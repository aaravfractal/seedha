# A2 Final demo reliability audit

Branch `deploy` at b33a218, 2026-10-12. `make demo-prod` on localhost:3000 and
127.0.0.1:8000, driven by Playwright (Chromium) from apps/web with temporary
configs and specs in the session scratch dir (no repo files changed except this one).
`.env` on this laptop has ANTHROPIC_API_KEY and PROOF_RPC_URL set; WhatsApp and
Razorpay keys are empty (log: "running in SIMULATED mode").

## Results per check

1. **make demo-prod**: seeded, built and served; `/login` returned 200 (build cached, under 1 minute).
2. **8-step loop (loop.spec.ts, DEODAR-RS26)**
   - Run 1, Claude live: **2 failed** (59 s wall). Step 7 asserts `Namaste Rahul ji`;
     Claude wrote "Dear Rahul ji, thank you for staying with us at Deodar View ... Use code
     DEODAR-RS26 ... Reply STOP to opt out." The draft was correct (code, link, STOP); only
     the wording differs. "Cannot be redeemed twice" failed in cascade, because the first test never booked.
   - Run 2, same server, after reset, greeting assert relaxed to `/Rahul ji/`: **3 passed (32.6 s)**.
     Loop 29.1 s; ₹10,39,108, MakeMyTrip 5th at ₹2,737, ₹41,800 / 12, ₹2,233 / +₹2,199, 8 of 8 done.
   - Run 3, unmodified spec, fresh demo-prod with the API offline (see 5): **2 passed (25.3 s)**.
     Loop 24.3 s, redeem-twice 0.3 s. The template "Namaste Rahul ji" was used.
3. **UI checks (5 passed, 29.8 s; screenshots in scratch `shots/`)**
   - Overview room board: room 101 sheet shows List ₹4,300, Discount −₹516, Commission −₹832,
     GST −₹150, Fees ₹0, Net kept ₹2,802, initials "KA", plus "₹967 more kept if direct". The MakeMyTrip
     filter chip toggles (aria-pressed). The scrubber has 7 nights; the first night shows "12 of 22 rooms sold ·
     ₹38,494" against the last night's "14 of 22 · ₹46,691".
   - Inbox: "All 8". Farhan Thapar's thread has the slot "Stay invoice ready to attach · DEODAR/2627/0001".
     Preview dialog opens. Download PDF gives `stay-invoice-DEODAR-2627-0001.pdf`, starts with `%PDF`, HTTP 200,
     `application/pdf`. Attach goes to Attached (disabled) with the "Attached." status; nothing is sent.
   - Pro: Audit, Floor, Displacement, Tonight and Rollup each open (aria-expanded true, view visible) and close.
   - Website at 1440x900: Pulse heading is correct with 6 timeline nodes; scrolling advances the card to "Republic
     Day weekend". `#event-radar` count is 1 and `#seedha-pass` count is 1. The globe canvas is drawn (no
     fallback), and the layer toggle switches to radar (list data-layer=radar, Winter Line Carnival, Sample).
   - Console errors, page errors and HTTP >= 400 across all of these: **none**.
4. **Reset demo data** (Settings > Hotel > Reset demo data > Yes, reset everything): toast "Sample hotel reset.
   Desk date 2026-10-12." The state signature after the Settings reset equals the one after a reset through the API
   (8 threads with the same bubble and unread counts per guest, pipeline 0 done, same room-nights payload). Before
   the reset it had been changed (pipeline 2, Farhan 4 bubbles). After the reset, Home shows "0 of 8 done", the
   scrubber has 7 nights, the inbox lists 8 rows, the Pro floor card opens and Pulse has 6 events. **Pass.**
5. **No internet**
   - Browser: every request to a host other than localhost or 127.0.0.1 was aborted. The website, sign-in (Direct
     beta login), Overview, Inbox, Pro and Proof loaded. **0 external requests were attempted** (fonts bundled:
     "mukta" loaded), and there were no failed localhost requests, console errors or page errors. Proof shows
     **"Local only"**.
   - API: restarted `make demo-prod` with HTTP(S)_PROXY set to an unresolvable host (NO_PROXY=localhost), so
     Claude and the Amoy RPC could not be reached. The unmodified loop passed (run 3) with the template draft.
     Ask `paid_last_month` answered "₹1,09,542" in 0.58 s. Proof stayed Local only (`reason: rpc_down`), and the
     browser pass repeated clean. WhatsApp and UPI are simulated. **The demo needs no internet.**
   - Note: the Amoy RPC in `.env` was unreachable from this machine even with internet (curl code 000), while
     api.anthropic.com was reachable. So Proof showed Local only in every run; testnet writes were not exercised.
6. **Stop and reset**: killed both process groups. No listeners on 3000 or 8000, and no next or uvicorn processes
   left. `make seed` printed "Loaded sample hotel Hotel Deodar View (demo date 2026-10-12)". `git status` is clean.

## Findings

| id | severity | where | problem | fix |
|----|----------|-------|---------|-----|
| A2-1 | medium | apps/web/e2e/loop.spec.ts:59; README-dev.md:83 | The readiness gate "8-step loop on make demo-prod" fails whenever `.env` has ANTHROPIC_API_KEY. The spec and the demo script expect the template text "Namaste Rahul ji", but Claude's wording varies ("Dear Rahul ji ..."). | In the spec, assert `/Rahul ji/`, `DEODAR-RS26` and "Reply STOP to opt out." instead of the template greeting. In README-dev, say the draft greets Rahul ji by name and that the wording is Claude's, or the fixed template when Claude is off. |
| A2-2 | low | apps/web/e2e/loop.spec.ts:96 | "Cannot be redeemed twice" depends on the first test having booked, so one failure shows as two. | Use `test.describe.configure({ mode: "serial" })`, or book inside the second test. |
| A2-3 | low | website `/` first visit | At 1440x900 the cookie banner covers the lower half of the Seedha Pass and globe section until it is dismissed. | Click "Necessary only" before presenting; optionally make the banner more compact on wide screens. |
| A2-4 | low | .env PROOF_RPC_URL (environment) | The Amoy RPC was unreachable from this laptop, so Proof always showed "Local only (not reachable)". The fallback works, but a live testnet write cannot be shown. | Before judging, check the RPC from the demo network, or present Proof as Local only. |
| A2-5 | low | apps/api/app/services/llm.py:86 | The statement reader uses a 600 s timeout with 2 retries. An unknown-layout upload on a slow (not absent) network could hang the Upload screen. Sample files are parsed deterministically, so the demo path is not affected. | Lower it to about 60 to 90 s, or show progress or a cancel option for Claude reads. |
