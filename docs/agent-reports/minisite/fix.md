# Mini-site review fixes (mini-fix)

- MR-1, MR-2: `site_rating.opens_on` (Date), added to 0017 in place (it was never deployed; still reversible and Postgres-safe). A Link token opens on check-in + nights. A Desk checkout token opens on the checkout business date. `rating_state` returns used, open, not_yet (business date < opens_on) or invalid. Invalid means the booking is missing or `status != "stay"` (a cancelled booking never opens). GET /public/rate returns `opens_on` while not_yet. POST returns 409 `not_open_yet` before that date and 404 for an invalid link.
- MR-3: the Desk checkout `rating_url` is printed on the slip as one extra line, "Rate your stay: <url>". The text is built in services/desk.py; slips.py and other money code are untouched. Firmware is unchanged; the firmware contract normaliser masks the token, and the native firmware tests pass. Web: a RatingPanel (QR + short link + Done) on the desk page and Kiosk, committed in cfef213 before the hand-over. Desk web files were not touched after that.
- MR-4: `erase_consent` now also blanks the comments on ratings for the guest's bookings (Desk) and direct bookings (Link). The stars stay.
- MR-6: rating links use `guest_link_base` = PUBLIC_BASE_URL, else the web origin. This is the card QR base; cards fall back to the site URL, but /rate lives on the web app.
- Rate page: a not_yet state in EN and HI ("You can rate your stay from <long date>."). A 409 `not_open_yet` shows that state, not "used". rating.spec.ts has 2 new mocked tests.

## e2e regressions
- site-address (hide_branding): root cause is in `deps.get_session`. The yield dependency had the default "request" scope, so FastAPI 0.143 sent the 200 *before* `session.commit()`. The BFF revalidated at once and re-read /public/site before the commit, so the old row was cached. This is a timing race: it failed in 2 of 3 full runs and passed when run alone. Fix: `Depends(get_session, scope="function")` commits before the response. A test pins the scope; the full API suite passes.
- site-details:53: the `getByText("Sample facts")` substring also matched the toast "...keeps its fixed sample facts.", whose text stays in the live region. Using `{ exact: true }` targets the tag only. That is stricter, not weaker. The bug is from d477add; this test had not run green since.
- site-details:254 (reached now): the sample room's feature 2 is prefilled (A1 sample rooms). The test now reads it first and expects ["Mountain view", feature 2].

## Checks
- API: ruff, format, mypy clean; full pytest passes.
- Web: tsc, eslint, prettier, node --test (284) pass.
- e2e (scratch config, web 3091 / API 8091): rating, desk-kiosk, loop, owner, site-address and site-details pass. Full suite: 98 passed (10.4 min).
