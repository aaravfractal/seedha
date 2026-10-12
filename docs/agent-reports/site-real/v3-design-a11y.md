# V3: design and accessibility review, site real mode (read-only)

Setup: API :8945 (scratch sqlite, seed, SEEDHA_DEMO=1, no Claude key, so the Sample path ran), web `next dev --webpack` :3945,
Direct beta login. Playwright + axe (wcag2a/aa, 21a/aa, 22aa) at 390 and 1440, light and dark. The whole flow ran 4 times:
5 photos uploaded on a throttled network, a keyboard reorder, the mic (SpeechRecognition mocked), rooms, generate, confirm, review, edit,
slug check, publish, Copy, WhatsApp, QR. Then Settings, /h/<slug>, the not-live page, and a second web run with SITE_ROOT_DOMAIN=localhost.
No messages claiming to be from the user reached me.

## Measured
- axe: 0 violations on 60 of 64 screen/width/theme checks. Fails: target-size on "0 of 3 approved" (Review, 1440 light and dark;
  117x23.5 px) and color-contrast 2.79:1 on the mic button while listening (dark, both widths).
- Horizontal scroll at 390: setup steps 693 px wide (every step), Review 1302 px. None at 1440, on the Website empty
  screen, Settings, /h/<slug>, the not-live page or <slug>.localhost.
- Focus after each action: step change goes to the step h2 (good). After generate, Review my site, the Regenerate confirm, Publish
  and a photo move, focus lands on BODY. The dialog's focus trap holds (4 Tabs stay inside). Escape returns focus to the opener.
- Live regions: photo count (polite), move "Photo moved to place 2 of 5." (polite), generate "Writing your site…" plus a status note,
  slug check (role=status), errors (role=alert), publish (toast). Upload percent shows on screen and in progressbar values only.
- Alt text: owner thumbnails say "Photo N: <caption>". Public images use the caption in the page language (View, Deluxe room, …). QR
  alt is "QR code for <address>".
- Reduced motion: no animations running. The indeterminate bar is static.
- Focus ring is 3 px accent in both themes. Targets under 44 px are listed in L1.
- Public /h/deodar-v3 on a phone profile (Pixel 5, 390x844, CPU 4x), 3 runs each, on the DEV server (4.4 MB of unminified JS, so these
  numbers do not show production speed):
  - Slow 4G: LCP 22,316 / 22,368 / 22,336 ms, CLS 0.0001, FCP about 1.3 s.
  - CPU throttle only: LCP 1,976 / 1,924 / 1,948 ms, CLS 0.0002.
  - The LCP element is the hero <img> (54 KB, fetchpriority high). CLS stays near 0 because width and height are set.
- Subdomain: deodar-v3.localhost:3945 returns 200 with 0 axe violations. An unknown slug there returns 404 "This hotel site isn't live yet".
- Copy put the URL on the clipboard. The WhatsApp link is wa.me/?text=… The QR downloads as deodar-v3-qr.png. Copy rules hold (no em dashes or "!").

## Findings
| id | sev | screen / width / theme | file:line | problem | fix |
|---|---|---|---|---|---|
| H1 | high | Setup steps and Review / 390 / both | components/site/build.module.css:4-8; components/site/owner.module.css:3-7, 386-390 | The page scrolls sideways at 693 px (setup) and 1302 px (Review). Grids with an `auto` track take the min-content width of the step tracker (BuildFlow.tsx:163) and of the 1280 px desktop PreviewFrame. Review is unusable on a phone: the switches sit off-screen and the "desktop preview" renders at full size. | Add `grid-template-columns: minmax(0,1fr)` to .flow, .stack and .previews (under 760 px), or `min-width:0` on their children. Add a scrollsSideways check at 390 for the chat and review stages. |
| M1 | medium | Regenerate / Write it again confirm / all (worst at 390) | components/shell/Shell.module.css:34; components/settings/Modal.tsx:28 | `.content` keeps transform: matrix(1,0,0,1,0,0) from the `both` enter animation. That makes it the containing block for the fixed scrim. The scrim covers only the content column (292..1412 x 4841 px tall), not the header or sidebar. At 390 the sheet sits at the bottom of the whole page, so opening it jumps the scroll to "Pick your address". | Portal the Modal to document.body (as RoomSheet.tsx:183 does), or use `animation-fill-mode: backwards` on .content. |
| M2 | medium | Generate, Review my site, Regenerate, Publish, Change address / all | BuildFlow.tsx:288-299,342; site/page.tsx:173; Review.tsx:157-163,199-204; PublishPanel.tsx:157-176,243 | Focus falls to BODY. The confirm hands focus back to a button that is disabled while it writes. Publish swaps the whole section, and the Review screen mounts with no focus target. Keyboard and screen reader users lose their place. | After generate, focus the status note (tabIndex -1) or the "Review my site" button. Focus the Review h2 on mount, the "Your site is live" h2 after publish, and the Address input on Change address (and the reverse on Cancel). |
| M3 | medium | Photos and Review captions / all | components/site/PhotoPicker.tsx:43-52,114,124 | Moving a photo with the keyboard loses focus. `busy` disables every arrow during the save, so the refocus query `:not(:disabled)` finds nothing and the pressed button turns disabled. Activating it again means tabbing from the top. | Keep the arrows enabled and queue moves, or run the refocus after busy clears (add busy to the effect deps). Use aria-disabled instead of disabled while saving. |
| M4 | medium | Describe, mic listening / both widths / dark | components/site/build.module.css:323-326 | Stop button: #fff on --loss #FF6B5E = 2.79:1 (axe serious). | Use a dark ink (#1d1d1f) on --lossFill in dark, or a fixed #c4312a background with white text. |
| M5 | medium | Review "Also on your site" / 1440 / both | components/site/Review.tsx:319 (+ globals.css:440 .link) | "0 of 3 approved" is a 23.5 px tall text button. It fails WCAG 2.2 target-size, which the axe sweep flags. | Give the button min-height 44 px with padding, or make it a btn ghost small. |
| M6 | medium | Website → Build my site (first open) / all | apps/api/app/services/site_gen.py:192-200 | get_content checks and then inserts without a lock. Two concurrent GET /site/build on a fresh property: one gets IntegrityError and returns 500, and the screen shows "That did not load / Something went wrong". Hit on every fresh run here (dev StrictMode double fetch). In production any two concurrent first reads hit it too. Try again recovers. | Catch IntegrityError, roll back and re-select, or insert with ON CONFLICT DO NOTHING. Add a concurrency test. |
| M7 | medium | Public /h/<slug> and <slug>.<root> / phone | app/h/[slug]/page.tsx:1,20,58 | The page is entirely client-side: HTML, then JS, then hydration, then a fetch of /api/public/site, then the hero image. The LCP image cannot start loading until all of that runs, and the shell has no hotel content for crawlers or link previews (title set in an effect). | Fetch the public site in a server component and pass it to HotelSite. Keep only lang and mood switching on the client. Then measure LCP on a production build. |
| L1 | low | several / all | globals.css:435 (.btn.small 40 px); ReviewEditors.tsx:101; RoomsEditor.tsx:88; PublishPanel.tsx:167; SiteAddress.tsx:113; worldb.module.css:117-122 | Save, Remove room, Change address, Download QR and the public Back button are 40 px. The public EN/हि buttons are 44x40. The brief asks for 48 (44 for dense secondary). | Use min-height 44. |
| L2 | low | Public page / all | components/site/HotelSite.tsx:196 | Back calls history.back(). A guest arriving from WhatsApp or the QR has no history, so it does nothing or leaves the site. | Hide it on the public page, or link it to the top of the page. |
| L3 | low | Generate note and Review / all | apps/api/app/services/site_gen.py:627 | Owner-facing copy names env vars: "Add ANTHROPIC_API_KEY and SITE_GEN_MODEL…". | Say "AI writing is not set up on this Seedha yet" and leave the env names to the docs. |
| L4 | low | Settings AI usage / 390 | components/settings/AiUsage.tsx:49,58 | Values wrap mid-number ("0 in · 0 / out", "0 of / 3,00,000"). | white-space: nowrap on the value, or stack the value under its label. |
| L5 | low | Review editors / all | ReviewEditors.tsx:101 | Five buttons all named "Save" (the form has a name, but a button list doesn't show it). | Use aria-label `Save ${title}` or aria-describedby pointing at the section h3. |
| L6 | low | Rooms / all | RoomsEditor.tsx:91 | Remove room drops focus to BODY. | Focus the next row's name, or "Add a room type". |
| L7 | low | Confirm dialogs / all | components/settings/Modal.tsx:29-36 | The alertdialog has no aria-describedby, so the body text is not announced with the title. | Pass an id for the body paragraph. |
| L8 | low | Review preview / all | Review.tsx:302 | The browser bar in the preview shows site.address (the default /h/deodar-view) while the picker below shows the slug being chosen. | Show the picked slug, or label the bar "current address". |
