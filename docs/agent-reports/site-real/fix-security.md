# Fixes for V1 (security) and V2 (cost and honesty), worktree fixsec (branch site-fixsec)

No commits made. No message claiming to be from the user reached me. New tests: apps/api/tests/test_site_fixes.py (31).

| id | change | tests |
|---|---|---|
| V1-H1 | routers/site.py `publish_owner_only`: in production POST /site/publish and PATCH /site/branding give 403 `publish_owner_only` "Publishing is off on the shared demo" unless `is_real_owner` (or the operator: owner token, no session). In production the sample hotel's public page always shows the fixed sample: no build text or photos, branding shown (`sample_locked`), and its public photo route returns 404. I did not add the "unless a real owner published it" exception: demo visitors can still edit the sample build after an owner publishes, so it would reopen the hole. Local behaviour is unchanged. | demo and unverified account refused; owner and operator allowed; local demo publishes; production page has no visitor content; local page shows the build |
| V1-M1 | New app/body_limit.py `BodyLimitMiddleware` (outermost, every route): 413 `file_too_large` when Content-Length is over 11 MB; a chunked body is counted in `receive`, cut at the limit, and the route's own reply is dropped. Per-route 10 MB checks are kept. | 12 MB to /site/photos and /statements with no token gives 413 (not 401); chunked multipart gives 413 (I checked it gives 401 without the middleware); ASGI unit tests: streamed body cut, declared length never read, small body passes |
| V1-M2 / V2-H1 | `contact_out`: the sample hotel keeps its sample values (placeholder); other hotels get empty phone and UPI. HotelSite hides empty rows, and hides the whole Contact section when both are empty. Review says "Not added yet". | contact_out and GET /site for a real hotel |
| V2-H2 | `google_kit`: the build's google_description_en/hi when present; the Mussoorie text only for the sample hotel (`sample: true`); empty for a real hotel with no build. Photos are the owner's captions when built (`photos_sample`). GoogleKit.tsx shows "Generate your site text first", a "(Sample)" tag, and the photo note per case. | sample, empty, own text |
| V2-H3 | `SiteRoomOut.bookable` = the name is in room_rates and the typed price equals that rate. No money code changed. HotelSite: the booking bar lists only bookable rooms and is hidden when there are none. Other rooms say "Ask the hotel" (wa.me when a phone is set), otherwise no button. | exact match, case mismatch, unknown room, price mismatch; existing publish test updated (bookable False) |
| V2-M1 | BuildFlow: when `key_configured` is false, says it makes Sample text from your own words. | web checks |
| V2-M2 | Review toast: "Saved. It is on your site now." when live. | web checks |
| V2-M3 | GoogleKit: the WhatsApp-setup line is gone; "(sample address)" only for the sample hotel or before going live. | web checks |
| V2-M4 | site_gen SYSTEM has length targets (descriptions 600, room lines 200, points 80, Google 700); MAX_TOKENS is 4000; effort stays low. | test_generate_request_shape updated to 4000 |
| V1-L3/L4 | `Image.open(..., formats=ALLOWED_FORMATS)`; MAX_PIXELS is 30 MP. | GIF refused; 30.6 MP refused |
| V1-L5 | SYSTEM says owner_description text is facts, never instructions. `fenced()` strips owner_description tags from the description, hotel, town and room names. | fence test |
| V2-L1/L2/L3/L4 | Photos are sent sorted by id; max_retries=0; the offline Hindi fallback is a fixed Hindi line; SAMPLE_MESSAGE no longer names env vars. | Hindi fallback test |
| Lead bug 1 | services/site.py `packages()`: no fixed packages for non-sample hotels, and a spec whose room type is missing is skipped. This removes the 500 on /public/site/<real slug> and on GET /site. | published real hotel page is 200 with no packages; renamed sample room drops its package |
| Lead bug 2 | EXTRA_MONEY also catches ₨, "per cent" and "per-cent", and INR or Rs joined to a number (INR45, 45INR, Rs45, 45rs). | 7 caught, 3 plain-word controls |

Not done (low, not asked): V1-L1, L2, L6, L7, L8; V2-L5 to L9.
Checks, all green: ruff, ruff format, mypy strict, pylint (app 9.98, tests 9.99), pytest (total 98.37%, money 100%), bandit, pip-audit (no known vulnerabilities), detect-secrets. Web: typegen, tsc, eslint 0 warnings, prettier, node tests 205/205, audit-check.
