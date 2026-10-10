"""Guest inbox: threads with Desk-consented guests, owner sends, away text."""

from __future__ import annotations

from datetime import date, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field

from app.deps import OwnerDep, PropertyDep, SessionDep, SettingsDep
from app.errors import ApiError
from app.models import Consent, InboxAway
from app.routers.messages import SenderDep
from app.services.consent import as_utc
from app.services.desk import utc_now
from app.services.inbox import (
    ClaudeReplyWording,
    Entry,
    InboxError,
    ReplyWording,
    ThreadSummary,
    draft_reply,
    forget,
    get_away,
    get_thread,
    latest_direct,
    list_threads,
    mark_read,
    owner_send,
    perk_of,
    rate_card,
    record_inbound,
    set_away,
    stays_of,
    suggestions,
    summarise,
    thread_entries,
)
from app.services.messages import handle_inbound

router = APIRouter(prefix="/inbox", tags=["inbox"])


class LastOut(BaseModel):
    """The newest bubble of a thread."""

    body: str
    direction: str
    sent_by: str
    at: datetime


class ThreadOut(BaseModel):
    """A guest list row. The phone number is never returned."""

    consent_id: int
    guest_name: str
    short_name: str
    city: str | None
    last: LastOut | None
    unread: int
    auto_replied: bool
    window_open: bool
    window_closes_at: datetime | None
    stays: int


class AwayOut(BaseModel):
    """The owner's approved away text and whether it is on."""

    text: str | None
    approved_at: datetime | None
    enabled: bool


class RateLineOut(BaseModel):
    """A rate card line written by code (paise and display text)."""

    room_type: str
    nightly_rate: int
    line: str


class ThreadsOut(BaseModel):
    """The guest list with filter counts, away state and the rate card."""

    threads: list[ThreadOut]
    counts: dict[str, int]
    away: AwayOut
    rate_card: list[RateLineOut]
    simulated: bool


class EntryOut(BaseModel):
    """One bubble."""

    key: str
    direction: str
    sent_by: str
    kind: str
    body: str
    at: datetime
    transport: str | None


class BookingCardOut(BaseModel):
    """The guest's latest direct booking, or the stay they consented on."""

    kind: Literal["direct", "stay"]
    check_in: date
    nights: int
    room_type: str | None
    channel: str
    link: str | None


class StayOut(BaseModel):
    """A stay Seedha holds for this guest."""

    check_in: date
    nights: int
    channel: str
    room_type: str | None


class ProfileOut(BaseModel):
    """What Seedha remembers: only data actually stored."""

    guest_name: str
    city: str | None
    consent_given_at: datetime
    consent_wording: str
    proof_status: str
    language: str | None
    perk_code: str | None
    stays: list[StayOut]


class ThreadDetailOut(BaseModel):
    """A thread with its bubbles, reply state, suggestions and profile."""

    thread: ThreadOut
    messages: list[EntryOut]
    can_reply: bool
    reply_note: str
    suggestions: list[str]
    booking: BookingCardOut | None
    profile: ProfileOut


class SendIn(BaseModel):
    """The owner's own message."""

    body: str = Field(min_length=1, max_length=1_000)


class SimulateIn(BaseModel):
    """Demo: a text as if the guest wrote on WhatsApp."""

    text: str = Field(min_length=1, max_length=500)


class ForgetIn(BaseModel):
    """Forget needs an explicit confirm."""

    confirm: bool


class AwayIn(BaseModel):
    """New away text (only with approved=true) and/or the on-off switch."""

    text: str | None = Field(default=None, max_length=400)
    approved: bool = False
    enabled: bool | None = None


class DraftOut(BaseModel):
    """A suggestion for the composer. Seedha never sends it."""

    text: str
    source: Literal["ai", "template"]
    label: str


def get_reply_wording(request: Request, settings: SettingsDep) -> ReplyWording | None:
    """Claude suggestions (None in simulated mode); tests override via
    app.state.reply_wording."""
    override: ReplyWording | None = getattr(request.app.state, "reply_wording", None)
    if override is not None:
        return override
    if not settings.llm_enabled:
        return None
    return ClaudeReplyWording(settings.anthropic_api_key, settings.claude_model)


ReplyWordingDep = Annotated[ReplyWording | None, Depends(get_reply_wording)]


def as_api_error(exc: InboxError) -> ApiError:
    """Inbox errors keep their status and code."""
    return ApiError(exc.status, exc.code, exc.message)


def thread_out(s: ThreadSummary) -> ThreadOut:
    """Shape one list row."""
    last = s.last
    return ThreadOut(
        consent_id=s.consent.id,
        guest_name=s.consent.guest.display_name,
        short_name=s.consent.guest.short_name,
        city=s.consent.guest.city,
        last=LastOut(body=last.body, direction=last.direction, sent_by=last.sent_by, at=last.at)
        if last
        else None,
        unread=s.unread,
        auto_replied=s.auto_replied,
        window_open=s.window_open,
        window_closes_at=s.window_closes_at,
        stays=s.stays,
    )


def away_out(away: InboxAway | None) -> AwayOut:
    """Shape the away state."""
    if away is None:
        return AwayOut(text=None, approved_at=None, enabled=False)
    return AwayOut(text=away.body, approved_at=as_utc(away.approved_at), enabled=away.enabled)


def entry_out(e: Entry) -> EntryOut:
    """Shape one bubble."""
    return EntryOut(key=e.key, direction=e.direction, sent_by=e.sent_by, kind=e.kind,
                    body=e.body, at=e.at, transport=e.transport)  # fmt: skip


def thread_or_404(session: SessionDep, property_id: int, consent_id: int) -> Consent:
    """The thread or the API error."""
    try:
        return get_thread(session, property_id, consent_id)
    except InboxError as exc:
        raise as_api_error(exc) from exc


def booking_card(session: SessionDep, consent: Consent, link: str | None) -> BookingCardOut | None:
    """Latest Seedha Link booking, else the consented stay."""
    direct = latest_direct(session, consent)
    if direct is not None:
        b = direct.booking
        return BookingCardOut(kind="direct", check_in=b.check_in, nights=b.nights,
                              room_type=b.room.room_type if b.room else None,
                              channel=b.channel.name, link=None)  # fmt: skip
    b = consent.booking
    return BookingCardOut(kind="stay", check_in=b.check_in, nights=b.nights,
                          room_type=b.room.room_type if b.room else None,
                          channel=b.channel.name, link=link)  # fmt: skip


def detail_out(
    session: SessionDep, prop: PropertyDep, consent: Consent, origin: str
) -> ThreadDetailOut:
    """The full thread view."""
    now = utc_now()
    summary = summarise(session, consent, now)
    perk = perk_of(session, consent)
    link = f"{origin.rstrip('/')}/link/{perk.code}" if perk else None
    note = (
        "You can reply until the 24-hour window closes."
        if summary.window_open
        else "Replies open when the guest writes. WhatsApp allows only approved templates "
        "outside 24 hours, so use Approvals for a win-back message."
    )
    return ThreadDetailOut(
        thread=thread_out(summary),
        messages=[entry_out(e) for e in thread_entries(session, consent)],
        can_reply=summary.window_open,
        reply_note=note,
        suggestions=suggestions(prop, consent, perk, link or ""),
        booking=booking_card(session, consent, link),
        profile=ProfileOut(
            guest_name=consent.guest.display_name,
            city=consent.guest.city,
            consent_given_at=as_utc(consent.given_at),
            consent_wording=consent.wording_version,
            proof_status=consent.proof_status,
            language=None,
            perk_code=perk.code if perk else None,
            stays=[
                StayOut(
                    check_in=b.check_in,
                    nights=b.nights,
                    channel=b.channel.name,
                    room_type=b.room.room_type if b.room else None,
                )  # fmt: skip
                for b in stays_of(session, consent)
            ],
        ),
    )


@router.get("/threads", response_model=ThreadsOut)
def get_threads(
    _owner: OwnerDep,
    session: SessionDep,
    prop: PropertyDep,
    settings: SettingsDep,
    filter_: Annotated[Literal["all", "unread", "auto", "open"], Query(alias="filter")] = "all",
    q: Annotated[str, Query(max_length=80)] = "",
) -> ThreadsOut:
    """Desk-consented, non-withdrawn guests only (rule 4)."""
    threads, counts = list_threads(session, prop.id, utc_now(), filter_, q)
    return ThreadsOut(
        threads=[thread_out(t) for t in threads],
        counts=counts,
        away=away_out(get_away(session, prop.id)),
        rate_card=[
            RateLineOut(room_type=r.room_type, nightly_rate=r.nightly_rate, line=r.line)
            for r in rate_card(session, prop.id)
        ],  # fmt: skip
        simulated=not settings.whatsapp_enabled,
    )


@router.get("/threads/{consent_id}/messages", response_model=ThreadDetailOut)
def get_thread_messages(
    consent_id: int, _owner: OwnerDep, session: SessionDep, prop: PropertyDep,
    settings: SettingsDep,
) -> ThreadDetailOut:  # fmt: skip
    """One thread. Withdrawn or erased guests are not found."""
    consent = thread_or_404(session, prop.id, consent_id)
    return detail_out(session, prop, consent, settings.web_origin)


@router.post("/threads/{consent_id}/messages", response_model=ThreadDetailOut)
def send_message(
    consent_id: int, body: SendIn, _owner: OwnerDep, session: SessionDep, prop: PropertyDep,
    settings: SettingsDep, sender: SenderDep,
) -> ThreadDetailOut:  # fmt: skip
    """The owner's own send, inside the 24-hour window; STOP line appended."""
    consent = thread_or_404(session, prop.id, consent_id)
    perk = perk_of(session, consent)
    link = f"{settings.web_origin.rstrip('/')}/link/{perk.code}" if perk else ""
    try:
        owner_send(session, consent, body.body, sender, utc_now(), link)
    except InboxError as exc:
        raise as_api_error(exc) from exc
    mark_read(session, consent, utc_now())
    return detail_out(session, prop, consent, settings.web_origin)


@router.post("/threads/{consent_id}/draft", response_model=DraftOut)
def draft(
    consent_id: int, _owner: OwnerDep, session: SessionDep, prop: PropertyDep,
    wording: ReplyWordingDep,
) -> DraftOut:  # fmt: skip
    """An AI suggestion (or canned reply) for the owner to edit. Never sent."""
    consent = thread_or_404(session, prop.id, consent_id)
    result = draft_reply(session, prop, consent, wording)
    source: Literal["ai", "template"] = "ai" if result.source == "ai" else "template"
    return DraftOut(text=result.text, source=source, label="Bot drafts, you send.")


@router.post("/threads/{consent_id}/read", response_model=ThreadOut)
def read_thread(
    consent_id: int, _owner: OwnerDep, session: SessionDep, prop: PropertyDep
) -> ThreadOut:
    """Mark the guest's texts as read."""
    consent = thread_or_404(session, prop.id, consent_id)
    mark_read(session, consent, utc_now())
    return thread_out(summarise(session, consent, utc_now()))


@router.post("/threads/{consent_id}/simulate", response_model=ThreadDetailOut | None)
def simulate_guest(
    consent_id: int, body: SimulateIn, _owner: OwnerDep, session: SessionDep, prop: PropertyDep,
    settings: SettingsDep, sender: SenderDep,
) -> ThreadDetailOut | None:  # fmt: skip
    """Demo: act as the guest writing on WhatsApp. Same path as the webhook,
    so STOP withdraws consent (the thread then disappears: returns null)."""
    consent = thread_or_404(session, prop.id, consent_id)
    number = consent.whatsapp_number or ""
    now = utc_now()
    handle_inbound(session, number, body.text, "simulated", now)
    record_inbound(session, number, body.text, sender, now)
    session.refresh(consent)
    if not consent.is_active:
        return None
    return detail_out(session, prop, consent, settings.web_origin)


@router.post("/threads/{consent_id}/forget", response_model=dict[str, bool])
def forget_guest(
    consent_id: int, body: ForgetIn, _owner: OwnerDep, session: SessionDep, prop: PropertyDep
) -> dict[str, bool]:
    """DPDP erasure: number, salt and texts go; the proof leaf stays unlinkable."""
    if body.confirm is not True:
        raise ApiError(422, "confirm_required", "Confirm to forget this guest")
    consent = thread_or_404(session, prop.id, consent_id)
    forget(session, consent, utc_now())
    return {"forgotten": True}


@router.patch("/away", response_model=AwayOut)
def patch_away(body: AwayIn, _owner: OwnerDep, session: SessionDep, prop: PropertyDep) -> AwayOut:
    """Save the owner's away text (approval required) or switch it on or off."""
    try:
        away = set_away(session, prop, utc_now(), text=body.text, approved=body.approved,
                        enabled=body.enabled)  # fmt: skip
    except InboxError as exc:
        raise as_api_error(exc) from exc
    return away_out(away)
