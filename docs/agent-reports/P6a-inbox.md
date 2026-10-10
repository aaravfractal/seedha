# P6a Guest inbox and Assistant · builder report (branch fe/inbox)

## Files
- API new: app/services/inbox.py, app/routers/inbox.py, app/services/assistant.py, app/routers/assistant.py,
  migrations/versions/0008_guest_inbox.py (rev "0008" <- "0007", named pk/fk/ck/uq), tests/test_inbox.py (28),
  tests/test_assistant.py (15). Changed: app/models.py (InboxMessage, InboxAway only), app/main.py (2 includes),
  app/routers/webhooks.py (stores inbound texts after the unchanged STOP handling; response still {"withdrawn": n}).
- Web new: components/inbox/{Inbox,ThreadView,Profile,Dialogs}.tsx, Inbox.module.css, format.ts; lib/types-inbox.ts;
  app/(owner)/(screens)/assistant/assistant.module.css. Replaced: inbox/page.tsx, assistant/page.tsx.
  lib/bff.ts + test: "inbox" and "assistant" are owner paths.

## Endpoints (all owner-only; route-auth sweep passes)
- GET /inbox/threads?filter=all|unread|auto|open&q= : one thread per active Desk consent (not withdrawn, not
  erased, has a number). Last message, unread, auto_replied, window_open, counts per filter, away state, rate card
  lines written by code from room rack rates. Never returns a phone number.
- GET /inbox/threads/{id}/messages : bubbles (inbox texts + sent win-back messages), can_reply, suggestions (fixed
  canned text with perk code/link, no prices), booking card (latest Seedha Link booking, else consented stay),
  profile = what we hold (name, city, consent time, proof status, perk code, stays from bookings with the guest_id;
  language is "Not recorded" because nothing stores it). Withdrawn/erased -> 404.
- POST /inbox/threads/{id}/messages {body} : owner's own send; active consent only; only if the guest wrote within
  24h, else 409 window_closed ("WhatsApp allows only an approved template now, use Approvals"). Appends "Reply STOP
  to opt out." to every outgoing text (CLAUDE.md rule 5 says every message, stricter than D5 "offers"). Uses the
  existing simulated/Cloud sender (app.state.sender override); failed send rolls back.
- POST /inbox/threads/{id}/draft : Claude suggestion (ClaudeReplyWording, app.state.reply_wording override) or
  canned reply; D6 guard rejects ₹, rs+digits, any 3+ digit number (plus drafter MONEY_PATTERN: %, rupees, INR).
  Returned with label "Bot drafts, you send.", never sent, never stored.
- PATCH /inbox/away {text?, approved, enabled?} : text saved only with approved=true (422 approval_required);
  enabling needs a saved text (409). Away reply fires only inside inbound handling (guest wrote first), only for an
  active consent, at most once per thread per 24h, body = owner text + STOP line. No AI path exists.
- POST /inbox/threads/{id}/read, /simulate {text} (demo guest message via the same STOP + store path; STOP returns
  null and the thread disappears), /forget {confirm:true} (deletes the thread's texts, then proof.erase_consent).
- GET /assistant (greeting, reading chips, 6 suggestions), POST /assistant {question}: keyword match to 10 fixed
  intents. 4 reuse ask.compute_answer (last month MMT, repeat guests, payouts, today's close); the rest read
  load_ledger / overview.savings_for / scenario.saturday_move. Answer, figures, sources (ledger period, "6
  statements, 1,500 rows, 3 flagged and left out", screen links), next chips, worded_by. Claude rewording only
  through ask.phrased() (same numbers or template). Unknown -> "I can answer questions about ...", no figures.

## Checks
- API: ruff OK, ruff format OK, mypy OK (95 files), pytest 404 passed; alembic upgrade->downgrade base->upgrade OK.
- Web: tsc OK, eslint 0 warnings, prettier OK, node --test 42/42.
- Tests prove: consent-only threads (12 matched guests, 0 threads; unconsented webhook number stores nothing),
  withdrawn hidden and unsendable (404 on every route), 24h window both sides, STOP via webhook and simulate still
  withdraws and is not stored, away approval/enable/once-a-day/never to non-writers, D6 cases, draft never sent,
  forget, assistant figures == ledger (₹47,33,012, ₹10,39,108, MMT ₹2,737 5th, 10.7% / 16.7%, 12 / ₹41,800,
  savings ₹12,600, Saturday == /scenario/saturday), reword with changed number rejected.

## Screenshots compared (scratch API 8407 + web 3407, then stopped; scratch DB deleted)
Inbox 1440 light/dark, 1180, 900 (profile slide-over), 760 dark, 390 list and thread; away dialog; forget dialog;
send toast. Assistant 1440 light, 390 dark. Against video owner-02 and gallery 15/18:
- Matches: list/search/filters/"CONSENTED AT DESK"/rows with avatar, presence dot, unread badge, Auto-replied tag,
  footer note; thread header; grey in / pine out bubbles; day dividers; booking card with kicker and "Open Seedha
  Link"; "✦ Suggested" chips; ₹ button; composer; "Simulate guest"; Assistant "Reading:" pills, S avatar bubbles.
- Intentional differences: no icon rail (app sidebar is the rail); away switch sits in the page header (one switch
  for every width); away bubble labelled "Your away message · approved by you" (D5); no voice note (we hold none);
  filter 4 is "Window open" (24h reply window) since WhatsApp exposes no online presence; no "Median reply" metric.

## Security review follow-ups (lead message, applied)
- Sample hotel never uses the live sender: inbox._send wraps the sender with sender_for_property (CloudApiSender ->
  SimulatedSender when prop.is_sample), covering owner sends and away replies even before master's get_sender
  change merges. Test with a mocked Cloud API proves zero calls.
- D6: d6_ok reuses drafter.MONEY_PATTERN plus a 3+ digit check (redundant once master's MONEY_PATTERN has it; the
  local THREE_DIGITS can then be dropped); strips the link before the code (test).
- Owner messages may carry no web address except the guest's perk link; away text may carry none (422 other_link).
  Local WEB_ADDRESS pattern; swap for master's messages.OTHER_LINK on merge if preferred.
- New routes all use OwnerDep, so require_owner_session applies on merge. Webhook uses SenderDep from
  routers/messages, so master's get_sender (with its PropertyDep) applies there too.

## Decisions
- Inbox stays empty on fresh seed (no consents at seed time); after a Desk consent, "Simulate guest" (or the real
  webhook) creates inbound messages. Nothing added to seed.
- Amber away pill uses local status colours (not the gold token). Times shown in IST.

## Lead: changes elsewhere
1. services/proof.erase_consent and the public data-deletion path should also delete inbox_message rows for the
   consent (inbox Forget does it; other erasure paths leave hidden rows). One line: delete(InboxMessage)...
2. e2e: a11y list already has /inbox and /assistant. Suggested new e2e: consent at Desk -> Simulate guest -> reply.
3. CLAUDE.md data model list could add inbox_message, inbox_away.
