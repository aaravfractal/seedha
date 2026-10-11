# B2 room board UI (polish build, section A). Not committed.

## Files (apps/web)
- `components/owner/RoomBoard.tsx`: board card. Loads `GET rooms/nights` and falls back to the Overview's `last_night`
  while loading or on error (one night, no scrubber). Channel chips (aria-pressed, counts per night, Empty chip),
  roving-tabindex grid (arrows, Home, End; columns read from layout), 30 ms tile stagger (grid re-keys per night),
  summary cross-fade, "Last night" / "Night of Sat 10" heading, existing "Print close slip on Desk" kept.
- `components/owner/RoomSheet.tsx`: dialog portalled to `<body>` (the screen-enter transform trapped a fixed scrim).
  Side sheet from 760 px (slides 450 ms, app curve), bottom sheet on phone. Lines from `GET rooms/{night}/{room}`;
  commission lines hidden when commission and GST are 0 and `if_direct` is null (walk-in/direct). Initials only,
  "Consented at Desk" / "Not consented", Open in Desk (`/desk?room=`), Message guest (only with consent_id,
  `/inbox?thread=`), Print slip (POST `.../slip`, toast "Slip sent to the Desk"). If-direct box with "Illustration".
  Escape, scrim and Close shut it; focus returns to the tile. Empty rooms open a short sheet without a fetch.
- `components/owner/NightScrubber.tsx`: 7-night radiogroup ("Tue 6"), arrows/Home/End.
- `components/owner/roomBoard.module.css`: all board and sheet styles; 4 tiles per row under 560 px.
- `lib/rooms.ts` + `lib/rooms.test.ts` (11 tests): tolerant reader (array or {nights}, `night|date`,
  `tiles|rooms`, by_channel array or object), labels, summary, chips, filter, gridMove, roomParam.
- `lib/types-rooms.ts`; `app/(owner)/home/parts.tsx` (LastNight now renders RoomBoard; ROOM_LEGEND and
  unused imports removed); `overview.module.css` (old room styles removed); `app/(app)/desk/page.tsx` (`?room=`
  preselects via useSearchParams; AppFrame already wraps pages in Suspense).
- `e2e/room-board.spec.ts`: 7 tests (sheet lines and initials, keyboard, filters, scrubber, consent-only Message
  guest via route override, reduced motion, Open in Desk preselect).

## Copy
- Summary: "14 of 22 rooms sold · ₹46,691 net kept · Direct bookings 21%" (was "direct share", ruling 3).
- No per-tile Sample/Demo pills. Kept the existing single "Sample close" card note when is_sample.

## Verified
- Checks: typegen, tsc, eslint 0 warnings, prettier, node --test lib/*.test.ts (150 pass).
- Screens 390/1440, light/dark, reduced motion with mocked API; axe WCAG 2.1 AA clean on board and open sheet
  (fixed: scrubber day names on bg2, Illustration chip ink).
- Against B1's worktree API (polish/rooms-api, uncommitted) on 8899 via a scratch proxy route: spec 7/7 three runs;
  real data shows 14 / 22 / 21% on 12 Oct. Desk `?room=101` preselects.

## Open issues
- The spec needs B1's API and its `rooms` bff rule merged; until then the board shows the one-night fallback.
- B1's channel name for `ta` is "Travel agents" (chip shows the API name); the old legend said "Agent".
- B1 tiles also carry `code`; the board uses the same codes from `lib/rooms.ts` (ignores the field).
- `/inbox?thread=` deep link is B3's; Message guest links there.
