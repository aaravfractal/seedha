# P3 Desk and Guest · builder report (branch fe/desk)

## Files
- Changed: apps/web/app/desk/page.tsx, components/DeskDevice.tsx, app/consent/[token]/page.tsx,
  components/LinkBooking.tsx, app/link/page.tsx, app/link/[code]/page.tsx
- Added: components/desk/{Desk.module.css, ThermalSlip.tsx, chime.ts}, components/guest/{Guest.module.css,
  usePrefill.ts}, app/link/link.module.css, lib/linkPrefill.ts + lib/linkPrefill.test.ts (6 tests)
- Not touched: globals.css, layout, types.ts, e2e, API. No new dependencies.

## Front desk (/desk)
- H1 "One scan at check-in. One slip at checkout." Banner: green dot + "Your Desk is connected · Front desk,
  Hotel Deodar View" (device name + property name from the API), shown when the device is registered and
  the simulator's poll succeeds (or desk/state says online before the first poll). Offline, connecting and
  not-registered variants. "Test print" prints a local test slip (see API asks).
- Device: cream case, pine panel, black 480:320 screen (cqw-scaled type), gold "Seedha", cream "Print" pill
  (reprints the last slip), dark 58 mm slot, LED bar: white idle, green with 1.2s glow loop, red on no paper
  (role=img with a text label, colour never alone).
- Screens from the real polled queue: D1 "Seedha" / "Deodar View · Ready"; D2 QR + payload text; D3 check
  scale 0.4 to 1 over 500ms, "Thank you, Neha ji" / "Consent saved · Proof added tonight", chime 880 then
  1320 Hz (AudioContext unlocked on first tap or key, silent under reduced motion); D4 "Printing slip" /
  "Please take your receipt"; error "Printer needs paper" while "Simulate no paper" is on (simulator-only;
  slips that arrive wait in the box and print on "Load paper"). Toast "Consent saved at 7:42 PM" (local time).
- Controls: guest select, "Show QR · Room N", "Check out and print" (disabled until the selected guest has
  consent, hint explains why), "9 PM close slip", "Simulate no paper" / "Load paper". Phone frame keeps the
  consent iframe. HTTPS polling unchanged (D11).
- Slip: 58 mm white paper, black only, mono 13px, slides translateY -102% to 0 over 1.6s
  cubic-bezier(.3,.7,.3,1). When the page holds the structured slip from POST checkout/close-slip (matched by
  identical printer text) it renders lines with ₹ via inr(); otherwise the printer's ASCII text.

## Guest
- Consent: hotel tag, "Welcome, <name>." (API), dark perk card (API perk text), WhatsApp number, unticked
  checkbox with the API's versioned wording, "Yes, send me offers" disabled until ticked and valid, stop note,
  "You are in." / "Your perk arrives after checkout." Ended (expired/invalid), "Already done." (used), and a
  retry state for network errors.
- Seedha Link: trust line, "Sample photo" gradient placeholder, Check-in + Nights selects with a stay line,
  room, perk code (valid / invalid / used + "Remove code"), "Total · N nights", "Pay ₹X with UPI" opens the
  sheet (24px top radius, 500ms): Google Pay / PhonePe / Paytm (aria-pressed), "Pay ₹8,600", Cancel,
  "UPI fee 0.4% is paid by the hotel, not you.", "Simulated UPI (test mode). No money moves." Processing
  "Approve in Google Pay" (1.4s, 0 under reduced motion) then "Booked." (name only after the code is
  accepted, D-076). Prefill ?room=&in=&nights=&code= on /link and /link/[code], each value validated alone.
- Used code: pay stays disabled while the used code is in the field; "Remove code" clears it so the guest
  can still book at the same price (matches the copy and keeps the e2e assertion).

## Checks (apps/web)
tsc --noEmit OK · eslint --max-warnings=0 OK · prettier --check OK · node --test lib/*.test.ts 24/24 pass.
`next build` cannot run in the worktree (Turbopack panics on the symlinked node_modules); please build on
main. Not run: Playwright, dev servers (per instructions), so no screenshot comparison yet.

## e2e changes the lead must make
loop.spec.ts:
- `phone.getByText("You're in.")` -> `phone.getByText("You are in.")`
- `.getByRole("button", { name: "Pay", exact: true })` -> `.getByRole("button", { name: "Pay ₹8,600" })`
- Booked text appears after the 1.4s simulated processing step (within default timeout).
- Unchanged and still valid: #guestSel "207", "Show QR" (button now "Show QR · Room 207", substring match),
  "Check out and print", img "Consent QR code", iframe title, "Welcome, Rahul ji.", "Thank you, Rahul ji",
  getByLabel("Printed slip") (now a figure), "online, polling every 2 seconds", "Pay ₹8,600 with UPI",
  "Free breakfast on your next direct stay. Your code is valid.", "This code was already used." (substring).
a11y.spec.ts keyboard test (sheet order is now Google Pay, PhonePe, Paytm, Pay ₹8,600, Cancel; focus opens
on Pay ₹8,600):
- `sheet.getByRole("button", { name: "Pay", exact: true })` -> `sheet.getByRole("button", { name: "Pay ₹8,600" })` (both places)
- after Cancel, Tab focuses `sheet.getByRole("button", { name: "Google Pay" })`, not Pay. Replace the last
  Tab assertion with Google Pay, then `Shift+Tab` back to Cancel if a wrap check is wanted.
- Escape closes and returns focus to "Pay ₹8,600 with UPI": unchanged.

## API asks (not done; apps/api is out of my scope)
1. services/desk.py check_in: show_qr text `f"Room {room} · Scan for your perk"` -> `f"Room {room}, scan to get your perk"` (handoff D2).
2. New POST /desk/test-print (owner): enqueue show_text {"Printing slip","Test print"}, print_slip with a
   test slip, show_idle. Until then Test print is simulator-local.
3. Optional: show_ok sub could carry "Consent saved · Proof added tonight" so the firmware matches; the web
   currently appends " · Proof added tonight".

## Numbers vs screenshots
All rupees come from the API. Neha's slip (₹4,000 − ₹600 − ₹612 − ₹110 = ₹2,678) and Link ₹8,600 (₹4,300 x 2)
match the seed. Close slip gross ₹58,800 and direct 21% match the seed rows by arithmetic; other close
figures not verified at runtime. Handoff shows "Reception"; the seeded device name is "Front desk".
Product question: "Check out and print" is disabled until consent (handoff), so a guest who declines gets no
slip from the Desk. Confirm or allow checkout without a perk.
