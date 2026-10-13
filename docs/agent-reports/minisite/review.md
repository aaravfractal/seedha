# Mini-site review (read-only, diff 9d61f95..HEAD, focus 3a40b26..HEAD + 6d20ff1)

| id | sev | file:line | problem | fix |
|---|---|---|---|---|
| MR-1 | high | apps/api/app/routers/link.py:149 | Every public, unauthenticated `POST /public/link/book` (simulated UPI, no code needed, 10/min per IP) mints a fresh rating token. Anyone can book 3 times and post 3 five-star ratings, so the "verified guest" average goes public. That breaks the honesty rule. | Issue link tokens only for a perk-code booking (`done.perk_applied`) or a confirmed real payment. Skip them for `upi_simulated` outside the demo. Or count `source="link"` ratings only after the stay is over (MR-2). |
| MR-2 | medium | apps/api/app/services/site_ratings.py:107 | A token can rate straight away, before the stay. The Link note says "after checkout", but nothing enforces it. | Store `rate_after` (check_in + nights) on the row. Return state `early` on GET and 409 on POST until that date. |
| MR-3 | medium | apps/web/app/(app)/desk/page.tsx:164, components/desk/Kiosk.tsx:488 | No web screen shows the Desk checkout `rating_url`: the desk page types its result as `{perk_code, slip}`, and Kiosk only toasts. The slip and firmware don't print it either. Only the hash is stored, and a reprint returns null, so the token is lost and Desk guests can never rate (brief lines 50 and 127). | Show `rating_url` as a QR or link on the desk checkout result and the Kiosk. Optionally add it to the printed slip. Show it, never message it. |
| MR-4 | low | apps/api/app/services/site_ratings.py:37 | The free-text comment can hold a guest's name or phone. Guest erasure (proof.erase_consent) does not touch `site_rating`, which is reachable through `source_ref` to booking to guest. | On guest erasure, blank the comment of ratings whose source_ref points at that guest's bookings. |
| MR-5 | low | apps/api/app/routers/public_site.py:122 | Only `sample_locked` hides ratings. On a local or e2e demo, ratings given on the sample hotel show on the sample page. | Return an empty `RatingsSummary()` whenever `prop.is_sample`. |
| MR-6 | low | apps/api/app/routers/desk.py:221, link.py:150 | Rating URLs use `web_origin`, while card QR codes use `PUBLIC_BASE_URL`. A tunnel or LAN demo can show a localhost link. | Use `public_base_url or web_origin` for `rating_url` as well. |

## Verified OK
- Tokens: 192-bit `token_urlsafe(24)`, stored as SHA-256 only, unique hash, max-length guard. One-time use via an atomic `UPDATE ... WHERE used_at IS NULL`. Rate limited at 20/min.
- Moderation: owner only (`OwnerDep`; test_route_auth updated). PATCH accepts `{hidden}` only (extra=forbid), so stars cannot be changed. Hidden comments are filtered in `summary`. No PII in the owner or public output.
- Public display: the average shows only from 3 ratings; below that the page says "New on Seedha, no ratings yet" (EN and HI). No aggregateRating in the JSON-LD. No LLM on public pages.
- Rate page: `/rate` is not an owner route in proxy.ts; robots noindex; no-referrer.
- Prices and perk: `from_price_paise` is computed with `min()` over the rooms. Room details carry no price. The perk sentence wraps the owner's own perk words.
- Migrations: 0016 and 0017 are reversible (drop index, then table) and Postgres-safe (bytea, `sa.false()`, named CHECKs, unique constraints). Photo variants: `w` and `fmt` are Literal-validated (422 otherwise), at most 9 per photo, cached and invalidated by sha, deleted together with the photo, served from a sync route (threadpool), limit 240/min.
- Money code: Makefile MONEY_CODE files are unchanged in the diff.
- Accessibility: stars are a fieldset and legend radio group, 52px targets with sr-only labels and a focus ring. Rating links have min-height 44.
- Performance: Ratings, RoomCards, AtAGlance and SeedhaBar are server components. Room photos use OwnerPhoto with `sizes`.
