# P7 website: status

State: DONE. Report in docs/agent-reports/P7-web.md. All api and web checks pass; servers stopped,
scratch DB deleted. Nothing committed (the lead merges).

Decisions
- Website theme: tokens re-scoped on a wrapper div (data-site-theme) in
  components/website/site.module.css, so the site is dark first without touching
  globals.css. Choice stored in the existing seedha_theme cookie.
- Public sample repeats are computed read-only (find_candidates, no tie-break, no DB writes).
- "By bookings" in the product window shows room nights, matching the API rank.
- app/not-found.tsx wraps WebsiteFrame because master's root layout has no chrome.
- /hotel/deodar-view and /agent-deck do not exist in this worktree (P5 work); links kept.
