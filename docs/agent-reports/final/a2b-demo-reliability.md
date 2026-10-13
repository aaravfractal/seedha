# A2b Final demo reliability audit (stage 2, second run)

Branch `deploy` at 1733ccf, 2026-10-13. `make demo-prod` on localhost:3000 and 127.0.0.1:8000, driven by
Playwright (Chromium) with temporary configs and specs in the session scratch dir `final2-a2/` (no repo
files changed except this one). `.env` sets ANTHROPIC_API_KEY, CLAUDE_MODEL, **SITE_GEN_MODEL** and
PROOF_RPC_URL; WhatsApp and Razorpay are empty (log: "running in SIMULATED mode" for both).
No messages claiming to be from the user reached this audit.

## Results per check

1. **make demo-prod**: seeded ("Loaded sample hotel Hotel Deodar View (demo date 2026-10-13)"), built, served.
   `/login` returned 200 in under 2 minutes.
2. **8-step loop (apps/web/e2e/loop.spec.ts, unmodified, DEODAR-RS26)**: **2 passed, 0 failed (26.8 s;
   loop 25.9 s, redeem-twice 0.2 s)**. Claude wrote the draft live: "Dear Rahul ji, ... Use code DEODAR-RS26 ...
   http://localhost:3000/link/DEODAR-RS26 ... Reply STOP to opt out." (status sent). The earlier A2-1 failure
   is fixed: the spec now asserts "Rahul ji", not the template greeting.
3. **UI checks (5 passed, 30.8 s; shots in `final2-a2/shots/`)**, with no console errors, page errors or HTTP >= 400:
   - Overview: "0 of 8 done". Room sheet: List ₹4,300, Discount −₹516, Commission −₹832, GST −₹150, Fees ₹0,
     Net kept ₹2,802, initials shown. MakeMyTrip chip toggles (aria-pressed). Scrubber has 7 nights; first
     night "12 of 22 rooms sold · ₹38,494 net kept · Direct bookings 8%" vs last "14 of 22 · ₹46,691 · 21%".
   - Inbox: Farhan Thapar's thread shows "Stay invoice ready to attach · DEODAR/2627/0001". Preview opens;
     Download PDF is `stay-invoice-DEODAR-2627-0001.pdf`, HTTP 200, `application/pdf`, starts `%PDF`. Attach
     goes to Attached (disabled) and "Attached."; nothing sent.
   - Pro: Audit, Floor, Displacement, Tonight, Rollup each open and close (aria-expanded).
   - Website 1440x900: Pulse heading and 6 timeline nodes; scrolling moves the card to "Republic Day weekend";
     `#event-radar` count 1, `#seedha-pass` count 1; globe canvas drawn (no fallback); radar layer toggles.
4. **Seedha Site (1 passed, 16.7 s)**: on the sample state the Website screen shows "Build my site". Uploaded 4
   JPEGs (800x600, "4 of 8 photos"), described, 2 rooms (₹5,250, ₹4,300). Generate did **not** give the Sample:
   SITE_GEN_MODEL is set, so on the laptop it called Claude (key_configured true, HTTP 200 in 9.2 s,
   status generated, source claude, no fallback fields; "Your site text is ready. Read every line...").
   Review, slug `deodar-a2b` "Available", Publish. Copy put `http://localhost:3000/h/deodar-a2b` on the
   clipboard; WhatsApp href `https://wa.me/?text=Book%20Deodar%20View%20directly...`; QR `deodar-a2b-qr.png`
   is a PNG (8,814 bytes). `/h/deodar-a2b` and `deodar-a2b.localhost:3000` both 200, all photos loaded,
   owner prices shown, "Built with Seedha". Unknown slug: 404 with "This hotel site isn't live yet" on both forms.
5. **Reset demo data** (Settings > Hotel > Reset demo data > Yes, reset everything; 1 passed): starting from the
   dirty state (published `deodar-a2b`, statements uploaded = pipeline 2, Farhan 4 bubbles). Toast "Sample hotel
   reset. Desk date 2026-10-13." Afterwards: site back to `deodar-view`, 0 photos, 0 rooms, source none,
   `/h/deodar-a2b` 404; 8 threads (Farhan 3 bubbles); pipeline 0; Home "0 of 8 done"; 7 nights; inbox 8 rows;
   Pro floor opens; Pulse 6 events. The state equals a reference reset through the API. **Pass.**
6. **No internet (browser)**: every request to a host other than localhost, *.localhost or 127.0.0.1 aborted.
   Website (globe canvas, bundled fonts), sign-in, Overview, Inbox (8 rows), Pro, Proof ("Local only"), Site
   setup (photos step), `/h/deodar-view` and `deodar-view.localhost:3000` (200, Cormorant and Mukta loaded) all
   load. **0 external requests attempted**; no failed localhost requests, console errors or page errors.
   The API-side offline run (proxy to nowhere) was not repeated; the earlier A2 run passed it.
7. **Stop and reset**: `kill -TERM -<pgid>` stopped make, next-server and uvicorn; no listeners on 3000 or 8000,
   no next or uvicorn left. `make seed`: "Loaded sample hotel Hotel Deodar View (demo date 2026-10-13)".
   `git status`: only an untracked `docs/agent-reports/final/a3b-docs-honesty.md` from another agent.

## Findings

| id | severity | where | problem | fix |
|----|----------|-------|---------|-----|
| A2b-1 | low | .env SITE_GEN_MODEL; Site Generate step | The brief assumed SITE_GEN_MODEL is unset, but it is set locally, so on the laptop Generate calls Claude (9.2 s here, spends credit, counts 1 of 3 a day) instead of the labelled Sample. It works and is labelled "Written with Claude", but a slow venue network makes the step slow, and 3 runs a day can run out in rehearsal. | Decide which demo you want: unset SITE_GEN_MODEL for the instant labelled Sample, or keep it and avoid more than 3 rehearsal runs a day. Mention it in READY_REPORT's Claude check. |
| A2b-2 | low | .env PROOF_RPC_URL (environment) | Amoy RPC still unreachable from this laptop (curl code 000; api.anthropic.com is reachable). Proof shows "Local only" in every run; a live testnet write cannot be shown. | Check the RPC on the venue network before judging, or present Proof as Local only. |
| A2b-3 | low | website `/` first visit (carried A2-3) | At 1440x900 the cookie banner covers the lower part of the Seedha Pass section until dismissed. | Click "Necessary only" before presenting. |
| A2b-4 | low | Site setup state | Once "Build my site" is clicked, the Website screen resumes at the setup step on every later visit until a reset, so a rehearsal leaves it mid-setup. | Reset demo data (or `make seed`) after rehearsing, as already in the hackathon-day steps. |
| A2b-5 | low | apps/web/e2e/loop.spec.ts:100 (carried A2-2) | "Cannot be redeemed twice" still depends on the first test having booked. | `test.describe.configure({ mode: "serial" })` or book inside the second test. |

No high or medium findings.
