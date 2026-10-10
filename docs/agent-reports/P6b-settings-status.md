# P6b Settings builder status (resume notes)

Worktree .worktrees/settings, branch fe/settings. Do not commit.

## Plan
- API: models OwnerSettings (by subject), StaffInvite (by subject), PlanEntry (by property);
  migration 0009; routers settings.py (/settings/*), calendar.py (/calendar/*);
  services settings.py, calendar.py; tests test_settings_calendar.py.
- Billing is web-only (plan price from lib/plans.ts, sample invoices for the demo, none for accounts).
- Web: calendar/, billing/, settings/ pages; components/settings/*; lib/types-settings.ts; bff owner paths.

## Progress
- [x] API models + migration
- [x] API routers + tests (tests/test_settings_calendar.py, 20 pass)
- [x] Web calendar
- [x] Web billing
- [x] Web settings tabs (components/settings/*, lib/settingsRules.ts)
- [x] axe + screenshots (0 violations)
- [x] checks + report (P6b-settings.md)
