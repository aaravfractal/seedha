# Ideas builder status (resume file)

Worktree .worktrees/ideas, branch fe/ideas. Order: 1 Recover, 2 Split, 3 Score.

- [x] 1 Seedha Recover: API done (pro.audit_lines shared; services/recover.py; GET /statements/disputes, GET /statements/rows/{id}/dispute; tests/test_recover.py). Web: components/owner/Recover.tsx on Upload, Pro Audit link to /upload#disputes. Visual + axe done (0 violations upload/pro, light/dark, 1440/390).
- [x] 2 Split the Commission: services/savings.py perk_split + SAMPLE_PERK_COST_PER_NIGHT (₹400); GET /savings adds nights, perk, perk_cost, kept_after_perk per item, perk_cost_per_night + perk_cost_is_sample, optional ?perk_cost_per_night=<rupees 0..5000>; tests/test_perk_split.py. Web: components/owner/PerkSplit.tsx on Savings. axe 0.
- [x] 3 Direct Booking Score (minimal): lib/readiness.ts (+ test), components/owner/ReadinessCard.tsx on Overview after KPI tiles. axe 0.

All checks green; servers stopped; scratch DB deleted. Report: docs/agent-reports/ideas-built.md. Nothing left to do but lead review and merge.
