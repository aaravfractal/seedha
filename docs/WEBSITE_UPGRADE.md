# Website upgrade and privacy clean-up: instructions (saved word for word)

WEBSITE UPGRADE + PRIVACY AND PROFESSIONAL CLEAN-UP (FINAL)
Scope: public website, legal pages, public copy in the app, README files,
docs and metadata. No changes to business logic, money code, the 8-step
demo flow or locked numbers. Time box: 5 hours. Seedha Pass and Event
Radar are planned features shown with sample content only; nothing may
look or read as live.

0. SETUP
Re-read CLAUDE.md, docs/FRONTEND_MASTER.md and docs/progress.md. Save this
prompt to docs/WEBSITE_UPGRADE.md and commit. Run the app and the 8-step
demo once to confirm everything works before changing anything.

1. TEAM (max 4 background agents at once, own worktrees, only the lead
   commits)
- LEAD (main): plans, assigns files so no two agents edit the same file,
  merges, runs gates, commits.
- GLOBE BUILDER: one shared 3D Earth component for the website.
- SECTIONS BUILDER: Seedha Pass and Event Radar sections.
- PRIVACY AND POLISH BUILDER: section 5.
- REVIEWERS after the build (read-only, reports in
  docs/agent-reports/website-upgrade-*.md): design QA; accessibility and
  performance; privacy, honesty, legal and security.
Fix every high and medium finding before finishing.

2. SHARED 3D GLOBE (GLOBE BUILDER)
- three@0.160 with d3, topojson-client and the bundled world-atlas@2.0.2
  data. No runtime CDN or network requests. Reuse existing globe code if
  present; do not duplicate it.
- Map rule: render land shapes only (the land topology). Draw no country
  or internal border lines anywhere, on the globe or the fallback map.
- Look: calm, premium Earth in the site's tokens (graphite land, soft
  pine glow, subtle atmosphere), slow auto-rotate that stops on hover or
  touch, drag to rotate, ease to North India on first view, light and dark.
- Two layers with a segmented toggle:
  "Seedha Pass": pine markers on planned towns Mussoorie, Nainital,
  Rishikesh, Auli, Shimla, Manali, joined by soft arcs, labelled
  "Planned town".
  "Event Radar": gold markers for sample events, each with a card (name,
  town, dates, "Sample"). Use only events already in repo data with their
  dates (Winter Line Carnival, Mussoorie). Add up to 4 more well-known
  regional events by name only, each showing "Dates to confirm".
- Performance: lazy-load when the section scrolls into view; under 300 KB
  extra JS gzipped; 60 fps on a laptop; pause rendering off screen;
  device pixel ratio capped at 2.
- Fallbacks: reduced motion, no WebGL or a low-end phone shows a static
  land-only map of North India with the same markers.
- Accessibility: canvas marked aria-hidden; an accessible text list of
  every marker sits beside it; toggle uses aria-pressed; keyboard usable.

3. SECTIONS (SECTIONS BUILDER), future tense throughout
A. Seedha Pass (after the features section):
- "Seedha Pass. One network of owner-run hill hotels."
- Guests will get perks at every Seedha hotel, never lower prices; faster
  check-in from a profile the guest controls; hotels will refer guests to
  each other with no commission.
- "Shared between hotels only with the guest's separate consent."
- Pills "Planned" and "Phase 3". Globe opens on the Seedha Pass layer.
B. Event Radar (extend the existing Pulse section):
- "Know about every event near you, not just Diwali."
- Seedha will gather upcoming local events from official sources; one
  WhatsApp line each morning will tell the owner what's coming; the owner
  decides rates, room holds and packages, and Seedha never sets a price.
- Sample bubble labelled "Sample": "Winter Line Carnival in Mussoorie,
  25 to 30 Dec. Keep rooms for direct guests and check your rates."
- "Official event sources only. No scraping."
- Pills "Pro" and "Planned". Same globe, Event Radar layer by default.

4. COPY RULES (all public copy)
No em dashes, no exclamation marks, no "not X but Y", no colon-then-reveal
lines, no "genuinely", no stacked hedges, no one-word closing sentences,
no closing questions. No rupee figures in the new sections. Tokens, type
scale and motion from FRONTEND_MASTER.md. Works at 390, 760, 980, 1440;
light and dark; contrast 4.5:1.

5. PRIVACY AND PROFESSIONAL CLEAN-UP (PRIVACY AND POLISH BUILDER)
A. Remove real people's identity everywhere in the repo:
- Search app code, public pages, legal pages, README files, docs, page
  metadata, Open Graph tags, package.json author fields, LICENSE lines,
  firmware headers, sample site footers and .env.example for real names,
  personal emails, phone numbers, student IDs, personal GitHub or social
  handles, and any teammate placeholder (including a hospitality or hotel
  management teammate). Report every hit to me in the final reply.
- Replace with role-based wording: "The Seedha team", "Founder",
  "Product", "Hardware". The About page describes the team by roles and
  the event (TBI GEU AI-Tourism Hackathon, Track D6) with no names.
- Rename the owner-named needs file in docs/ to docs/needs-from-owner.md
  (name changed here during the privacy clean-up) and update
  every reference to it, including docs/AUTONOMOUS_FRONTEND.md.
- Remove links to personal profiles from the website.
- Keep fictional sample personas (Rajesh ji, Pooja, Neha Gupta, Rahul S.)
  and label them as sample data.
- Do not rewrite git history or commit messages.
B. Contact details without personal data:
- Add PUBLIC_CONTACT_EMAIL, PUBLIC_PRIVACY_EMAIL and PUBLIC_SECURITY_EMAIL
  to .env.example with empty values; pages read them from config.
- When unset, show "Contact details will be published before launch." No
  bracket placeholders, no personal addresses, no new forms.
C. Complete the legal pages (/privacy, /terms, /cookies, /security,
   /data-deletion). Keep the visible notice "Draft for the hackathon
   prototype. Not legal advice. To be reviewed by a lawyer before launch."
   and a last-updated date. Cover in plain language:
- Who we are: Seedha, a pre-launch product built for the TBI GEU
  AI-Tourism Hackathon; no company registration claimed.
- Roles: for guest data the hotel is the Data Fiduciary and Seedha acts
  as its Data Processor; for owner account data Seedha is the Data
  Fiduciary. Written with India's DPDP Act 2023 and DPDP Rules 2025 in
  mind; no claim of full compliance.
- What we collect, why, and the basis (consent for guest offers; contract
  for owner accounts).
- What we never do: message guests found through OTA statements, sell
  data, put personal data on a public chain (only salted fingerprints),
  scrape OTA sites.
- Retention: proposed periods marked "proposed", final periods set before
  launch.
- Rights and how to use each: access, correction, erasure, withdraw
  consent (reply STOP), grievance, nominate a person; link /data-deletion.
- Grievance Officer as a role, reached via PUBLIC_PRIVACY_EMAIL.
- Processors by category only (hosting, WhatsApp Business messaging,
  payment gateway, AI service for reading statements). Measures not built
  yet are listed as "Planned"; no certification claims.
- Children: not intended for anyone under 18. Data location: "Planned:
  stored in India before launch." Breach handling, strictly necessary
  cookies only, and how policy changes are announced.
- Terms: the owner approves every guest message, no lower public rates
  through Seedha, acceptable use, limitation of liability, governing law
  India, courts at Dehradun.
D. Professional polish: consistent product names (Seedha, Seedha Desk,
   Seedha Link, Seedha Site, Seedha Proof, Seedha Pulse, Seedha Pass),
   sentence case, one primary action per section, no typos, no developer
   wording on screen, every page with a proper title, meta description,
   favicon and Open Graph image without personal details.
E. Git hygiene, report only: list the author names and emails in git log
   and explain how to set a GitHub no-reply email for future commits.

6. DOCS
Add "Seedha Pass" and "Pulse Event Radar" to docs/ideas.md under "After
the hackathon" (separate network consent, guest-controlled profile, no
commission between hotels; official event sources only, the owner sets
every price, a channel decision and not a demand prediction). Log privacy
and map decisions in docs/decisions.md.

7. VERIFY AND FINISH
- Playwright: both sections render; layer toggle works; static fallback
  under reduced motion; text list matches markers; no border lines drawn;
  legal pages render with no bracket placeholders.
- Personal-data test: store only SHA-256 hashes of the blocked words in
  the test (never the words themselves) and fail if any public-facing or
  docs file contains a matching word.
- Run make check, the e2e suite three times in a row, make demo-prod and
  the full 8-step loop. Reset demo data afterwards.
- If the globe misses the performance budget or the time box, ship the
  static land-only map and log it in docs/decisions.md.
- Commit locally, update docs/progress.md, and reply in 8 lines: what was
  built, globe or fallback, performance numbers, personal-data hits
  removed, privacy gaps filled, review findings fixed, gates status,
  anything needed from me.
