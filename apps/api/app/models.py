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
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

__all__ = [
    "Base",
    "Booking",
    "Channel",
    "ChannelContract",
    "Consent",
    "DeskDevice",
    "DirectBooking",
    "Guest",
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
    parse_method: Mapped[str] = mapped_column(String(20))
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
    __table_args__ = (CheckConstraint(f"status IN {MESSAGE_STATUSES}", name="message_status"),)

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
