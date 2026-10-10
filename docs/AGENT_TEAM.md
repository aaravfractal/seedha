# Agent team for the autonomous frontend build

Added to the build on 10 Oct 2026. Read with docs/AUTONOMOUS_FRONTEND.md and
docs/FRONTEND_MASTER.md. The instructions are saved word for word below.

---

Add this to the autonomous frontend build. Keep everything in
docs/AUTONOMOUS_FRONTEND.md and docs/FRONTEND_MASTER.md.

Run the build as a team of agents with clear ownership, and save this
team plan to docs/AGENT_TEAM.md and commit it.

LEAD (you, main): owns the plan, assigns work, merges, resolves conflicts,
runs make check, commits. Only the lead commits.

BUILDERS (parallel, one screen or area each, never two on the same file):
- Shell builder: app shell, header, sidebar, Overview (P1)
- Owner screens builder: P2 screens
- Desk and Guest builder: P3
- Auth builder: P4
- Site builder: P5 and World B
Each builder works on its own files, reports changed files and test
results, and hands back to the lead. If two builders need the same file,
the lead does that change.

REVIEWERS (run after each phase, read-only, report findings to the lead):
- Design QA agent: compares Playwright screenshots at 1440 and 390, light
  and dark, with the reference images; lists every visual difference.
- Code quality agent: reviews the diff for duplication, typing, naming,
  dead code, test gaps; must keep make check green.
- Security agent: reviews the diff against CLAUDE.md rules and
  FRONTEND_MASTER.md decisions D4 to D8: auth and OTP limits, session
  handling, input validation, CSP, no secrets, no card data, no AI-written
  rupees, rule 7 (owner approves every guest message), no false security
  claims in copy.
- Accessibility and performance agent: axe checks, keyboard paths,
  reduced motion, flip under 1 second.
The lead fixes or assigns every finding before the next phase.

IDEAS AGENT (after P4 is done): reads the product and proposes up to 5
improvements that make the demo stronger for hotel judges. It may only
propose, never build. Write them to docs/ideas.md with effort and risk.
The lead may build an idea only if all MUST phases pass, it takes under
2 hours, and it breaks no rule. Candidates already approved in principle:
Split the Commission (share part of saved commission as guest perks),
Direct Booking Score (0 to 100 readiness score), Seedha Recover (turn a
flagged statement row into a dispute draft). Everything else stays in
docs/ideas.md for me to review.

Limits: at most 4 agents running at once. Keep each agent's output short
and saved to files, so the main context stays lean. All the earlier rules
still apply: no remote, no push, nothing outside the repo, no lowered
thresholds, simulated fallbacks for missing keys, blockers logged.

Continue the build now with this team.

---

## How the lead runs it

- Builders that touch the web app work in separate git worktrees inside the
  repo (`.worktrees/`, gitignored) on their own branches; the lead merges
  their branches into `master` and is the only one who commits there.
- Files several builders need (globals.css tokens, layout.tsx, lib/types.ts,
  lib/bff.ts, the API models and migrations, shared components) are owned
  by the lead: the lead lands those first, then builders start from that
  commit.
- Agent reports go to `docs/agent-reports/<phase>-<role>.md`.
- At most 4 agents run at once, counting reviewers.
