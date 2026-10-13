"""Hotel Site V2, owner routes: the hotel's facts and card scan counts
(docs/HOTEL_SITE_V2.md). Owner-only like routers/site.py.

The facts are plain text validated by app.services.site_details; nothing here
is a price. Scan counts are only counts per card type per hotel day.
"""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter
from pydantic import BaseModel

from app.deps import OwnerDep, PropertyDep, SessionDep
from app.services.desk import business_date, utc_now
from app.services.site_details import (
    SCAN_CARDS,
    SiteDetailsIn,
    SiteDetailsOut,
    month_scans,
    read_details,
    save_details,
)

router = APIRouter(prefix="/site", tags=["site"])


class ScanDayOut(BaseModel):
    """One hotel day's scans per card type."""

    day: date
    wallet: int = 0
    room: int = 0
    desk: int = 0


class ScansOut(BaseModel):
    """This month's card scans (hotel days), in total, per card and per day."""

    month: str
    total: int
    by_card: dict[str, int]
    by_day: list[ScanDayOut]


@router.get("/details", response_model=SiteDetailsOut)
def get_details(_owner: OwnerDep, session: SessionDep, prop: PropertyDep) -> SiteDetailsOut:
    """The hotel's facts as the owner last saved them (the sample hotel starts
    from its labelled sample facts; any other hotel from empty ones)."""
    return read_details(session, prop.id, is_sample=prop.is_sample, locked=False)


@router.put("/details", response_model=SiteDetailsOut)
def put_details(
    body: SiteDetailsIn, _owner: OwnerDep, session: SessionDep, prop: PropertyDep
) -> SiteDetailsOut:
    """Replace the hotel's facts. Every field is validated; markup is refused."""
    save_details(session, prop.id, body)
    return read_details(session, prop.id, is_sample=prop.is_sample, locked=False)


@router.get("/scans", response_model=ScansOut)
def get_scans(_owner: OwnerDep, session: SessionDep, prop: PropertyDep) -> ScansOut:
    """Card scans this month, by the hotel's own calendar."""
    today = business_date(session, prop.id, utc_now().date())
    start = today.replace(day=1)
    by_card = dict.fromkeys(SCAN_CARDS, 0)
    days: dict[date, ScanDayOut] = {}
    for row in month_scans(session, prop.id, start):
        by_card[row.card] = by_card.get(row.card, 0) + row.count
        day = days.setdefault(row.day, ScanDayOut(day=row.day))
        setattr(day, row.card, getattr(day, row.card) + row.count)
    return ScansOut(
        month=start.strftime("%Y-%m"),
        total=sum(by_card.values()),
        by_card=by_card,
        by_day=sorted(days.values(), key=lambda d: d.day),
    )
