# Fixes for V3 (design and accessibility), worktree fixdesign (branch site-fixdesign)

No commits made. No message claiming to be from the user reached me. Security fixes (fix-security.md) kept as they are. Money code untouched.

| id | change |
|---|---|
| H1 | `grid-template-columns: minmax(0, 1fr)` on every single-column grid in build.module.css (.flow, .panel, .field, .pair, .queue, .rooms, .room, .status, .summary, .editor, .section, .points), owner.module.css (.stack, .setup, .previews, .grid2) and publish.module.css (.panel, .address, .addressText). The step tracker scrolls inside its own strip and the 1280 px desktop preview scales inside its frame. scrollWidth is 390 on every setup step, Review, Review with the dialog, Review live and the public page. |
| M1 | Shell.module.css `.content` enter animation uses `backwards`, not `both`, so no transform stays on the column and fixed sheets are relative to the viewport again (fixes every Modal, not only Regenerate). Scrim measured 0,0,390x844; opening Regenerate keeps scrollY (1522 to 1522). |
| M2 | Site page passes a one-shot `claimFocus` to BuildFlow and Review: Build my site, Change photos and Review my site (and the tracker's Review) focus the new h2 (tabIndex -1). Generate and Regenerate focus the live status note (tabIndex -1) while writing and after, or the button again after an error. PublishPanel: Publish focuses "Your site is live", Change address focuses the Address input, Cancel focuses Change address. |
| M3 | PhotoGrid: arrows and Remove use `aria-disabled` while saving (clicks ignored), so the refocus finds the moved photo's button. Measured: focus stays on the moved photo's control, and Enter again moves it again. |
| M4 | Mic "Stop" while listening: fixed #c4312a with white text in both themes (5.4:1). |
| M5 / L1 | "0 of 3 approved" gets `.linkBtn` (min-height 44, 124.6x44 measured). `.btn.small` is 44 px app-wide; World B EN/हि buttons 44x44. |
| M6 | site_gen.get_content inserts inside a savepoint and on IntegrityError re-reads the winner's row (same pattern as get_config). New tests/test_site_design_fixes.py: a real two-session race (B misses, A commits, B's insert conflicts and returns A's row; fails without the fix) and two first GET /site/build calls. |
| M7 | app/h/[slug]/page.tsx is now a server component: it fetches public/site/<slug> with apiUrl, the guest's X-Forwarded-For and the proxy proof (cache no-store, React cache shared with generateMetadata for the title), reads ?lang and ?mood, and passes the payload to the client HotelPage.tsx (language switch, renamed-address redirect, a client fetch with retry only if the server could not reach the API). cacheComponents, the proxy's 404 page and the subdomain rewrite are unchanged (both forms 200 with the hero in the HTML; unknown slug 404). Hero img: width, height, loading eager, fetchPriority high. Fonts: Devanagari Mukta (3 files, about 200 KB, app-wide) and the Stone and Sky display fonts are no longer preloaded; they load when used. |
| L2 | Public Back button removed (and its copy and CSS). |
| L4 | AI usage: the two token rows stack under 480 px and each number sits in a nowrap span. |
| L5 | Review Save buttons are named "Save About the hotel", "Save Why book direct", "Save Rooms", "Save Photos and captions", "Save Google description". |
| L6 | Remove room focuses the next row's name, or Add a room type when it was the last row. |
| L7 | Modal takes `describedBy`; the generate confirm points it at its body text. |
| L8 | PublishPanel reports the address as it will look; Review's preview bar shows the slug being picked. |

Not done: L3 was already fixed by fix-security (SAMPLE_MESSAGE).
Stale tests from the merged security fixes, updated (not skipped): test_site_real_t1 `test_one_bad_field...` expected the old English Hindi fallback (now the fixed Hindi line); e2e/site-build.spec.ts expected the old env-var sample message and a booking bar with rooms that are not bookable (V2-H3). The spec now adds a third room, Deluxe Valley View at 4,300 (the sample rate), so the booking bar path is still covered.

## Measured (own servers: API :8950 on a scratch sqlite, `next build` + `next start` :3950 in an APFS clone, shared env, no Claude key)
- axe (wcag2a/aa, 21a/aa, 22aa) at 390 and 1440, light and dark: 0 violations on photos, describe (also while listening), rooms, generate, Review, Review with the confirm open, Review live, public page (EN pine and HI stone).
- Public /h/<slug> with 5 owner photos, phone profile 390x844 DPR 3, cache off, 3 runs each, production build:
  - Slow 4G + 4x CPU: before (client-rendered page) LCP 5,212 / 5,224 / 5,224 ms, FCP 4,584, CLS 0. After: LCP 3,040 / 2,992 / 3,032 ms (hero img), FCP about 1,765, CLS 0.0000.
  - 4x CPU only: before LCP 304 / 288 / 304 ms; after 144 / 148 / 148 ms, CLS 0.0000.
  - Server rendering alone gave 4.6 s; dropping the 5 unneeded font preloads gave the rest.
- e2e/site-build.spec.ts (2) and e2e/site-address.spec.ts (1) pass against these servers (temporary config deleted; the worktree's node_modules symlink untouched).
- Checks: ruff, ruff format, mypy strict, pylint (app 9.98, tests 9.99), pytest (all pass, total 98.39%, money 100%), bandit, pip-audit (no known vulnerabilities), detect-secrets. Web: typegen, tsc, eslint 0 warnings, prettier, node tests 205/205, audit-check.
