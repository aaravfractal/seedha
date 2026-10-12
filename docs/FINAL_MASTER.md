# Final master brief (saved word for word, 12 October 2026)

FINAL MASTER: FINISH EVERYTHING, THEN READY
Re-read CLAUDE.md, docs/FINAL_READINESS.md, docs/SITE_REAL.md,
docs/HOSTING.md, docs/progress.md, docs/decisions.md and the status files
in docs/agent-reports/. Run git status, git log --oneline -10 and
git worktree list. Save this prompt to docs/FINAL_MASTER.md and commit.

RULES
No new features beyond this list. No changes to money code or locked
numbers. Never push; I push. Never print secrets. Only the lead commits.
Max 3 background agents; relaunch any stalled agent from its status
file. If the network fails, say so and retry; never report a failed
gate as passed. Keep the session lean: commit and update
docs/progress.md after each part.

PART 1: FINISH THE SITE-REAL BUILD
Complete docs/SITE_REAL.md (photo upload and storage, Claude generation
with limits and the D6 guard, browser voice input, review and publish,
hotel addresses with SITE_ROOT_DOMAIN, Copy / Share on WhatsApp / QR,
"Build my site" button, tests and reviews). Then merge site-real into
master.

PART 2: OPEN FIXES AND QUESTIONS
a. Overview checklist bug: after Reset demo data, step 6 "Print a
   checkout slip" showed as done while steps 1 to 5 were not. Steps must
   tick only from real actions in the current demo session, and reset
   must clear all of them. Fix and add a test.
b. Storage: confirm uploaded statement files, hotel photos and invoice
   PDFs are stored in Postgres or a Railway volume, never only on the
   ephemeral disk. Fix if needed. Tell me whether Railway Postgres
   backups are available on my plan and how to restore one.
c. Claude: tell me yes or no whether ANTHROPIC_API_KEY and CLAUDE_MODEL
   are set in my local .env (never print values), and which features use
   it now (site generation, event extraction from pasted text, inbox
   drafts). Give a 1-minute test for each.

PART 3: FINAL READINESS (docs/FINAL_READINESS.md steps 1 to 5)
Merge master into deploy, run the final audit (security and privacy,
demo reliability, docs and honesty), fix every high and medium finding,
run all gates on deploy and master (make check, e2e three times, API
suite on Postgres if possible, 8-step loop on make demo-prod), reset
demo data, and fast-forward so master and deploy point at the same
commit.

PART 4: READY REPORT
a. What was built and fixed (one line each); gates (one line each);
   final commit hash.
b. Exact push commands for both branches.
c. Final Railway and Vercel variable tables (names, value or reference,
   secret yes/no, how to generate), including new ones from site-real.
   Never real values.
d. Railway steps, Vercel steps, the one-off seed command, /health
   check, and the post-deploy checklist with expected results.
e. Hackathon-day commands: make demo-prod, make demo-live, laptop reset,
   hosted reset (token placeholder).
f. Anything still blocked or needed from me.
End with exactly: "READY: safe to push deploy and master."

PART 5: DEMO
After the READY report, start make demo-prod with fresh sample data and
keep it running until I say stop. Tell me the URL.
