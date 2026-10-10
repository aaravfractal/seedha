"""Approvals: win-back drafts the owner approves or rejects, and STOP."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from app.deps import OwnerDep, PropertyDep, SessionDep, SettingsDep
from app.errors import ApiError
from app.models import Message
from app.services.desk import utc_now
from app.services.messages import (
    MessageError,
    approve_and_send,
    edit_draft,
    get_message,
    handle_inbound,
    list_messages,
    perk_link,
    reject,
)
from app.services.whatsapp import Sender, sender_for

router = APIRouter(prefix="/messages", tags=["messages"])


class MessageOut(BaseModel):
    """A win-back message as the owner sees it."""

    id: int
    consent_id: int
    guest_name: str
    short_name: str
    perk_code: str
    perk: str
    link: str
    language: str
    body: str
    status: str
    transport: str | None
    consent_given_at: datetime
    consent_fingerprint: str
    proof_status: str
    consent_active: bool
    created_at: datetime
    sent_at: datetime | None


class MessagesOut(BaseModel):
    """All messages and how many wait for approval."""

    pending: int
    simulated: bool
    messages: list[MessageOut]


class EditIn(BaseModel):
    """The owner's new wording for a draft."""

    text: str = Field(min_length=1, max_length=2_000)


class ReplyIn(BaseModel):
    """A guest reply to simulate (demo without WhatsApp keys)."""

    text: str = Field(min_length=1, max_length=200)


def get_sender(request: Request, settings: SettingsDep) -> Sender:
    """WhatsApp sender, overridable in tests via app.state.sender."""
    override: Sender | None = getattr(request.app.state, "sender", None)
    return override if override is not None else sender_for(settings)


SenderDep = Annotated[Sender, Depends(get_sender)]


def language_of(text: str) -> str:
    """'Hindi' when the text has Devanagari letters, else 'English'."""
    return "Hindi" if any("\u0900" <= ch <= "\u097f" for ch in text) else "English"


def message_out(m: Message, web_origin: str) -> MessageOut:
    """Shape one message. The phone number is never returned."""
    consent = m.consent
    return MessageOut(
        id=m.id,
        consent_id=consent.id,
        guest_name=consent.guest.display_name,
        short_name=consent.guest.short_name,
        perk_code=m.perk_code.code,
        perk=m.perk_code.perk,
        link=perk_link(web_origin, m.perk_code.code),
        language=language_of(m.body),
        body=m.body,
        status=m.status,
        transport=m.transport,
        consent_given_at=consent.given_at,
        consent_fingerprint=consent.fingerprint,
        proof_status=consent.proof_status,
        consent_active=consent.is_active,
        created_at=m.created_at,
        sent_at=m.sent_at,
    )


def messages_out(session: SessionDep, property_id: int, settings: SettingsDep) -> MessagesOut:
    """The approvals list."""
    messages = list_messages(session, property_id)
    return MessagesOut(
        pending=sum(1 for m in messages if m.status == "draft"),
        simulated=not settings.whatsapp_enabled,
        messages=[message_out(m, settings.web_origin) for m in messages],
    )


def as_api_error(exc: MessageError) -> ApiError:
    """Message errors keep their status and code."""
    return ApiError(exc.status, exc.code, exc.message)


@router.get("", response_model=MessagesOut)
def get_messages(
    _owner: OwnerDep, session: SessionDep, prop: PropertyDep, settings: SettingsDep
) -> MessagesOut:
    """Drafts and sent messages. Drafts are created at checkout or consent."""
    return messages_out(session, prop.id, settings)


@router.post("/{message_id}/approve", response_model=MessagesOut)
def approve(
    message_id: int, _owner: OwnerDep, session: SessionDep, prop: PropertyDep,
    settings: SettingsDep, sender: SenderDep,
) -> MessagesOut:  # fmt: skip
    """Owner approves and the message is sent (or simulated)."""
    try:
        approve_and_send(get_message(session, prop.id, message_id), sender, utc_now())
    except MessageError as exc:
        raise as_api_error(exc) from exc
    return messages_out(session, prop.id, settings)


@router.patch("/{message_id}", response_model=MessagesOut)
def edit_message(
    message_id: int, body: EditIn, _owner: OwnerDep, session: SessionDep, prop: PropertyDep,
    settings: SettingsDep,
) -> MessagesOut:  # fmt: skip
    """Owner rewords a draft. It stays a draft: nothing is sent (rule 7)."""
    try:
        edit_draft(get_message(session, prop.id, message_id), body.text, settings.web_origin)
    except MessageError as exc:
        raise as_api_error(exc) from exc
    return messages_out(session, prop.id, settings)


@router.post("/{message_id}/reject", response_model=MessagesOut)
def reject_message(
    message_id: int, _owner: OwnerDep, session: SessionDep, prop: PropertyDep,
    settings: SettingsDep,
) -> MessagesOut:  # fmt: skip
    """Owner rejects a draft; it will never be sent."""
    try:
        reject(get_message(session, prop.id, message_id))
    except MessageError as exc:
        raise as_api_error(exc) from exc
    return messages_out(session, prop.id, settings)


@router.post("/{message_id}/simulate-reply", response_model=MessagesOut)
def simulate_reply(
    message_id: int, body: ReplyIn, _owner: OwnerDep, session: SessionDep, prop: PropertyDep,
    settings: SettingsDep,
) -> MessagesOut:  # fmt: skip
    """Demo only: act as the guest replying on WhatsApp (e.g. STOP)."""
    try:
        message = get_message(session, prop.id, message_id)
    except MessageError as exc:
        raise as_api_error(exc) from exc
    number = message.consent.whatsapp_number
    if number:
        handle_inbound(session, number, body.text, "simulated", utc_now())
    return messages_out(session, prop.id, settings)
