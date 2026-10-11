# Website upgrade: privacy and polish (brief section 5)

Builder: privacy and polish. Worktree `.worktrees/privacy`, branch `up/privacy`. Not committed.
Names of real people are never repeated here: "OWNER" is the owner's real first name, "T1"/"T2" the two teammates,
"HT" the word "teammate" after "Hospitality" (that pair is blocked by the test).

## A. Personal-data hits (all fixed unless marked LEAD)

| file:line | kind | became |
|---|---|---|
| apps/web/app/(website)/about/page.tsx:7 | real full names of OWNER, T1, T2 (public page) | `TEAM` by role: Founder, Product, Hardware; section "The team" names the event and Track D6 |
| apps/web/app/(website)/about/page.tsx:52 | "[Hospitality HT]" placeholder | removed |
| docs/AUTONOMOUS.md:87-88 | three real full names + "[Hospitality HT]" | "the team described by roles (Founder, Product, Hardware) with no names" |
| docs/AUTONOMOUS.md:45, 163 | file name needs-from-OWNER | docs/needs-from-owner.md |
| docs/AUTONOMOUS.md:97, 108 | bracket placeholder instructions | read PUBLIC_*_EMAIL; pending line when unset |
| docs/FRONTEND_MASTER.md:25 | "OWNER's rulings" | "the owner's rulings" |
| docs/rulings.md:1 | "(OWNER)" | "(product owner)" |
| docs/blockers.md:66, 70, 74, 94, 113 | OWNER first name | "the owner" |
| docs/CLAUDE_CODE_PROMPTS.md:47, 82 | needs-from-OWNER path | needs-from-owner.md |
| docs/AUTONOMOUS_FRONTEND.md:27 | needs-from-OWNER path | needs-from-owner.md |
| docs/needs-from-OWNER.md | file name | `git mv` to docs/needs-from-owner.md (staged) |
| docs/needs-from-owner.md:1, 28, 29-30 | title with OWNER; item 7 "hospitality HT name"; item 8 placeholders | "Needs from the owner"; item 7 marked done (roles); item 8 now names the three env vars |
| docs/WEBSITE_UPGRADE.md:88 | needs-from-OWNER path in the saved brief | "the owner-named needs file" (note: the brief was saved word for word; this one line changed) |
| README-dev.md:131 | needs-from-OWNER | needs-from-owner |
| privacy/page.tsx:167, contact/page.tsx:27, security/page.tsx:16 | "[grievance officer name]", "[contact email]", "[security email]" | `ContactEmail` from config |

Checked and clean: .env.example, apps/web/package.json (no author field), no LICENSE file, firmware README and
`src/main.cpp` header, design/handoff-text/*.md, apps/api code, sample hotel site footer. All phone-shaped numbers
are dummies (98765 43210, 90000 00000, 98111 11111 patterns). All emails use `.example`/`example.com` domains.
Fictional personas kept (Rajesh ji, Pooja, Neha Gupta, Rahul S./Rahul Sharma); About now labels them sample data.
Not removable by me: one commit subject (B-003, "caches deleted on OWNER's instruction") is in git history.

### LEAD: replacements for decisions.md and progress.md (ideas.md has no hits)
A ready patch is in the builder's session scratchpad (`<scratchpad>/privacy/lead.patch`; full path in the hand-off message, kept out of this file because it contains the macOS user name)
(`git apply` from the repo root; verified: it applies and the personal-data test then passes). Same edits by hand:
- decisions.md:1 "# Decisions made without OWNER" -> "# Decisions made without the owner"
- decisions.md:15, 256, 277, 437 "needs-from-OWNER" (lower case) -> "needs-from-owner"
- decisions.md:386 "only the placeholders OWNER named" -> "only the placeholders the owner named"
- decisions.md:431 "(open, for OWNER)" -> "(open, for the owner)"
- decisions.md:439 "(OWNER approved item 9," -> "(owner approved item 9,"
- decisions.md:622 "OWNER." -> "the owner."
- progress.md:4, 40, 91, 536, 566, 592 "needs-from-OWNER" -> "needs-from-owner"
- progress.md:91 "**Needs OWNER**" -> "**Needs from the owner**"
- progress.md:93 "the teammate's name and the legal emails" -> "the team names and the legal emails"
- progress.md:97 "OWNER deleted it on 10 Oct." -> "The owner deleted it on 10 Oct."
- progress.md:543 "team with the [Hospitality HT] placeholder" -> "team then listed by name, now by role"
- progress.md:566 "hospitality HT name (needs-from-owner.md items 7 and 8)." -> "team names (needs-from-owner.md items 7 and 8; now resolved by roles)."
- progress.md:638 "deleted by OWNER (confirmed)" -> "deleted by the owner (confirmed)"
New lead entries (decisions D-09x, progress, ideas) must use role wording too, or the test fails.

### Copy outside my files (for the owners of those files)
- components/website/Pricing.tsx:119, 126, 130 (Careers): "Placeholder roles…", "Placeholder." and `mailto:careers@example.com`.
  Suggest: drop the mailto (client component cannot read server env) and link "Apply" to /contact; reword the lede to
  "Roles we plan to hire for after launch."
- app/favicon.ico is the stock Next.js "N" mark (no personal data). I added app/icon.svg (Seedha pine mark), which
  modern browsers prefer; delete favicon.ico later if you want one icon.

## B. Contact config
`lib/contact.ts`: `publicEmail(kind)` reads PUBLIC_CONTACT_EMAIL / PUBLIC_PRIVACY_EMAIL / PUBLIC_SECURITY_EMAIL from
`process.env`, trims, accepts only a plain address (no brackets, spaces or "TBD"). `ContactEmail` (server component in
components/LegalPage.tsx) renders a mailto link or "Contact details will be published before launch."
Pages stay static (○ in `next build --webpack`): values are read at build time, so set them before building
(documented in .env.example, README-dev.md, apps/web/README.md). Verified: with PUBLIC_CONTACT_EMAIL set, the prerendered
/contact has the mailto and /privacy shows the pending line; the address is not in any client bundle.
/contact and /data-deletion were client pages: split into server pages (now with metadata) plus `PlanNote.tsx`
(useSearchParams, in Suspense) and `DeletionForm.tsx` (the existing form, unchanged behaviour). No new forms.

## C. Legal coverage (brief 5C)
| item | where |
|---|---|
| Draft notice + last updated 11 October 2026 | LegalPage (all five) |
| Who we are, pre-launch, hackathon, no registration claimed | privacy 1, terms 1 |
| Hotel = Data Fiduciary / Seedha = Processor (guests); Seedha = Fiduciary (owner accounts); DPDP Act 2023 + Rules 2025 in mind, no full-compliance claim | privacy 2 |
| What, why, basis (consent for guest offers; contract for owner accounts) | privacy 3 |
| Never: message OTA guests, sell data, personal data on a public chain, scrape | privacy 4, terms 5-7 |
| Retention, each marked "proposed" | privacy 6 |
| Rights: access, correction, erasure, withdraw (STOP), grievance, nominate; /data-deletion link | privacy 7, data-deletion "Your other rights" |
| Grievance Officer as a role via PUBLIC_PRIVACY_EMAIL | privacy 8, data-deletion |
| Processors by category only (hosting, WhatsApp Business messaging, payment gateway, AI service) | privacy 9 |
| Built vs Planned measures, no certification claim | privacy 10, security |
| Under 18; "Planned: stored in India before launch."; breach handling; strictly necessary cookies; changes | privacy 11-15, cookies |
| Terms: owner approves every message, no lower public rates, acceptable use, liability, India law, Dehradun courts, changes | terms 4-12 |
Facts checked against code: Merkle root stored locally, "not yet on a public chain"; consent tokens and device keys
stored as SHA-256 hashes; OTP sign-in with try limits (sender simulated); rate limits (D-071); STOP keeps the withdrawn
record, erasure removes number and salt (services/proof.py); session cookie 12 h or 30 days with "Keep me signed in"
(the cookie page said 12 h only: fixed); three cookies match code (seedha_owner, seedha_theme, seedha_cookies).

## D. Polish
Titles + meta descriptions on about, privacy, terms, cookies, security, data-deletion, contact, faq, careers.
Root layout: metadataBase (WEB_ORIGIN), Open Graph site name/locale, twitter large card. `app/opengraph-image.tsx`
(1200x630, brand mark and product line, bundled font, static at build). Footer: "Pulse" -> "Seedha Pulse",
"WhatsApp us" (no WhatsApp on /contact) -> "Get help", "© 2026 The Seedha team" (no company implied). Security page
"Desk API" -> "Desk connection". FAQ blockchain answer now says the root is not yet on a public chain. Hindi typo
"jodha" -> "joda". README-dev sample hotel name fixed to Hotel Deodar View; apps/web/README.md replaced the
create-next-app boilerplate. No "API", "env", "localhost" or bracket placeholders left on the website pages.

## E. Git authors
`git log --format='%an <%ae>' | sort -u` gives one identity, 67 commits: OWNER's real full name with a personal
Gmail address (name plus four digits). For future commits (do not rewrite history):
1. GitHub > Settings > Emails: tick "Keep my email addresses private" (and "Block command line pushes that expose my
   email"). The page shows your no-reply address, `<id>+<username>@users.noreply.github.com`.
2. In this repo: `git config user.email "<id>+<username>@users.noreply.github.com"` and, if wanted,
   `git config user.name "Seedha team"`.

## F. Personal-data test
`apps/web/lib/personal-data.test.ts`: 8 SHA-256 hashes (OWNER's first name, the full-name handle, the handle with its
digits, the personal email, T1 and T2 first names, T2 surname, the Hospitality HT pair). No plaintext anywhere.
It lower-cases each line, hashes every word token, every adjacent word pair and every email-shaped token, and also
checks file paths. Scope: apps/web/{app,components,lib,public}, firmware src/include/lib/test/tools + README +
platformio.ini, docs/**/*.md, design/handoff-text/*.md, README-dev.md, apps/web/README.md, .env.example, CLAUDE.md,
package.json. Personas are not blocked ("Sharma" and "Singh" are deliberately allowed). Runtime about 0.35 s.
Status: FAILS in this branch on decisions.md and progress.md only, until the lead applies the patch above.

## Checks
typegen, `tsc --noEmit`, `eslint --max-warnings=0`, `prettier --check .`: pass. `node --test lib/*.test.ts`: 72 of 73
(only the personal-data test, see F). `next build --webpack`: pass, legal pages static. axe (wcag2a/aa, 21a/aa) on
/about, /privacy, /terms, /cookies, /security, /data-deletion, /contact, /faq, /careers, light and dark, 1440 and 390:
0 violations, no bracket text, no horizontal scroll. Servers stopped; scratch DB, .next and scripts deleted.
