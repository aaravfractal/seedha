"""SQLAlchemy models. All money columns are integer paise.

Privacy by structure (rule 4): the guest table has no contact column. A
WhatsApp number can only live on a consent row, which only the Desk consent
flow creates. OTA statements can therefore never make a guest messageable.
"""

from __future__ import annotations

from datetime import UTC, date, datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
    false,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

__all__ = [
    "Base",
    "Booking",
    "Channel",
    "ChannelContract",
    "Consent",
    "ConsentToken",
    "DeskCommand",
    "DeskDevice",
    "DirectBooking",
    "ErasureRequest",
    "OptOutEvent",
    "OtpChallenge",
    "OwnerAccount",
    "OwnerEvent",
    "OwnerSettings",
    "PlanEntry",
    "Guest",
    "InboxAway",
    "InboxMessage",
    "Message",
    "PerkCode",
    "PipelineStep",
    "RepeatMatch",
    "ScenarioDecision",
    "ProofBundle",
    "ProofBundleItem",
    "Property",
    "Room",
    "Saving",
    "SiteConfig",
    "StaffInvite",
    "StatementFile",
]


def utcnow() -> datetime:
    """Timezone-aware current time in UTC."""
    return datetime.now(UTC)


Money = BigInteger


class Property(Base):
    """A hotel. Sample properties are labelled as sample data (rule 11)."""

    __tablename__ = "property"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    short_name: Mapped[str] = mapped_column(String(60))
    city: Mapped[str] = mapped_column(String(80))
    address: Mapped[str] = mapped_column(String(200))
    rooms_count: Mapped[int] = mapped_column(Integer)
    owner_name: Mapped[str] = mapped_column(String(80))
    perk_text: Mapped[str] = mapped_column(String(120))
    perk_promise: Mapped[str] = mapped_column(String(80), default="your perk is waiting")
    code_prefix: Mapped[str] = mapped_column(String(20))
    is_sample: Mapped[bool] = mapped_column(Boolean, default=True)

    rooms: Mapped[list[Room]] = relationship(back_populates="property")
    channels: Mapped[list[Channel]] = relationship(back_populates="property")


class Room(Base):
    """A physical room with its public (rack) nightly rate."""

    __tablename__ = "room"
    __table_args__ = (UniqueConstraint("property_id", "number"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("property.id"))
    number: Mapped[int] = mapped_column(Integer)
    room_type: Mapped[str] = mapped_column(String(60))
    rack_rate: Mapped[int] = mapped_column(Money)

    property: Mapped[Property] = relationship(back_populates="rooms")


CHANNEL_KINDS = ("ota", "agent", "walkin", "direct")


class Channel(Base):
    """A booking channel: an OTA, travel agents, walk-in or direct."""

    __tablename__ = "channel"
    __table_args__ = (
        UniqueConstraint("property_id", "key"),
        CheckConstraint(f"kind IN {CHANNEL_KINDS}", name="channel_kind"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("property.id"))
    key: Mapped[str] = mapped_column(String(20))
    name: Mapped[str] = mapped_column(String(60))
    kind: Mapped[str] = mapped_column(String(10))
    sort_order: Mapped[int] = mapped_column(Integer)

    property: Mapped[Property] = relationship(back_populates="channels")
    contracts: Mapped[list[ChannelContract]] = relationship(back_populates="channel")


class ChannelContract(Base):
    """Commercial terms of a channel. Commission is on the post-discount amount.

    gst_applies is False only for agents not registered for GST, who invoice
    commission without GST (see docs/decisions.md D-007).
    """

    __tablename__ = "channel_contract"
    __table_args__ = (CheckConstraint("commission_bps BETWEEN 0 AND 10000", name="contract_bps"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    channel_id: Mapped[int] = mapped_column(ForeignKey("channel.id"))
    commission_bps: Mapped[int] = mapped_column(Integer)
    gst_applies: Mapped[bool] = mapped_column(Boolean)
    upi_fee_applies: Mapped[bool] = mapped_column(Boolean, default=False)
    valid_from: Mapped[date] = mapped_column(Date)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)

    channel: Mapped[Channel] = relationship(back_populates="contracts")


class StatementFile(Base):
    """An uploaded statement or register file."""

    __tablename__ = "statement_file"

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("property.id"))
    filename: Mapped[str] = mapped_column(String(200))
    file_type: Mapped[str] = mapped_column(String(10))
    sha256: Mapped[str] = mapped_column(String(64))
    parse_method: Mapped[str] = mapped_column(String(60))  # "layout:travel-agent-register"
    row_count: Mapped[int] = mapped_column(Integer, default=0)
    flagged_count: Mapped[int] = mapped_column(Integer, default=0)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Guest(Base):
    """A person who stayed. Deliberately has no phone or email column."""

    __tablename__ = "guest"

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("property.id"))
    display_name: Mapped[str] = mapped_column(String(120))
    short_name: Mapped[str] = mapped_column(String(60))
    city: Mapped[str | None] = mapped_column(String(80), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


BOOKING_STATUSES = ("stay", "cancelled", "adjustment")
BOOKING_SOURCES = ("statement", "history", "desk", "direct_link")
REVIEW_STATUSES = ("none", "pending", "accepted", "excluded")


class Booking(Base):
    """One statement line or register entry, with its rounded line items.

    tds and gst_tcs are tax credits withheld from the payout. They take part in
    the payout math check but are never subtracted from net_kept (rule 2).
    """

    __tablename__ = "booking"
    __table_args__ = (
        UniqueConstraint("channel_id", "external_ref"),
        CheckConstraint(f"status IN {BOOKING_STATUSES}", name="booking_status"),
        CheckConstraint(f"source IN {BOOKING_SOURCES}", name="booking_source"),
        CheckConstraint(f"review_status IN {REVIEW_STATUSES}", name="booking_review"),
        CheckConstraint(
            "net_kept = list_amount - discount - commission - gst_on_commission - fees",
            name="booking_net_formula",
        ),
        CheckConstraint(
            "list_amount >= 0 AND discount >= 0 AND commission >= 0 "
            "AND gst_on_commission >= 0 AND fees >= 0",
            name="booking_non_negative",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("property.id"))
    channel_id: Mapped[int] = mapped_column(ForeignKey("channel.id"))
    statement_file_id: Mapped[int | None] = mapped_column(
        ForeignKey("statement_file.id"), nullable=True
    )
    guest_id: Mapped[int | None] = mapped_column(ForeignKey("guest.id"), nullable=True)
    room_id: Mapped[int | None] = mapped_column(ForeignKey("room.id"), nullable=True)
    external_ref: Mapped[str] = mapped_column(String(40))
    source: Mapped[str] = mapped_column(String(12))
    status: Mapped[str] = mapped_column(String(12))
    check_in: Mapped[date] = mapped_column(Date, index=True)
    nights: Mapped[int] = mapped_column(Integer)
    guest_name: Mapped[str] = mapped_column(String(120))
    guest_city: Mapped[str | None] = mapped_column(String(80), nullable=True)
    list_amount: Mapped[int] = mapped_column(Money)
    discount: Mapped[int] = mapped_column(Money)
    commission: Mapped[int] = mapped_column(Money)
    gst_on_commission: Mapped[int] = mapped_column(Money)
    fees: Mapped[int] = mapped_column(Money)
    net_kept: Mapped[int] = mapped_column(Money)
    tds: Mapped[int] = mapped_column(Money, default=0)
    gst_tcs: Mapped[int] = mapped_column(Money, default=0)
    payout_reported: Mapped[int] = mapped_column(Money)
    math_check_passed: Mapped[bool] = mapped_column(Boolean)
    flag_reason: Mapped[str | None] = mapped_column(String(40), nullable=True)
    flag_detail: Mapped[str | None] = mapped_column(String(200), nullable=True)
    review_status: Mapped[str] = mapped_column(String(10), default="none")
    checked_out_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    channel: Mapped[Channel] = relationship()
    guest: Mapped[Guest | None] = relationship()
    room: Mapped[Room | None] = relationship()


class Consent(Base):
    """A guest's yes at the Desk. The only place a WhatsApp number may live."""

    __tablename__ = "consent"

    id: Mapped[int] = mapped_column(primary_key=True)
    guest_id: Mapped[int] = mapped_column(ForeignKey("guest.id"))
    booking_id: Mapped[int] = mapped_column(ForeignKey("booking.id"))
    wording_version: Mapped[str] = mapped_column(String(20))
    given_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    salt: Mapped[str | None] = mapped_column(String(64), nullable=True)
    fingerprint: Mapped[str] = mapped_column(String(64), unique=True)
    whatsapp_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    withdrawn_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    erased_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    proof_status: Mapped[str] = mapped_column(String(10), default="pending")
    # Sample inbox threads seeded for the demo (POLISH_BUILD B1). A seeded
    # consent never counts as the Desk step of the 8-step pipeline.
    seeded: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())

    guest: Mapped[Guest] = relationship()
    booking: Mapped[Booking] = relationship()

    @property
    def is_active(self) -> bool:
        """Messageable only while not withdrawn and not erased."""
        return self.withdrawn_at is None and self.erased_at is None


class ProofBundle(Base):
    """A nightly Merkle root over pending consent fingerprints."""

    __tablename__ = "proof_bundle"

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("property.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    merkle_root: Mapped[str] = mapped_column(String(64))
    item_count: Mapped[int] = mapped_column(Integer)
    chain_status: Mapped[str] = mapped_column(String(12), default="stored")
    chain_tx: Mapped[str | None] = mapped_column(String(80), nullable=True)
    chain_block: Mapped[int | None] = mapped_column(Integer, nullable=True)

    items: Mapped[list[ProofBundleItem]] = relationship(back_populates="bundle")


class ProofBundleItem(Base):
    """One fingerprint inside a bundle. Survives erasure, unlinkable after."""

    __tablename__ = "proof_bundle_item"

    id: Mapped[int] = mapped_column(primary_key=True)
    bundle_id: Mapped[int] = mapped_column(ForeignKey("proof_bundle.id"))
    consent_id: Mapped[int | None] = mapped_column(ForeignKey("consent.id"), nullable=True)
    leaf_index: Mapped[int] = mapped_column(Integer)
    fingerprint: Mapped[str] = mapped_column(String(64))

    bundle: Mapped[ProofBundle] = relationship(back_populates="items")


class PerkCode(Base):
    """A returning-guest perk (never a lower public rate, rule 6)."""

    __tablename__ = "perk_code"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True)
    guest_id: Mapped[int] = mapped_column(ForeignKey("guest.id"))
    origin_booking_id: Mapped[int] = mapped_column(ForeignKey("booking.id"))
    perk: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    redeemed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    guest: Mapped[Guest] = relationship()
    origin_booking: Mapped[Booking] = relationship()


MESSAGE_STATUSES = ("draft", "approved", "sent", "rejected", "failed", "blocked")


class Message(Base):
    """An outgoing win-back message. Sent only after owner approval (rule 7)."""

    __tablename__ = "message"
    __table_args__ = (
        CheckConstraint(f"status IN {MESSAGE_STATUSES}", name="message_status"),
        UniqueConstraint("perk_code_id", name="uq_message_perk_code_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    consent_id: Mapped[int] = mapped_column(ForeignKey("consent.id"))
    perk_code_id: Mapped[int] = mapped_column(ForeignKey("perk_code.id"))
    body: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(10), default="draft")
    transport: Mapped[str | None] = mapped_column(String(12), nullable=True)
    provider_message_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    consent: Mapped[Consent] = relationship()
    perk_code: Mapped[PerkCode] = relationship()


# payment_method of the sample hotel's earlier coded bookings (seed, D-080).
SAMPLE_HISTORY_PAYMENT = "sample_history"


class DirectBooking(Base):
    """A booking made on Seedha Link, paid by UPI."""

    __tablename__ = "direct_booking"

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("property.id"))
    perk_code_id: Mapped[int | None] = mapped_column(
        ForeignKey("perk_code.id"), nullable=True, unique=True
    )
    booking_id: Mapped[int] = mapped_column(ForeignKey("booking.id"), unique=True)
    amount: Mapped[int] = mapped_column(Money)
    payment_method: Mapped[str] = mapped_column(String(20))
    payment_ref: Mapped[str] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    perk_code: Mapped[PerkCode | None] = relationship()
    booking: Mapped[Booking] = relationship()


class Saving(Base):
    """Commission avoided by one coded direct booking (ruling 5), auditable."""

    __tablename__ = "saving"
    __table_args__ = (
        CheckConstraint(
            "net_saving = commission_avoided + gst_avoided - upi_fee", name="saving_formula"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    direct_booking_id: Mapped[int] = mapped_column(ForeignKey("direct_booking.id"), unique=True)
    original_channel_id: Mapped[int] = mapped_column(ForeignKey("channel.id"))
    commission_rate_used: Mapped[int] = mapped_column(Integer)
    commission_avoided: Mapped[int] = mapped_column(Money)
    gst_avoided: Mapped[int] = mapped_column(Money)
    upi_fee: Mapped[int] = mapped_column(Money)
    net_saving: Mapped[int] = mapped_column(Money)

    direct_booking: Mapped[DirectBooking] = relationship()
    original_channel: Mapped[Channel] = relationship()


class DeskDevice(Base):
    """A Seedha Desk box. Only the SHA-256 of its key is stored."""

    __tablename__ = "desk_device"

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("property.id"))
    name: Mapped[str] = mapped_column(String(60))
    device_key_hash: Mapped[str] = mapped_column(String(64), unique=True)
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PipelineStep(Base):
    """When each of the 8 demo-loop steps was first completed."""

    __tablename__ = "pipeline_step"

    key: Mapped[str] = mapped_column(String(10), primary_key=True)
    done_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


MATCH_STATUSES = ("suggested", "confirmed", "dismissed")


class RepeatMatch(Base):
    """A returning guest found in OTA data. Confirmed only by the owner (ruling 7).

    Deliberately unrelated to consent: a match never makes a guest messageable.
    """

    __tablename__ = "repeat_match"
    __table_args__ = (
        UniqueConstraint("return_booking_id", "earlier_booking_id"),
        CheckConstraint(f"status IN {MATCH_STATUSES}", name="match_status"),
        CheckConstraint("confidence BETWEEN 0 AND 100", name="match_confidence"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("property.id"))
    return_booking_id: Mapped[int] = mapped_column(ForeignKey("booking.id"))
    earlier_booking_id: Mapped[int] = mapped_column(ForeignKey("booking.id"))
    confidence: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(10), default="suggested")
    llm_opinion: Mapped[str | None] = mapped_column(String(10), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    return_booking: Mapped[Booking] = relationship(foreign_keys=[return_booking_id])
    earlier_booking: Mapped[Booking] = relationship(foreign_keys=[earlier_booking_id])


class ScenarioDecision(Base):
    """The owner's answer to a suggested move, such as the Saturday hold."""

    __tablename__ = "scenario_decision"

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("property.id"))
    kind: Mapped[str] = mapped_column(String(20))
    rooms: Mapped[int] = mapped_column(Integer)
    channel_key: Mapped[str] = mapped_column(String(20))
    decision: Mapped[str] = mapped_column(String(10))
    decided_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ConsentToken(Base):
    """A one-booking consent link shown as the Desk QR. Only its hash is stored.

    Expires 10 minutes after check-in and works once.
    """

    __tablename__ = "consent_token"

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("booking.id"))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    booking: Mapped[Booking] = relationship()


DESK_COMMANDS = ("show_qr", "show_ok", "show_idle", "show_text", "set_ring", "print_slip", "beep")


class DeskCommand(Base):
    """A command for the Desk box, fetched by polling and acknowledged."""

    __tablename__ = "desk_command"
    __table_args__ = (CheckConstraint(f"kind IN {DESK_COMMANDS}", name="desk_command_kind"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    device_id: Mapped[int] = mapped_column(ForeignKey("desk_device.id"), index=True)
    kind: Mapped[str] = mapped_column(String(12))
    payload: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    acked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class OptOutEvent(Base):
    """A STOP received for a consent. Stores no phone number."""

    __tablename__ = "optout_event"

    id: Mapped[int] = mapped_column(primary_key=True)
    consent_id: Mapped[int] = mapped_column(ForeignKey("consent.id"))
    source: Mapped[str] = mapped_column(String(12))
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SiteConfig(Base):
    """Seedha Site settings for a property. Nothing is live until published."""

    __tablename__ = "site_config"

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("property.id"), unique=True)
    stage: Mapped[str] = mapped_column(String(10), default="empty")
    mood: Mapped[str] = mapped_column(String(10), default="pine")
    lang: Mapped[str] = mapped_column(String(2), default="en")
    approved_packages: Mapped[str] = mapped_column(String(200), default="")
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Real mode (docs/SITE_REAL.md): the public address and branding.
    slug: Mapped[str | None] = mapped_column(String(40), unique=True, nullable=True)
    previous_slug: Mapped[str | None] = mapped_column(String(40), nullable=True)
    slug_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    hide_branding: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())


class ErasureRequest(Base):
    """A guest's data-deletion request. Stores no phone number or reference,
    only whether it matched a consent and when."""

    __tablename__ = "erasure_request"

    id: Mapped[int] = mapped_column(primary_key=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    outcome: Mapped[str] = mapped_column(String(12))


class OwnerAccount(Base):
    """The hotel owner's own login (single property in this build).

    The WhatsApp number is the owner's own, stored to sign them in. Onboarding
    answers are kept here and never written to the property or its channel
    contracts, so the sample hotel's locked numbers cannot change.
    """

    __tablename__ = "owner_account"
    __table_args__ = (
        UniqueConstraint("phone", name="uq_owner_account_phone"),
        CheckConstraint("rooms BETWEEN 1 AND 500", name="ck_owner_account_rooms"),
        CheckConstraint(
            "cost_per_room IS NULL OR cost_per_room >= 0", name="ck_owner_account_cost"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    hotel_name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(10))
    terms_accepted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updates_opt_in: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    property_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    town: Mapped[str | None] = mapped_column(String(80), nullable=True)
    rooms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    contracts: Mapped[str | None] = mapped_column(String(200), nullable=True)
    cost_per_room: Mapped[int | None] = mapped_column(Money, nullable=True)
    whatsapp_connected_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    onboarded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class OtpChallenge(Base):
    """One sign-in code per phone. Only a salted hash of the code is stored."""

    __tablename__ = "otp_challenge"
    __table_args__ = (UniqueConstraint("phone", name="uq_otp_challenge_phone"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    phone: Mapped[str] = mapped_column(String(10))
    code_hash: Mapped[str] = mapped_column(String(64))
    salt: Mapped[str] = mapped_column(String(32))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


INBOX_DIRECTIONS = ("in", "out")
INBOX_SENDERS = ("guest", "owner", "away")


class InboxMessage(Base):
    """One WhatsApp text in a guest thread (Guest inbox, D5).

    A thread is a consent: rows exist only for Desk-consented guests (rule 4).
    Outgoing rows are the owner's own sends ("owner") or the owner-approved
    away text ("away"); no AI-written text is ever sent (rule 7).
    """

    __tablename__ = "inbox_message"
    __table_args__ = (
        CheckConstraint(f"direction IN {INBOX_DIRECTIONS}", name="ck_inbox_message_direction"),
        CheckConstraint(f"sent_by IN {INBOX_SENDERS}", name="ck_inbox_message_sent_by"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    consent_id: Mapped[int] = mapped_column(ForeignKey("consent.id"), index=True)
    direction: Mapped[str] = mapped_column(String(3))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sent_by: Mapped[str] = mapped_column(String(5))
    transport: Mapped[str | None] = mapped_column(String(12), nullable=True)
    provider_message_id: Mapped[str | None] = mapped_column(String(80), nullable=True)

    consent: Mapped[Consent] = relationship()


class InboxAway(Base):
    """The owner's away text. Saved only with the owner's explicit approval;
    sent only to consented guests who wrote first, at most once a day."""

    __tablename__ = "inbox_away"
    __table_args__ = (UniqueConstraint("property_id", name="uq_inbox_away_property_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("property.id"))
    body: Mapped[str] = mapped_column(Text)
    approved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)


STAFF_ROLES = ("front_desk", "manager", "accounts")


class OwnerSettings(Base):
    """Settings of one signed-in subject ("demo" or "a<account id>").

    Business details (GSTIN, PAN, address) are the owner's own and are only
    written for real accounts; the demo row only ever holds notification
    choices. GSTIN and PAN are never logged (FRONTEND_MASTER D12).
    """

    __tablename__ = "owner_settings"
    __table_args__ = (UniqueConstraint("subject", name="uq_owner_settings_subject"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    subject: Mapped[str] = mapped_column(String(16))
    email: Mapped[str | None] = mapped_column(String(120), nullable=True)
    business_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    gstin: Mapped[str | None] = mapped_column(String(15), nullable=True)
    pan: Mapped[str | None] = mapped_column(String(10), nullable=True)
    address: Mapped[str | None] = mapped_column(String(240), nullable=True)
    pin: Mapped[str | None] = mapped_column(String(6), nullable=True)
    notify_morning: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_close: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_approvals: Mapped[bool] = mapped_column(Boolean, default=True)
    # GST on room tariff for stay invoices, in basis points; empty means 5%.
    room_gst_bps: Mapped[int | None] = mapped_column(Integer, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class StaffInvite(Base):
    """A staff login the owner invited. In this build an invite is only a
    record: no SMS or WhatsApp is sent and staff cannot sign in yet."""

    __tablename__ = "staff_invite"
    __table_args__ = (
        UniqueConstraint("subject", "mobile", name="uq_staff_invite_subject_mobile"),
        CheckConstraint(f"role IN {STAFF_ROLES}", name="ck_staff_invite_role"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    subject: Mapped[str] = mapped_column(String(16), index=True)
    name: Mapped[str] = mapped_column(String(80))
    role: Mapped[str] = mapped_column(String(12))
    mobile: Mapped[str] = mapped_column(String(10))
    invited_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class PlanEntry(Base):
    """A Pulse calendar event the owner added to their plan (a channel
    decision to act on; never a demand prediction)."""

    __tablename__ = "plan_entry"
    __table_args__ = (
        UniqueConstraint("property_id", "event_key", name="uq_plan_entry_property_id_event_key"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("property.id"))
    event_key: Mapped[str] = mapped_column(String(40))
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class OwnerEvent(Base):
    """A town event the owner pasted from an official source (Event Radar
    Lite). Demand is Claude's reading of the owner's own source text, never
    a Seedha forecast (D-097); no rupee figure is stored with it."""

    __tablename__ = "owner_event"
    __table_args__ = (
        UniqueConstraint(
            "property_id", "name", "start_date", name="uq_owner_event_property_id_name_start_date"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("property.id"))
    name: Mapped[str] = mapped_column(String(80))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    town: Mapped[str] = mapped_column(String(60))
    category: Mapped[str] = mapped_column(String(16))
    demand: Mapped[str] = mapped_column(String(8))
    source_url: Mapped[str] = mapped_column(String(500))
    origin: Mapped[str] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class StayInvoice(Base):
    """A guest's stay invoice, numbered per financial year (e.g. DEODAR/2627/0001).
    Every amount on it comes from the booking row by code; nothing is stored here
    but the number, so the PDF is always rebuilt from the ledger."""

    __tablename__ = "stay_invoice"
    __table_args__ = (
        UniqueConstraint("property_id", "fy", "seq", name="uq_stay_invoice_property_id_fy_seq"),
        UniqueConstraint("booking_id", name="uq_stay_invoice_booking_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("property.id"))
    booking_id: Mapped[int] = mapped_column(ForeignKey("booking.id"))
    fy: Mapped[str] = mapped_column(String(4))
    seq: Mapped[int] = mapped_column(Integer)
    number: Mapped[str] = mapped_column(String(32), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class GuestMemory(Base):
    """What Seedha remembers about a consented guest: preferences and notes only
    (no money, no documents). Deleted when the guest's consent is erased."""

    __tablename__ = "guest_memory"

    id: Mapped[int] = mapped_column(primary_key=True)
    guest_id: Mapped[int] = mapped_column(ForeignKey("guest.id"), index=True)
    kind: Mapped[str] = mapped_column(String(12))
    text: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SitePhoto(Base):
    """An owner photo for the hotel site, stored resized (<=1024 px), re-encoded
    as JPEG with every EXIF field removed. Kept in the database so it survives
    redeploys on an ephemeral disk and is covered by database backups."""

    __tablename__ = "site_photo"

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("property.id"), index=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    content_type: Mapped[str] = mapped_column(String(20), default="image/jpeg")
    width: Mapped[int] = mapped_column(Integer)
    height: Mapped[int] = mapped_column(Integer)
    size_bytes: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64))
    data: Mapped[bytes] = mapped_column(LargeBinary)
    caption_en: Mapped[str] = mapped_column(String(80), default="")
    caption_hi: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SiteContent(Base):
    """The owner's inputs and the generated or edited site text. Room prices are
    only what the owner typed (paise); generated text never carries a price."""

    __tablename__ = "site_content"

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("property.id"), unique=True)
    owner_description: Mapped[str] = mapped_column(Text, default="")
    # JSON: [{"name": str, "price_paise": int, "blurb_en": str, "blurb_hi": str}]
    rooms_json: Mapped[str] = mapped_column(Text, default="[]")
    # JSON with description_en/hi, why_book_direct_en/hi (3 each), google_description_en/hi
    content_json: Mapped[str] = mapped_column(Text, default="{}")
    source: Mapped[str] = mapped_column(String(12), default="none")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SiteGenRun(Base):
    """One generation call: tokens and outcome, for limits and the Settings usage panel."""

    __tablename__ = "site_gen_run"

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("property.id"), index=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    status: Mapped[str] = mapped_column(String(16))
    model: Mapped[str] = mapped_column(String(60), default="")
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cache_creation_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cache_read_tokens: Mapped[int] = mapped_column(Integer, default=0)
    fields_fallback: Mapped[int] = mapped_column(Integer, default=0)


class SiteDetails(Base):
    """The owner's hotel facts for the site: amenities, nearby places, how to
    reach, good to know, contact and map position (JSON, validated by
    app.services.site_details). Never guest data and never a price."""

    __tablename__ = "site_details"

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("property.id"), unique=True)
    details_json: Mapped[str] = mapped_column(Text, default="{}")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SiteCardScan(Base):
    """How many times a printed card's QR was scanned, per card type per hotel
    day. Only a count: no IP, cookie, user agent or device data."""

    __tablename__ = "site_card_scan"
    __table_args__ = (UniqueConstraint("property_id", "card", "day"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("property.id"), index=True)
    card: Mapped[str] = mapped_column(String(8))
    day: Mapped[date] = mapped_column(Date)
    count: Mapped[int] = mapped_column(Integer, default=0)


class SitePhotoVariant(Base):
    """A resized, re-encoded copy of a site photo for responsive images
    (Hotel Site V2, R3-1): one of a fixed set of widths and formats, made on
    first request from the stored metadata-free JPEG and kept here. Deleted
    with its photo; `source_sha256` ties it to the exact photo bytes."""

    __tablename__ = "site_photo_variant"
    __table_args__ = (UniqueConstraint("photo_id", "w", "fmt"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    photo_id: Mapped[int] = mapped_column(
        ForeignKey("site_photo.id", ondelete="CASCADE"), index=True
    )
    w: Mapped[int] = mapped_column(Integer)
    fmt: Mapped[str] = mapped_column(String(8))
    width: Mapped[int] = mapped_column(Integer)
    height: Mapped[int] = mapped_column(Integer)
    source_sha256: Mapped[str] = mapped_column(String(64))
    sha256: Mapped[str] = mapped_column(String(64))
    data: Mapped[bytes] = mapped_column(LargeBinary)
