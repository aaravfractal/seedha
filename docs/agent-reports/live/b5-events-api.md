# B5 Event extraction API (Event Radar Lite)

Worktree `.worktrees/events-api`, branch `live/events-api`. Not committed.

## Files
- `apps/api/app/services/events.py` (new): guard, EVENT_SCHEMA, prompt, ClaudeEventReader, sample extraction, save_drafts, morning text.
- `apps/api/app/routers/events.py` (new): `/events` routes and their Pydantic models.
- `apps/api/app/models.py`: `OwnerEvent` (table `owner_event`, unique property_id + name + start_date).
- `apps/api/migrations/versions/0011_owner_event.py` (revises 0010).
- `apps/api/app/services/calendar.py`, `app/routers/calendar.py`: owner events merged, `own-<id>` plan keys.
- `apps/api/app/main.py`: router registered. `apps/api/tests/test_events.py` (new).

## Contract as built
- `POST /events/extract {text 1..6000, source_url https <=500}` -> `{mode, note, events, rejected[{index, name|null, reason}]}`. Saves nothing.
  Rate limit 5/min per signed-in subject (bucket `events_extract`, plus the usual 20x global ceiling), 429 `too_many_requests`.
  No key: `mode "sample"`, `note "Sample extraction. Add ANTHROPIC_API_KEY to read your own notice."`, Winter Line Carnival 2026-12-25..30, Mussoorie, festival, high, owner's URL.
  With key: Claude structured output (create, 30 s timeout, 1 retry); API error, non end_turn, bad JSON -> 503 `extract_unavailable`.
  Bad URL -> 422 `bad_source_url`; whitespace-only text -> 422 `empty_notice`; length limits -> 422 `invalid_input`.
- Guard reasons (in check order): `bad_length`, `money_mentioned`, `web_address`, `bad_category`, `bad_demand`, `bad_dates`, then `duplicate`, `too_many` (over 10).
  Save adds `already_saved` and `too_many` (200 per property cap). Rejected `name` is null unless the name is safe (no money, no link, <= 80).
- `POST /events {source_url, events, origin?}` -> `{saved: [OwnerEventOut], rejected}`; draft fields are loose strings so bad values get a reason, not a 422; each draft's own source_url is ignored.
- `GET /events` -> `[OwnerEventOut]`; `DELETE /events/{id}` -> remaining list (404 for another property), also removes its plan entry.
- OwnerEventOut = EventDraft + `id, origin, created_at, in_plan, plan_key ("own-<id>")`.
- `/calendar` EventOut gains `origin` ("sample" | "owner_source" | "sample_extraction"), `source_url`, `town`, `demand` (last three null for samples). Events sorted by start.
  Owner events: `rooms 0`, `tag` from category, `action` high -> `no_discount`, medium -> `hold`, low -> `keep` (new value), fixed decision text with no digits.
- `POST /calendar/plan` and `DELETE /calendar/plan/{key}` accept `own-<id>` of this property only (404 otherwise).
- `GET /events/morning-preview` -> `{en, hi, simulated: true, count}` (events touching today..today+14, today = Desk business date).
  `POST /events/morning-preview/send` -> `{status: "simulated", sent_at, count, note}`; logs only, never calls WhatsApp.

## Verify
`cd apps/api && .venv/bin/pytest -q tests/test_events.py` then `make check-api` in the worktree.

## Open issues / deviations
- Extra response fields: `note` on extract; `town`, `demand` on calendar events; `count`, `note` on send; DELETE returns the remaining list.
- Rate limit keyed by subject (not client IP), implemented in the router so `ratelimit.py` stays untouched.
- Demo reset already deletes every table except accounts, so `owner_event` is cleared with no change.
- Two concurrent saves of the same new event could hit the unique constraint (500); acceptable for one owner.
- Gates run: ruff, format, mypy strict, pylint (app 9.97, tests 9.98), full pytest 98.09% total, money code 100%, bandit, detect-secrets. pip-audit not run (needs network; no packages changed).
