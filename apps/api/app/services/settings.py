"""Owner settings: business details, notifications, staff invites, export.

Rules (FRONTEND_MASTER D8, D12; handoff BEHAVIOR validation rules):

* GSTIN ``^\\d{2}[A-Z]{5}\\d{4}[A-Z][A-Z\\d]Z[A-Z\\d]$`` and PAN
  ``^[A-Z]{5}\\d{4}[A-Z]$`` are optional; PIN has 6 digits; staff mobiles
  are Indian mobiles ``^[6-9]\\d{9}$``.
* Business details are stored only for a real owner account, never for the
  Direct beta login (the demo is read-only for personal data).
* GSTIN, PAN and addresses are never logged and never echoed in errors.
* A staff invite is only a record in this build: nothing is sent.
* Deleting an account removes the account and its own settings rows only,
  never the hotel's data.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime

from sqlalchemy import delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import (
    STAFF_ROLES,
    Booking,
    Channel,
    ChannelContract,
    OwnerAccount,
    OwnerSettings,
    StaffInvite,
)
from app.money import BPS_DENOMINATOR

GSTIN = re.compile(r"^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$")
PAN = re.compile(r"^[A-Z]{5}\d{4}[A-Z]$")
PIN = re.compile(r"^\d{6}$")
MOBILE = re.compile(r"^[6-9]\d{9}$")
EMAIL = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,120}\.[A-Za-z]{2,}$")
PAN_IN_GSTIN = slice(2, 12)
MAX_STAFF = 20
DEMO_SUBJECT = "demo"


class SettingsError(ValueError):
    """A refusal the owner should see. The message never repeats the value."""

    def __init__(self, status: int, code: str, message: str, field: str | None = None) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.field = field


@dataclass(frozen=True, slots=True)
class Business:
    """Optional business details, already cleaned. None means not given."""

    email: str | None
    business_name: str | None
    gstin: str | None
    pan: str | None
    address: str | None
    pin: str | None


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    text = " ".join(value.split())
    return text or None


def clean_business(
    *,
    email: str | None,
    business_name: str | None,
    gstin: str | None,
    pan: str | None,
    address: str | None,
    pin: str | None,
) -> Business:
    """Trim, upper-case the tax ids and check every given field."""
    gstin_c = _clean(gstin)
    pan_c = _clean(pan)
    out = Business(
        email=_clean(email),
        business_name=_clean(business_name),
        gstin=gstin_c.replace(" ", "").upper() if gstin_c else None,
        pan=pan_c.replace(" ", "").upper() if pan_c else None,
        address=_clean(address),
        pin=_clean(pin),
    )
    if out.email is not None and not EMAIL.match(out.email):
        raise SettingsError(422, "invalid_email", "Enter an email like name@example.com.", "email")
    if out.gstin is not None and not GSTIN.match(out.gstin):
        raise SettingsError(422, "invalid_gstin", "GSTIN has 15 characters, like 05ABCDE1234F1Z5.",
                            "gstin")  # fmt: skip
    if out.pan is not None and not PAN.match(out.pan):
        raise SettingsError(422, "invalid_pan", "PAN has 10 characters, like ABCDE1234F.", "pan")
    if out.gstin is not None and out.pan is not None and out.gstin[PAN_IN_GSTIN] != out.pan:
        raise SettingsError(422, "pan_gstin_mismatch",
                            "Characters 3 to 12 of a GSTIN are the PAN. These two do not match.",
                            "pan")  # fmt: skip
    if out.pin is not None and not PIN.match(out.pin):
        raise SettingsError(422, "invalid_pin", "PIN code has 6 digits.", "pin")
    return out


def find_settings(session: Session, subject: str) -> OwnerSettings | None:
    """The subject's settings row, if it has one (reads never create rows)."""
    return session.scalar(select(OwnerSettings).where(OwnerSettings.subject == subject))


def settings_for_write(session: Session, subject: str, now: datetime) -> OwnerSettings:
    """The subject's row, created on first write (a racing insert re-reads)."""
    row = find_settings(session, subject)
    if row is not None:
        return row
    try:
        with session.begin_nested():
            row = OwnerSettings(subject=subject, updated_at=now)
            session.add(row)
    except IntegrityError:
        row = find_settings(session, subject)
        if row is None:  # pragma: no cover - the conflicting row must exist
            raise
    return row


def save_business(
    session: Session, account: OwnerAccount, subject: str, name: str | None, business: Business,
    now: datetime,
) -> OwnerSettings:  # fmt: skip
    """Store the owner's own details. Empty optional fields are cleared."""
    row = settings_for_write(session, subject, now)
    if name is not None:
        account.name = name
    row.email = business.email
    row.business_name = business.business_name
    row.gstin = business.gstin
    row.pan = business.pan
    row.address = business.address
    row.pin = business.pin
    row.updated_at = now
    return row


def save_notifications(
    session: Session, subject: str, choices: dict[str, bool], now: datetime
) -> OwnerSettings:
    """Turn the 8 AM line, the 9 PM slip and approval alerts on or off."""
    row = settings_for_write(session, subject, now)
    if "morning_line" in choices:
        row.notify_morning = choices["morning_line"]
    if "close_slip" in choices:
        row.notify_close = choices["close_slip"]
    if "approvals" in choices:
        row.notify_approvals = choices["approvals"]
    row.updated_at = now
    return row


def list_staff(session: Session, subject: str) -> list[StaffInvite]:
    """Invites this owner recorded, oldest first."""
    return list(
        session.scalars(
            select(StaffInvite).where(StaffInvite.subject == subject).order_by(StaffInvite.id)
        )
    )


def invite_staff(
    session: Session, subject: str, name: str, role: str, raw_mobile: str, now: datetime
) -> StaffInvite:
    """Record an invite. Nothing is sent to the number in this build."""
    clean_name = _clean(name)
    if clean_name is None or len(clean_name) < 2:  # noqa: PLR2004 (shortest name)
        raise SettingsError(422, "invalid_name", "Enter the staff member's name.", "name")
    if role not in STAFF_ROLES:
        raise SettingsError(422, "invalid_role", "Choose a role.", "role")
    mobile = re.sub(r"[\s\-]", "", raw_mobile)
    if mobile.startswith("+91"):
        mobile = mobile[3:]
    if not MOBILE.match(mobile):
        raise SettingsError(422, "invalid_mobile", "Enter a 10 digit Indian mobile number.",
                            "mobile")  # fmt: skip
    existing = list_staff(session, subject)
    if any(s.mobile == mobile for s in existing):
        raise SettingsError(409, "already_invited", "This number is already on your staff list.",
                            "mobile")  # fmt: skip
    if len(existing) >= MAX_STAFF:
        raise SettingsError(409, "too_many_staff", f"Up to {MAX_STAFF} staff logins.")
    invite = StaffInvite(subject=subject, name=clean_name, role=role, mobile=mobile,
                         invited_at=now)  # fmt: skip
    session.add(invite)
    session.flush()
    return invite


def remove_staff(session: Session, subject: str, invite_id: int) -> None:
    """Remove one of this owner's invites."""
    invite = session.get(StaffInvite, invite_id)
    if invite is None or invite.subject != subject:
        raise SettingsError(404, "not_found", "That staff login is not on your list.")
    session.delete(invite)


def delete_account(session: Session, account: OwnerAccount, subject: str) -> None:
    """Remove the account and its own settings rows. Hotel data stays."""
    session.execute(delete(StaffInvite).where(StaffInvite.subject == subject))
    session.execute(delete(OwnerSettings).where(OwnerSettings.subject == subject))
    session.delete(account)


def mask_mobile(mobile: str) -> str:
    """'9876543210' -> '+91 98••• ••210'."""
    return f"+91 {mobile[:2]}••• ••{mobile[-3:]}"


@dataclass(frozen=True, slots=True)
class ContractRate:
    """Contracted commission versus what statements show, in basis points."""

    key: str
    name: str
    kind: str
    contracted_bps: int | None
    effective_bps: int | None
    stays: int


def effective_rates(
    session: Session, property_id: int, start: date, end: date
) -> list[ContractRate]:
    """Commission over (list price minus discount) on counted stays, per channel.

    Counted means the row passed the math check or the owner accepted it on
    review (rule 3), the same rows the flip uses.
    """
    channels = session.scalars(
        select(Channel).where(Channel.property_id == property_id).order_by(Channel.sort_order)
    ).all()
    contracts: dict[int, int] = {}
    for contract in session.scalars(
        select(ChannelContract)
        .join(Channel, Channel.id == ChannelContract.channel_id)
        .where(Channel.property_id == property_id, ChannelContract.valid_from <= end)
        .order_by(ChannelContract.valid_from)
    ):
        if contract.valid_to is None or contract.valid_to >= start:
            contracts[contract.channel_id] = contract.commission_bps
    sums = {
        row.channel_id: (int(row.commission), int(row.base), int(row.stays))
        for row in session.execute(
            select(
                Booking.channel_id,
                func.sum(Booking.commission).label("commission"),
                func.sum(Booking.list_amount - Booking.discount).label("base"),
                func.count(Booking.id).label("stays"),
            )
            .where(
                Booking.property_id == property_id,
                Booking.status == "stay",
                Booking.check_in >= start,
                Booking.check_in <= end,
                or_(Booking.math_check_passed.is_(True), Booking.review_status == "accepted"),
            )
            .group_by(Booking.channel_id)
        )
    }
    out = []
    for ch in channels:
        commission, base, stays = sums.get(ch.id, (0, 0, 0))
        effective = (commission * BPS_DENOMINATOR * 2 + base) // (2 * base) if base > 0 else None
        out.append(ContractRate(ch.key, ch.name, ch.kind, contracts.get(ch.id), effective, stays))
    return out
