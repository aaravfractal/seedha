"""Seedha Link (public) and the savings ledger (owner)."""

from __future__ import annotations

import secrets
from datetime import date, datetime
from typing import Annotated, Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.deps import OwnerDep, PropertyDep, SessionDep, SettingsDep
from app.errors import ApiError
from app.models import Channel, DirectBooking, Saving
from app.money import PAISE_PER_RUPEE
from app.ratelimit import rate_limited
from app.services.consent import as_utc
from app.services.desk import business_date, utc_now
from app.services.ledger import DEFAULT_END, DEFAULT_START
from app.services.link import BookingRequest, LinkError, book, code_status, date_options, room_rates
from app.services.savings import (
    MAX_PERK_COST_PER_NIGHT,
    SAMPLE_PERK_COST_PER_NIGHT,
    perk_split,
    season_review,
)
from app.services.site_ratings import issue_token, rating_url

public_router = APIRouter(prefix="/public/link", tags=["link"])
savings_router = APIRouter(prefix="/savings", tags=["savings"])

IST = ZoneInfo("Asia/Kolkata")
MONTHS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")


class RoomOut(BaseModel):
    """A room type at its public nightly rate (paise)."""

    room_type: str
    nightly_rate: int


class DateOut(BaseModel):
    """A suggested stay."""

    check_in: date
    nights: int
    label: str


class LinkPageOut(BaseModel):
    """What the booking page shows. Never the guest's name: a guessed code
    must not reveal who stayed (D-076)."""

    hotel: str
    address: str
    code: str | None
    code_status: str
    perk: str
    rooms: list[RoomOut]
    dates: list[DateOut]


class BookIn(BaseModel):
    """A booking from Seedha Link, paid by (simulated) UPI."""

    code: str | None = Field(default=None, max_length=30)
    check_in: date
    nights: int = Field(ge=1, le=14)
    room_type: str = Field(min_length=1, max_length=60)
    payment: Literal["upi_simulated"] = "upi_simulated"


class BookOut(BaseModel):
    """Confirmation for the guest. No saving figures: those are the hotel's."""

    reference: str
    amount: int
    check_in: date
    nights: int
    room_type: str
    perk_applied: bool
    payment: str
    # Only once the code has been accepted with a booking (D-076).
    guest_short_name: str | None
    # The guest's one-time verified rating link (hotel mini-site); shown, never sent.
    rating_url: str | None = None


def stay_label(start: date, nights: int) -> str:
    """'13 Nov to 15 Nov · 2 nights'."""
    end = date.fromordinal(start.toordinal() + nights)
    plural = "night" if nights == 1 else "nights"
    return (
        f"{start.day} {MONTHS[start.month - 1]} to {end.day} {MONTHS[end.month - 1]}"
        f" · {nights} {plural}"
    )


@public_router.get("", response_model=LinkPageOut, dependencies=[Depends(rate_limited("link"))])
def link_page(
    session: SessionDep,
    prop: PropertyDep,
    code: Annotated[str | None, Query(max_length=30)] = None,
) -> LinkPageOut:
    """Hotel, rooms at public rates, two suggested weekends, and the code's state."""
    status = code_status(session, code)
    day = business_date(session, prop.id, utc_now().date())
    return LinkPageOut(
        hotel=prop.short_name,
        address=prop.address,
        code=status.perk.code if status.perk else None,
        code_status=status.status,
        perk=prop.perk_text,
        rooms=[
            RoomOut(room_type=t, nightly_rate=r) for t, r in room_rates(session, prop.id).items()
        ],
        dates=[DateOut(check_in=d, nights=n, label=stay_label(d, n)) for d, n in date_options(day)],
    )


@public_router.post(
    "/book", response_model=BookOut, dependencies=[Depends(rate_limited("link_book"))]
)
def link_book(
    body: BookIn, session: SessionDep, prop: PropertyDep, settings: SettingsDep
) -> BookOut:
    """Book directly. A valid code is redeemed once and its saving recorded."""
    now = utc_now()
    req = BookingRequest(body.code, body.check_in, body.nights, body.room_type)
    try:
        done = book(session, prop, req, business_date(session, prop.id, now.date()),
                    f"upi-sim-{secrets.token_hex(6)}", now)  # fmt: skip
    except LinkError as exc:
        raise ApiError(exc.status, exc.code, exc.message) from exc
    return BookOut(
        reference=done.booking.external_ref,
        amount=done.direct.amount,
        check_in=done.booking.check_in,
        nights=done.booking.nights,
        room_type=body.room_type,
        perk_applied=done.perk_applied,
        payment="Simulated UPI (test mode)",
        guest_short_name=(
            done.booking.guest.short_name if done.perk_applied and done.booking.guest else None
        ),
        rating_url=rating_url(
            settings.web_origin, issue_token(session, prop.id, "link", done.direct.id, now)
        ),
    )


class SavingOut(BaseModel):
    """One coded direct booking and what it avoided. Money in paise."""

    guest_name: str
    code: str
    amount: int
    check_in: date
    original_channel: str
    commission_rate_used: int
    commission_avoided: int
    gst_avoided: int
    upi_fee: int
    net_saving: int
    booked_at: datetime
    nights: int
    perk: str
    perk_cost: int
    kept_after_perk: int


class SeasonOut(BaseModel):
    """Season in review: coded bookings booked in the ledger season (Apr to Sep)."""

    start: date
    end: date
    count: int
    total_net_saving: int


class SavingsOut(BaseModel):
    """The savings ledger."""

    total_net_saving: int
    total_avoided: int
    count: int
    items: list[SavingOut]
    season: SeasonOut
    perk_cost_per_night: int
    perk_cost_is_sample: bool


def split_fields(saving: Saving, nights: int, cost_per_night: int) -> dict[str, int]:
    """The perk split of one saving row (ruling 5 lines untouched)."""
    split = perk_split(
        saving.commission_avoided + saving.gst_avoided, saving.upi_fee, nights, cost_per_night
    )
    return {"perk_cost": split.perk_cost, "kept_after_perk": split.kept_after_perk}


@savings_router.get("", response_model=SavingsOut)
def get_savings(
    _owner: OwnerDep,
    session: SessionDep,
    prop: PropertyDep,
    perk_cost_per_night: Annotated[
        int | None, Query(ge=0, le=MAX_PERK_COST_PER_NIGHT // PAISE_PER_RUPEE, description="Rupees")
    ] = None,
) -> SavingsOut:
    """Savings from coded direct bookings only. No code, no saving claimed.

    Each item also splits what it avoided into the UPI fee, the perk's cost
    to the hotel (a sample cost unless the owner enters one) and the rest.
    """
    cost = (
        SAMPLE_PERK_COST_PER_NIGHT
        if perk_cost_per_night is None
        else perk_cost_per_night * PAISE_PER_RUPEE
    )
    rows = session.execute(
        select(Saving, DirectBooking, Channel.name)
        .join(DirectBooking, DirectBooking.id == Saving.direct_booking_id)
        .join(Channel, Channel.id == Saving.original_channel_id)
        .where(DirectBooking.property_id == prop.id)
        .order_by(DirectBooking.created_at.desc())
    ).all()
    items = [
        SavingOut(
            guest_name=d.booking.guest_name,
            code=d.perk_code.code if d.perk_code else "",
            amount=d.amount,
            check_in=d.booking.check_in,
            original_channel=name,
            commission_rate_used=s.commission_rate_used,
            commission_avoided=s.commission_avoided,
            gst_avoided=s.gst_avoided,
            upi_fee=s.upi_fee,
            net_saving=s.net_saving,
            booked_at=d.created_at,
            nights=d.booking.nights,
            perk=d.perk_code.perk if d.perk_code else "",
            **split_fields(s, d.booking.nights, cost),
        )  # fmt: skip
        for s, d, name in rows
    ]
    booked = [(as_utc(i.booked_at).astimezone(IST).date(), i.net_saving) for i in items]
    season = season_review(booked, DEFAULT_START, DEFAULT_END)
    return SavingsOut(
        total_net_saving=sum(i.net_saving for i in items),
        total_avoided=sum(i.commission_avoided + i.gst_avoided for i in items),
        count=len(items),
        items=items,
        perk_cost_per_night=cost,
        perk_cost_is_sample=perk_cost_per_night is None,
        season=SeasonOut(
            start=season.start,
            end=season.end,
            count=season.count,
            total_net_saving=season.total_net_saving,
        ),  # fmt: skip
    )
