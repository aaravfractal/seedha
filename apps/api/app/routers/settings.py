"""Owner settings: personal and business details, hotel, contracts, staff
logins, notifications, security facts, data export and account deletion.

Every route is an owner route (owner token plus a signed-in subject). The
Direct beta login ("demo") sees sample values and cannot write personal
details, staff invites or delete anything; owner accounts ("a<id>") can.
GSTIN, PAN and addresses are never logged.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Annotated, Literal

from fastapi import APIRouter
from pydantic import BaseModel, StringConstraints

from app.deps import PropertyDep, SessionDep
from app.errors import ApiError
from app.models import OwnerAccount, OwnerSettings, Property, StaffInvite
from app.routers.auth import DEMO_SUBJECT, NowDep, SubjectDep, account_of
from app.services.auth import mask_phone
from app.services.calendar import planned_keys
from app.services.ledger import DEFAULT_END, DEFAULT_START
from app.services.settings import (
    SettingsError,
    clean_business,
    delete_account,
    effective_rates,
    find_settings,
    invite_staff,
    list_staff,
    mask_mobile,
    remove_staff,
    save_business,
    save_notifications,
)

router = APIRouter(prefix="/settings", tags=["settings"])

IDLE_MINUTES = 30
DEMO_READ_ONLY = "The sample hotel is read-only here. Sign in with your own number to save."
DEMO_NOTE = (
    "Sample hotel: these are sample details, shown read-only. Sign in with your own WhatsApp "
    "number to save your business details."
)
OWNER_NOTE = "Your own business details. Used only on your Seedha invoices. Never shared."
STAFF_DEMO_NOTE = "Sample staff. Sign in with your own number to invite your staff."
STAFF_NOTE = "An invite is only recorded in this build. No SMS or WhatsApp is sent yet."

# Fictional sample values for the Direct beta login (rule 11).
SAMPLE_EMAIL = "owner@deodarview.example"
SAMPLE_GSTIN = "05ABCDE1234F1Z5"
SAMPLE_PAN = "ABCDE1234F"  # pragma: allowlist secret (fictional sample PAN)
SAMPLE_PIN = "248179"
SAMPLE_STAFF_NAME = "Pooja"
SAMPLE_STAFF_MOBILE = "9800000000"


def _as_api_error(exc: SettingsError) -> ApiError:
    return ApiError(exc.status, exc.code, exc.message)


def owner_account(session: SessionDep, subject: str) -> OwnerAccount:
    """The signed-in account; the demo is refused (read-only)."""
    account = account_of(session, subject)
    if account is None:
        raise ApiError(403, "demo_read_only", DEMO_READ_ONLY)
    return account


# --- Schemas --------------------------------------------------------------------

Short = Annotated[str, StringConstraints(max_length=120)]
Tiny = Annotated[str, StringConstraints(max_length=20)]
Long = Annotated[str, StringConstraints(max_length=240)]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=80)]


class PersonalOut(BaseModel):
    """Owner and business details. `sample` marks the demo's fictional values."""

    sample: bool
    name: str
    mobile: str | None
    email: str | None
    business_name: str | None
    gstin: str | None
    pan: str | None
    address: str | None
    pin: str | None


class HotelOut(BaseModel):
    """The hotel Seedha shows. Read-only for the sample hotel."""

    name: str
    town: str
    address: str
    rooms: int
    is_sample: bool


class NotificationsOut(BaseModel):
    """Owner WhatsApp alerts."""

    morning_line: bool
    close_slip: bool
    approvals: bool


class SecurityOut(BaseModel):
    """Only facts that are true in this build."""

    sign_in: Literal["demo", "whatsapp_code"]
    mobile: str | None
    account_created_at: datetime | None
    first_verified_at: datetime | None
    idle_minutes: int
    two_step: Literal["planned"]


class SettingsOut(BaseModel):
    """Everything the Settings tabs show at once."""

    kind: Literal["demo", "owner"]
    read_only: bool
    note: str
    personal: PersonalOut
    hotel: HotelOut
    notifications: NotificationsOut
    security: SecurityOut


class PersonalIn(BaseModel):
    """Optional fields are cleared when sent empty."""

    name: Name | None = None
    email: Short | None = None
    business_name: Short | None = None
    gstin: Tiny | None = None
    pan: Tiny | None = None
    address: Long | None = None
    pin: Tiny | None = None


class NotificationsIn(BaseModel):
    """Any subset of the three switches."""

    morning_line: bool | None = None
    close_slip: bool | None = None
    approvals: bool | None = None


class ContractOut(BaseModel):
    """Contracted commission versus statements, in basis points (100 = 1%)."""

    key: str
    name: str
    kind: str
    contracted_bps: int | None
    effective_bps: int | None
    stays: int


class ContractsOut(BaseModel):
    """One row per channel for the ledger period."""

    start: date
    end: date
    sample: bool
    channels: list[ContractOut]


class StaffOut(BaseModel):
    """A staff login. The number is masked."""

    id: int | None
    name: str
    role: str
    mobile: str
    status: Literal["invited", "sample"]
    invited_at: datetime | None


class StaffListOut(BaseModel):
    """Staff logins and what this build does with them."""

    read_only: bool
    note: str
    staff: list[StaffOut]


class StaffIn(BaseModel):
    """Record an invite."""

    name: Annotated[str, StringConstraints(max_length=80)]
    role: Annotated[str, StringConstraints(max_length=12)]
    mobile: Annotated[str, StringConstraints(max_length=20)]


class DeleteIn(BaseModel):
    """The owner ticked the confirm step."""

    confirm: Literal[True]


class OkOut(BaseModel):
    """A plain acknowledgement."""

    ok: bool


# --- Helpers --------------------------------------------------------------------


def _notifications(row: OwnerSettings | None) -> NotificationsOut:
    if row is None:
        return NotificationsOut(morning_line=True, close_slip=True, approvals=True)
    return NotificationsOut(morning_line=row.notify_morning, close_slip=row.notify_close,
                            approvals=row.notify_approvals)  # fmt: skip


def _personal(
    prop: Property, account: OwnerAccount | None, row: OwnerSettings | None
) -> PersonalOut:
    if account is None:
        return PersonalOut(sample=True, name=prop.owner_name, mobile=None, email=SAMPLE_EMAIL,
                           business_name=prop.name, gstin=SAMPLE_GSTIN, pan=SAMPLE_PAN,
                           address=prop.address, pin=SAMPLE_PIN)  # fmt: skip
    return PersonalOut(
        sample=False,
        name=account.name,
        mobile=mask_phone(account.phone),
        email=row.email if row else None,
        business_name=row.business_name if row else account.hotel_name,
        gstin=row.gstin if row else None,
        pan=row.pan if row else None,
        address=row.address if row else None,
        pin=row.pin if row else None,
    )


def _staff_list(session: SessionDep, subject: str) -> StaffListOut:
    if subject == DEMO_SUBJECT:
        sample = StaffOut(id=None, name=SAMPLE_STAFF_NAME, role="front_desk",
                          mobile=mask_mobile(SAMPLE_STAFF_MOBILE), status="sample",
                          invited_at=None)  # fmt: skip
        return StaffListOut(read_only=True, note=STAFF_DEMO_NOTE, staff=[sample])
    staff = [_staff(s) for s in list_staff(session, subject)]
    return StaffListOut(read_only=False, note=STAFF_NOTE, staff=staff)


def _staff(invite: StaffInvite) -> StaffOut:
    return StaffOut(id=invite.id, name=invite.name, role=invite.role,
                    mobile=mask_mobile(invite.mobile), status="invited",
                    invited_at=invite.invited_at)  # fmt: skip


def _settings(session: SessionDep, prop: Property, subject: str) -> SettingsOut:
    account = account_of(session, subject)
    row = find_settings(session, subject)
    return SettingsOut(
        kind="demo" if account is None else "owner",
        read_only=account is None,
        note=DEMO_NOTE if account is None else OWNER_NOTE,
        personal=_personal(prop, account, row),
        hotel=HotelOut(
            name=prop.name,
            town=prop.city,
            address=prop.address,
            rooms=prop.rooms_count,
            is_sample=prop.is_sample,
        ),  # fmt: skip
        notifications=_notifications(row),
        security=SecurityOut(
            sign_in="demo" if account is None else "whatsapp_code",
            mobile=None if account is None else mask_phone(account.phone),
            account_created_at=None if account is None else account.created_at,
            first_verified_at=None if account is None else account.verified_at,
            idle_minutes=IDLE_MINUTES,
            two_step="planned",
        ),
    )


# --- Routes ---------------------------------------------------------------------


@router.get("", response_model=SettingsOut)
def get_settings_view(subject: SubjectDep, session: SessionDep, prop: PropertyDep) -> SettingsOut:
    """Every tab's data. The demo gets fictional sample details."""
    return _settings(session, prop, subject)


@router.patch("/personal", response_model=SettingsOut)
def patch_personal(
    body: PersonalIn, subject: SubjectDep, session: SessionDep, prop: PropertyDep, now: NowDep
) -> SettingsOut:
    """Save the owner's own details (accounts only; GSTIN and PAN optional)."""
    account = owner_account(session, subject)
    try:
        business = clean_business(email=body.email, business_name=body.business_name,
                                  gstin=body.gstin, pan=body.pan, address=body.address,
                                  pin=body.pin)  # fmt: skip
    except SettingsError as exc:
        raise _as_api_error(exc) from None
    save_business(session, account, subject, body.name, business, now)
    session.flush()
    return _settings(session, prop, subject)


@router.patch("/notifications", response_model=NotificationsOut)
def patch_notifications(
    body: NotificationsIn, subject: SubjectDep, session: SessionDep, now: NowDep
) -> NotificationsOut:
    """Owner alert switches, stored per signed-in subject (the demo too)."""
    account_of(session, subject)  # an ended account session is refused
    choices = body.model_dump(exclude_none=True)
    row = save_notifications(session, subject, choices, now)
    session.flush()
    return _notifications(row)


@router.get("/contracts", response_model=ContractsOut)
def get_contracts(subject: SubjectDep, session: SessionDep, prop: PropertyDep) -> ContractsOut:
    """Contracted commission per channel versus the rate statements show."""
    account_of(session, subject)
    rates = effective_rates(session, prop.id, DEFAULT_START, DEFAULT_END)
    return ContractsOut(
        start=DEFAULT_START,
        end=DEFAULT_END,
        sample=prop.is_sample,
        channels=[ContractOut(key=r.key, name=r.name, kind=r.kind, contracted_bps=r.contracted_bps,
                              effective_bps=r.effective_bps, stays=r.stays) for r in rates],
    )  # fmt: skip


@router.get("/staff", response_model=StaffListOut)
def get_staff(subject: SubjectDep, session: SessionDep) -> StaffListOut:
    """Staff logins (a sample front desk login for the demo)."""
    account_of(session, subject)
    return _staff_list(session, subject)


@router.post("/staff", response_model=StaffListOut)
def post_staff(
    body: StaffIn, subject: SubjectDep, session: SessionDep, now: NowDep
) -> StaffListOut:
    """Record a staff invite. Nothing is sent in this build."""
    owner_account(session, subject)
    try:
        invite_staff(session, subject, body.name, body.role, body.mobile, now)
    except SettingsError as exc:
        raise _as_api_error(exc) from None
    return _staff_list(session, subject)


@router.delete("/staff/{invite_id}", response_model=StaffListOut)
def delete_staff(invite_id: int, subject: SubjectDep, session: SessionDep) -> StaffListOut:
    """Remove a staff invite."""
    owner_account(session, subject)
    try:
        remove_staff(session, subject, invite_id)
    except SettingsError as exc:
        raise _as_api_error(exc) from None
    session.flush()
    return _staff_list(session, subject)


@router.get("/export")
def export_data(subject: SubjectDep, session: SessionDep, prop: PropertyDep) -> dict[str, object]:
    """Download my data: the account, its settings, staff invites and plan."""
    view = _settings(session, prop, subject)
    account = account_of(session, subject)
    return {
        "exported_from": "Seedha",
        "kind": view.kind,
        "note": "Sample hotel: fictional sample values." if account is None else "Your own data.",
        "account": None if account is None else {
            "name": account.name,
            "hotel_name": account.hotel_name,
            "whatsapp_number": account.phone,
            "created_at": account.created_at.isoformat(),
            "verified_at": account.verified_at.isoformat() if account.verified_at else None,
            "updates_opt_in": account.updates_opt_in,
            "onboarding": {
                "property_name": account.property_name,
                "town": account.town,
                "rooms": account.rooms,
            },
        },
        "personal": view.personal.model_dump(),
        "notifications": view.notifications.model_dump(),
        "staff": [s.model_dump(mode="json") for s in _staff_list(session, subject).staff],
        "plan": sorted(planned_keys(session, prop.id)),
    }  # fmt: skip


@router.delete("/account", response_model=OkOut)
def delete_my_account(body: DeleteIn, subject: SubjectDep, session: SessionDep) -> OkOut:
    """Delete the owner account record and its settings. Hotel data stays."""
    del body  # the Literal[True] confirm is the check
    account = owner_account(session, subject)
    delete_account(session, account, subject)
    return OkOut(ok=True)
