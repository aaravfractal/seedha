# B3 · Desk kiosk (/desk/device)

## Files
- apps/web/app/(kiosk)/layout.tsx: own frame, one `<main id="main">`, no header or footer.
- apps/web/app/(kiosk)/desk/device/page.tsx: the route (noindex).
- apps/web/components/desk/Kiosk.tsx + Kiosk.module.css: kiosk UI.
- apps/web/components/desk/kioskAudio.ts: Web Audio chime (no files), unlocked by the "Sound" button tap.
- apps/web/lib/kiosk.ts + kiosk.test.ts: pure command reducer, URL guard, ring and aria text (8 tests).
- apps/web/e2e/desk-kiosk.spec.ts: 3 Playwright tests.
- apps/web/proxy.ts: added "/desk/device" to the matcher (the "/desk" entry matches only /desk exactly).
No API change. DeskDevice.tsx, the /desk simulator, lib/bff.ts and loop.spec.ts are unchanged.

## Behaviour
- Polls `desk/poll` every 2 s through the BFF (device access = owner session + server-side DESK_DEVICE_KEY,
  same as the simulator), acks each batch, pauses while the tab is hidden, resumes on return.
- show_qr renders exactly `payload.url` (only absolute http/https accepted, otherwise "link could not be
  shown"); shows "Opens <host>" so the owner can see the PUBLIC_BASE_URL/tunnel origin. QR expires to idle.
- show_ok + set_ring green: green ring (pulse; static under reduced motion) and chime on `beep` if Sound is on.
- print_slip: receipt card on screen (this screen has no printer), kept through show_idle until the next QR
  or "Put the slip away". "Simulated: no paper" toggle: red ring, banner, slip still shown.
- Staff panel (details): pick a room, Show QR / Check out and print (owner endpoints), so one tablet can
  run the desk alone.
- Full screen button (only when document.fullscreenEnabled), Wake Lock when supported.
- aria-live polite summary of each state; 390 portrait shows "Turn your phone sideways" hint, no h-scroll.

## Verify
- cd apps/web && node --test lib/kiosk.test.ts
- e2e: part of the normal suite (`npx playwright test e2e/desk-kiosk.spec.ts`). It writes a consent and a
  checkout (rooms 101 and 102, not 207/104), then calls POST /api/demo/reset in afterAll so loop.spec
  still starts at "0 of 8 done". Verified on scratch servers 3830/8830: 3/3 pass, DB clean after reset.
- Screenshots (light/dark, 1440/390/844x390) were checked in the B3 scratch dir.

## Checks
typegen, tsc, eslint (0 warnings), prettier: pass. node --test lib/*.test.ts: kiosk tests pass; ONE
pre-existing failure not from B3: personal-data scan flags docs/LIVE_FEATURES.md:107 (committed in cb8a501).

## Open issues
- The simulator (/desk) and the kiosk drain the same device queue; run only one of them at a time.
- desk-kiosk.spec uses demo/reset (rate limit 2/min); if another spec adds a reset nearby, watch the limit.
- No API command signals paper out, so paper out is the labelled simulated toggle only.
