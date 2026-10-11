# Claude Code prompts for the final frontend

## STEP A · Terminal (do once, before leaving)

    cd ~/Projects/seedha-real
    unzip -o ~/Downloads/seedha-frontend-kit.zip -d .
    ls docs/FRONTEND_MASTER.md design/Design_Handoff.pdf
    git add docs/FRONTEND_MASTER.md docs/CLAUDE_CODE_PROMPTS.md design
    git commit -m "Add frontend master plan and design kit"
    caffeinate -dimsu &

Optional but best: if Claude Design lets you download the project files
(the .dc.html files plus README.md, SCREENS.md, BEHAVIOR.md, DATA.md,
MATCH_THIS.md, screenshots), unzip them into design/claude-design-files/
before starting.

Then in Claude Code type /clear and paste PROMPT 1.

---

## PROMPT 1 · Autonomous frontend build

    AUTONOMOUS FRONTEND BUILD. I am away. Work without stopping until every
    phase in docs/FRONTEND_MASTER.md is done or only blocked items remain.

    1. Read CLAUDE.md, docs/FRONTEND_MASTER.md, docs/decisions.md and
       docs/progress.md fully.
    2. Read design/Design_Handoff.pdf pages 38 to 58 (README, SCREENS,
       BEHAVIOR, DATA, MATCH_THIS, PROJECT_MEMORY). Then look at every image
       in design/handoff-pages/ and design/video-screens/, and read
       design/VIDEO_SPEC.md. If design/claude-design-files/ exists, open
       every file there; its code is the most exact visual source.
    3. Save docs/AUTONOMOUS_FRONTEND.md containing this prompt word for word
       and commit it, so you can re-read it after any restart.
    4. Write docs/frontend-gap.md: a table of every screen in the handoff,
       its reference page or image, what exists now, what changes, and
       effort. Commit.
    5. Build phases P1 to P9 in order, following section 6 of
       FRONTEND_MASTER.md for every screen. MUST phases first. Decisions in
       section 3 are final; do not ask me about them.
    6. Rules while I am away:
       - Never add a git remote, never push, never touch files outside the
         repo (keep tool caches inside the repo or gitignored).
       - Never change CLAUDE.md business rules or my rulings.
       - Never lower a quality threshold, disable a rule or skip a test.
       - No paid services. Missing keys: build the simulated fallback,
         label it, log it in docs/needs-from-owner.md.
       - New dependencies allowed: framer-motion, three@0.160, d3,
         topojson-client, world-atlas@2.0.2 (bundled locally), fonts via
         next/font (Mukta, Cormorant Garamond, DM Serif Display, Outfit).
         Log anything else in docs/decisions.md with the reason.
       - If something fails 3 times, log it in docs/blockers.md and move to
         the next independent task.
    7. After each phase: make check, Playwright screenshots, update
       docs/SCREEN_COMPARE.md and docs/progress.md, commit locally.
    8. Keep the session lean: when context passes about 150k tokens, update
       docs/progress.md, commit, and continue in a compact state.
    9. When everything is done, add a make target demo-prod (next build +
       next start, seeded sample hotel), run it, and write a final summary at
       the top of docs/progress.md: phases done, screens matching, remaining
       differences, blockers, and the exact demo click path.

---

## PROMPT 2 · Resume (after sleep, network drop or /clear)

    Resume the autonomous frontend build. Re-read CLAUDE.md,
    docs/AUTONOMOUS_FRONTEND.md, docs/FRONTEND_MASTER.md, docs/progress.md,
    docs/decisions.md and docs/blockers.md. Run git status and git log
    --oneline -10. Check that the last files you wrote are complete and pass
    tsc, eslint and their tests. Then continue from the next unfinished
    phase in docs/progress.md.

---

## PROMPT 3 · Final check (when you are back)

    Run make check and the full Playwright suite three times. Start
    make demo-prod. Give me: the URL, how to use Direct beta login, the click
    path for the full 8-step demo with code DEODAR-RS26, the list of screens
    that still differ from the design with screenshots paths, and anything in
    docs/needs-from-owner.md. Do not change code.
