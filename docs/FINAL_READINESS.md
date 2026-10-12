# Final finish and readiness brief (saved word for word, 12 October 2026)

FINAL FINISH AND READINESS: NO NEW FEATURES
Goal: one clean, tested codebase ready for Railway + Vercel setup and for
the hackathon demo tomorrow. Time box: 2 hours. Save this brief to
docs/FINAL_READINESS.md and commit first. Let the current make check on
deploy finish and report its result before step 1.

RULES
- No new features, no redesigns. Only finish, merge, fix and verify.
- Do not change money code results or locked numbers.
- Never push; I push. Never print secrets.
- Only the lead commits. Max 3 background agents.

1. FINISH AND MERGE (lead)
a. Confirm the hosting security fixes are complete on deploy.
b. Make sure H1 (Postgres compatibility, migration 0013, CI workflow) and
   all H2/H3 work are merged into deploy.
c. Merge the polish build (room board, guest inbox with invoices,
   interactive Pro page) into master if not already merged.
d. Merge master into deploy so deploy contains everything. Resolve
   conflicts carefully; report each one.
e. Remove finished worktrees and temporary files; keep branches. Stop any
   leftover background agents that have finished.

2. FINAL AUDIT (parallel, read-only, reports in
   docs/agent-reports/final/)
- A1 Security and privacy: no secrets in tracked files or history, .env
  ignored, consent rule, owner approval for every guest message, AI never
  writes rupees, rate limits behind Railway's proxy, public-mode safety,
  testnet-only chain guard, no personal names in public files.
- A2 Demo reliability: run make demo-prod and the full 8-step loop with
  DEODAR-RS26; check the room board, inbox invoice flow, Pro page, Pulse
  section, globe, Event Radar (appears once), Seedha Pass; check reset
  demo data restores everything; check it works with no internet.
- A3 Docs and honesty: README.md for judges, README-dev.md,
  docs/HOSTING.md and the post-deploy checklist match the code; real vs
  simulated labels are honest everywhere.
Lead fixes every high and medium finding.

3. GATES (on deploy, then on master)
make check (API, web, e2e, secrets history, firmware), e2e three times in
a row, the API suite on Postgres if possible, and the 8-step loop on
make demo-prod. Then reset demo data. Report actual output, not only
exit codes. If the network fails, say so and retry; never report a
failed gate as passed.

4. BRANCH ALIGNMENT
When deploy passes every gate, fast-forward master to deploy so both
point at the same commit. Confirm with git log.

5. READY REPORT (send this, then stop)
a. Status: merged items, audit fixes, gate results (one line each),
   final commit hash.
b. Exact push commands for both branches.
c. Final Railway and Vercel variable tables (names, value or reference,
   secret yes/no, how to generate), including any new shared secret.
   Never real values.
d. Railway steps in order: branch, root directory, Postgres, variables,
   generate domain, deploy, the one-off seed command (with Railway CLI
   install and login), and the /health check.
e. Vercel steps in order: new project, branch, root apps/web, Node
   version, variables marked Sensitive, deploy, then the two Railway
   variables to update with the Vercel URL and redeploy.
f. Post-deploy checklist with expected results.
g. Hackathon-day commands: make demo-prod, make demo-live, the hosted
   demo reset command (placeholders for the token), and the laptop reset.
h. Anything still blocked or needed from me.
End with exactly: "READY: safe to push deploy and master."
