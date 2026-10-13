# Fix docs and honesty (final-docs worktree, from deploy 1733ccf)

Source: docs/agent-reports/final/a3b-docs-honesty.md. B14 left as is (owner's brief copy).
No message claiming to be from the user reached this agent.

| id | file | change |
|---|---|---|
| B1 | README.md | Seedha Site feature bullet (4 to 8 photos, HEIC, EN and HI text, 3 runs a day, monthly cap, Pine/Stone/Sky, `/h/<slug>` or `<slug>.<SITE_ROOT_DOMAIN>`, Copy, Share on WhatsApp, QR); real vs simulated row (Claude only with `SITE_GEN_MODEL` and key, else Sample; hosted sample page always fixed, visitors cannot publish); AI bullet adds site text |
| B2 | README.md | 1,308 API tests, pylint 9.98, 205 web unit tests, 78 Playwright tests |
| B3 | README-dev.md | Seedha Site key row (`SITE_GEN_MODEL` e.g. claude-haiku-5-5, `SITE_GEN_MONTHLY_TOKEN_CAP` 300000, `SITE_ROOT_DOMAIN`); `/h/<slug>`, `<slug>.localhost:3000`, `/hotel/` redirect, pillow-heif D-102 note |
| B4 | README-dev.md | manual checklist step 8 "Build a real site" (old step 8 is now 9) |
| B5 | docs/HOSTING.md | Railway rows for the 3 site variables (API reads all three, config.py:201-203); Vercel row for `SITE_ROOT_DOMAIN` (web proxy reads it, proxy.ts) |
| B6 | docs/HOSTING.md | section 8 test: visitors cannot publish (publish_owner_only, site.py:497), `deodar-view` host shows the fixed sample page (sample_locked), real publish needs a real owner account; checklist item 8 for Seedha Site. Copy/Share/QR live in SiteAddress, shown only after a publish, so the checklist says they need a real owner account |
| B7, B15 | Sections.tsx | site card: "No website? Add photos and a few lines, and get one with direct booking." / "Review before it goes online"; band: "Tap Build my site in the app ... Coming soon: build on WhatsApp." |
| B8 | Pricing.tsx | "answered in the app. Answers on WhatsApp are planned." |
| B9 | Pricing.tsx | AI list adds site text from the owner's photos and words and pasted event notices; "never writes a rupee figure or a price ...; every amount comes from code." |
| B10 (F17) | README.md | Claude rows say owner only, hosted and public-link visitors get fallbacks; testnet row adds `PROOF_CHAIN_ID=80002` |
| B11 (F10) | README-dev.md | command table adds setup, demo-prod, demo-lan, demo-live, reset, proof-wallet |
| B12 (F11) | README-dev.md | proxy note points to app/proxy_trust.py and HOSTING.md |
| B13 (F14) | README-dev.md | proof-wallet: "run it once; it writes the key to `.env` and prints only the address" |
| B16 (F13) | HotelTabs.tsx | "Proof on Polygon Amoy testnet"; "Add keys in .env (or the host's variables) ..." |
| B17 (F18) | apps/api/seed/load.py | SeedError text: "reset it instead (make reset locally, POST /demo/reset hosted)" (split over lines for ruff E501) |

Tests: no e2e or lib assertion used any changed string (e2e/site-build.spec.ts checks the owner /site page,
unchanged), so none edited. API tests check only the SeedError type.

Checks: next typegen, tsc, eslint (0 warnings), prettier --check, node --test lib/*.test.ts 205/205 pass;
pytest tests/test_seed_totals.py pass; ruff and pylint 10.00 on seed/load.py. Copy scan of the diff: no em
dashes, no exclamation marks.
