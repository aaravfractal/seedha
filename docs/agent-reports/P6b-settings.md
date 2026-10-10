# P6b Calendar, Billing, Settings (settings builder)

Branch fe/settings, not committed. Servers stopped, scratch DB and shot script deleted.

## Files
- API: app/models.py (new OwnerSettings, StaffInvite, PlanEntry, STAFF_ROLES), migrations/versions/0009_settings_staff_plan.py
  (rev 0009 <- 0008, named pk/uq/ck/fk, batch index), app/services/settings.py, app/services/calendar.py,
  app/routers/settings.py, app/routers/calendar.py, app/main.py (include both; settings router imported as
  `owner_settings` because `settings` is a create_app parameter), tests/test_settings_calendar.py (20 tests).
- Web: app/(owner)/(screens)/calendar/page.tsx, billing/page.tsx, settings/page.tsx (tabs), components/settings/
  {Modal.tsx (Modal + LaunchSheet), Switch.tsx, PersonalTab.tsx, HotelTabs.tsx (Hotel, Plan, Contracts), StaffTab.tsx,
  AccountTabs.tsx (Notifications, Security, Privacy), settings.module.css}, lib/types-settings.ts,
  lib/settingsRules.ts + .test.ts (new lib file, outside the listed ones: regexes, mobile clean-up, bps format),
  lib/bff.ts + test (owner: "settings", "calendar").

## Endpoints (all owner token + X-Seedha-Subject; no subject -> 401)
- GET /settings: kind, read_only, note, personal, hotel, notifications, security. Demo gets fictional sample
  details (GSTIN 05ABCDE1234F1Z5, PAN ABCDE1234F, owner@deodarview.example) marked sample.
- PATCH /settings/personal (accounts only; demo 403 demo_read_only). GSTIN/PAN optional, upper-cased, regexes from
  BEHAVIOR p47, PIN 6 digits, email; PAN must equal GSTIN chars 3 to 12. Errors never echo the value; nothing logged.
  Name updates OwnerAccount.name; mobile is the sign-in number, read-only.
- PATCH /settings/notifications: 8 AM line, 9 PM slip, approvals; stored per subject (demo too, no personal data).
- GET /settings/contracts: contract bps from channel_contract vs commission / (list - discount) on counted stays
  (math check passed or accepted), 1 Apr to 30 Sep 2026. Sample hotel: all four OTAs match exactly.
- GET/POST /settings/staff, DELETE /settings/staff/{id}: invite is a record only (mobile ^[6-9]\d{9}$, role
  front_desk|manager|accounts, max 20, duplicate 409); numbers returned masked. Demo: read-only Pooja sample.
- GET /settings/export: account, personal, notifications, staff, plan keys as JSON (web downloads it as a file).
- DELETE /settings/account {confirm: true}: deletes OwnerAccount + its settings/staff rows only; hotel data stays;
  demo 403. Web then clears the session and goes to /login.
- GET /calendar, POST /calendar/plan {event_key}, DELETE /calendar/plan/{key}: five sample events Oct 2026 to
  Jan 2027 (Winter Line Carnival 25 to 30 Dec with the handoff decision). Decisions are template text naming the
  lowest net ADR OTA (scenario.lowest_ota); the only rupee figures are ledger net ADRs (direct 4,283 vs Agoda 2,598,
  +1,685 per room night). Plan entries per property (demo allowed; wiped by demo reset).

## Billing (web only, D7)
Plan card from lib/plans.ts (Base 1,499, yearly 14,990), "Pay ₹1,499 now" and "Add payment method" open the same
aria-modal sheet "Payments open after launch." with no fields. Demo: next charge 3 Nov 2026 + 3 invoices, all
labelled Sample. Accounts: "No charge yet", empty invoices. UPI AutoPay and PCI DSS gateway rows say Planned.

## Checks
- API: ruff check + format clean; mypy app tests seed clean (104 files); pytest 465 passed; pylint 9.98 / 9.97;
  bandit clean; route-auth sweep passes; alembic upgrade head -> downgrade base -> upgrade head OK on scratch DB.
- Web: next typegen, tsc, eslint --max-warnings=0, prettier --check all clean; node --test lib/*.test.ts 50 pass.

## Axe
/calendar, /billing, /settings (all 8 tabs), light and dark, 1440 and 390, demo session and an owner account
session (with form errors shown, the Pay sheet and the delete dialog open): 0 violations, no horizontal scroll.
Fixed on the way: contracts table scroll region at 390 (now stacked rows; invoices too).

## Remaining visual differences
- Settings tabs are wrapping-free chips that scroll on phone (reference shows a grey scrollbar; ours is thin).
- Billing next charge says "₹1,499 for Seedha Base" instead of "via UPI AutoPay" (AutoPay is Planned, D8).
- Calendar opens on December 2026 (as in the reference); grid cells are visual only (aria-hidden), the event
  cards carry the dates for screen readers.
- Security shows Two-step sign-in, Encrypted at rest and Sign out on other devices as Planned; Idle check is
  worded as what the shell does (asks after 30 min). Last sign-in is not stored: shows Account created and First
  sign-in (verified_at) for accounts.

## Lead: changes needed elsewhere
1. lib/screens.ts: drop `built: false` on calendar and billing.
2. app/routers/site.py demo reset: add "owner_settings" and "staff_invite" to `keep`, else a reset wipes real
   accounts' business details and invites (plan_entry is property data and should be wiped).
3. Add a decision to docs/decisions.md (D-088 suggestion): demo read-only for personal/staff/delete; notifications
   and plan entries allowed for demo; billing web-only with sample history for the demo; contracts rule above.
4. e2e a11y spec already visits the three routes; tabs use role=tablist/tab/tabpanel with arrow keys if a spec
   wants to click "Contracts" etc. Settings no longer has the old ".card" Connections/Log out markup: reset is
   "Reset demo data" in the Hotel tab (confirm in a dialog: "Yes, reset everything"), sign out is in Security.
