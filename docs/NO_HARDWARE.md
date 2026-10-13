# No hardware brief (saved word for word, 13 October 2026)

CHANGE OF PLAN. Finish the mini-site and card QR, then remove the
hardware from everything users see. Save this to docs/NO_HARDWARE.md and
commit first. Lean: reuse existing code, max 3 agents, mocked tests,
short reports.

PART 1: FINISH HOTEL-MINISITE (card QR)
- Stop any stage 3 fixers still running after they commit their work in
  progress to hotel-site-v2.
- Finish A1 (API) in .worktrees/ma1: fields and migrations (Postgres
  safe), editors, verified-guest ratings, scan counts per src, Card QR
  endpoint (SITE_ROOT_DOMAIN and PUBLIC_BASE_URL as in config.py). Merge
  into hotel-minisite after its tests pass.
- Card QR on the Website screen: QR for <PUBLIC_BASE_URL>/h/<slug>?src=
  card-wallet, card-room and card-desk, error correction H, 4-module
  quiet zone, SVG and PNG at print resolution, browser preview.
- Run the reviewer, fix high and medium findings.

PART 2: REMOVE HARDWARE FROM EVERYTHING USERS SEE
- Public website: remove the ESP32 Desk box, the 3D or rendered device,
  "hardware cost", "Desk included with yearly plans", printer, LED ring,
  firmware and "Phase 2 hardware" content. Replace the Desk section with
  "Front desk screen": a QR on any phone or tablet at reception; the
  guest scans and says yes on their own phone; the slip is shown on
  screen or sent by WhatsApp.
- Owner app: rename "Seedha Desk" to "Front desk", remove device states
  for the printer, paper and ring, "Simulate no paper", "Test print",
  device keys shown to owners, and "Open Seedha Desk" hardware wording.
  Keep the consent QR flow, the on-screen slip and /desk/device (now
  "Front desk screen" for a phone or tablet).
- Pricing, Plans, Pro, FAQ, About, legal and README.md: remove every
  hardware mention and price; plans no longer include a device.
- Keep the firmware/ folder and the device API in the repo, but remove
  them from public pages, navigation, README feature lists and the demo
  path. Log this in docs/decisions.md.
- Tests: a repo test fails if public pages or README mention ESP32,
  printer, LED ring, firmware or hardware cost.

PART 3: GATES AND DEPLOY
- make check, e2e once, the API suite on Postgres, the 8-step loop on
  make demo-prod (step 5 and 6 now use the Front desk screen), Lighthouse
  mobile 90+ on /h/deodar-view.
- Merge hotel-minisite into master, then master into deploy.
- I approve pushing for this task: record ROLLBACK_COMMIT (current
  deploy), push master to main and deploy, watch Railway and Vercel
  until both succeed, verify /health, https://seedha-demo.vercel.app,
  /h/deodar-view on mobile size and the 8-step loop on the hosted URLs,
  then reset hosted demo data using the hosted OWNER_API_TOKEN (never
  print it). If any live check fails, roll back to ROLLBACK_COMMIT and
  tell me why.

FINISH
Reply with a 6-line summary, the live mini-site URL, where to download
the card QR, the hardware mentions removed (count and files), and
"LIVE: deployed and verified" or "ROLLED BACK" with the reason.
