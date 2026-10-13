"""Hotel Site V2, owner routes: the hotel's facts and card scan counts
(docs/HOTEL_SITE_V2.md). Owner-only like routers/site.py.

The facts are plain text validated by app.services.site_details; nothing here
is a price. Scan counts are only counts per card type per hotel day. The
printable cards and their QR codes are built from the same site data and
carry no prices (app.services.site_cards).
"""

from __future__ import annotations

from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel

from app.deps import OwnerDep, PropertyDep, SessionDep, SettingsDep
from app.errors import ApiError
from app.ratelimit import rate_limited
from app.routers.site import built_content, site_content
from app.services.desk import business_date, utc_now
from app.services.link import room_rates
from app.services.site import get_config
from app.services.site_cards import (
    CardData,
    CardKind,
    QrCard,
    card_base_url,
    card_data,
    card_url,
    cards_pdf,
    qr_png,
    qr_svg,
)
from app.services.site_details import (
    SCAN_CARDS,
    SiteDetailsIn,
    SiteDetailsOut,
    check_rooms,
    month_scans,
    read_details,
    save_details,
)
from app.services.site_gen import read_rooms
from app.services.site_photos import list_photos

router = APIRouter(prefix="/site", tags=["site"])
# PDFs and QR images are CPU work; nobody needs them in a loop (R1-11).
CARDS_LIMIT = Depends(rate_limited("cards"))


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
    """Replace the hotel's facts. Every field is validated; markup is refused.
    Room details must name rooms the hotel sells and use its own site photos."""
    built = built_content(session, prop.id)
    names = set(room_rates(session, prop.id))
    if built is not None:
        names |= {r.name for r in read_rooms(built)}
    reason = check_rooms(body, names, {p.id for p in list_photos(session, prop.id)})
    if reason is not None:
        raise ApiError(422, "bad_room_details", reason)
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


PDF_RESPONSE: dict[int | str, dict[str, Any]] = {200: {"content": {"application/pdf": {}}}}


def owner_site(session: SessionDep, prop: PropertyDep, settings: SettingsDep) -> dict[str, Any]:
    """The owner's view of the site (what the cards and QR codes are built from)."""
    return site_content(session, prop, get_config(session, prop.id), settings, public=False)


def owner_card_data(site: dict[str, Any], prop: PropertyDep, settings: SettingsDep) -> CardData:
    """The cards' text from the owner's view of the site (English only)."""
    details = site["details"]
    contact = details.contact
    return card_data(
        hotel=site["hotel"],
        url=card_base_url(settings, site["slug"], site["url"]),
        display_url=site["address"],
        location=site["location"]["en"],
        tagline=site["tagline"]["en"],
        contact={"phone": contact.phone, "whatsapp": contact.whatsapp,
                 "email": contact.email, "address": contact.address_en},
        times=(details.check_in, details.check_out),
        nearby=[(p.name_en, p.minutes, p.mode) for p in details.nearby],
        notes=[n.text_en for n in details.good_to_know],
        sample=prop.is_sample,
        hide_branding=site["hide_branding"],
        perk=details.card_perk_en,
    )  # fmt: skip


@router.get(
    "/cards.pdf", response_class=Response, responses=PDF_RESPONSE, dependencies=[CARDS_LIMIT]
)
def get_cards_pdf(
    _owner: OwnerDep,
    session: SessionDep,
    prop: PropertyDep,
    settings: SettingsDep,
    kind: Annotated[CardKind, Query()] = "all",
) -> Response:
    """Printable cards (wallet, room, tent or all) with bleed, crop marks and
    a CMYK colour page."""
    site = owner_site(session, prop, settings)
    return Response(
        content=cards_pdf(owner_card_data(site, prop, settings), kind),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{site["slug"]}-cards-{kind}.pdf"',
            "Cache-Control": "no-store",
        },
    )


def qr_target(session: SessionDep, prop: PropertyDep, settings: SettingsDep, card: QrCard) -> str:
    """<PUBLIC_BASE_URL>/h/<slug>?src=card-<type> (the site address without PUBLIC_BASE_URL)."""
    site = owner_site(session, prop, settings)
    return card_url(card_base_url(settings, site["slug"], site["url"]), card)


@router.get(
    "/cards/qr.svg",
    response_class=Response,
    dependencies=[CARDS_LIMIT],
    responses={200: {"content": {"image/svg+xml": {}}}},
)
def get_card_qr_svg(
    _owner: OwnerDep,
    session: SessionDep,
    prop: PropertyDep,
    settings: SettingsDep,
    card: Annotated[QrCard, Query()],
) -> Response:
    """The card's QR (level H, 4-module quiet zone) as SVG."""
    return Response(
        content=qr_svg(qr_target(session, prop, settings, card)),
        media_type="image/svg+xml",
        headers={"Content-Disposition": f'attachment; filename="qr-card-{card}.svg"',
                 "Cache-Control": "no-store"},
    )  # fmt: skip


@router.get(
    "/cards/qr.png",
    response_class=Response,
    dependencies=[CARDS_LIMIT],
    responses={200: {"content": {"image/png": {}}}},
)
def get_card_qr_png(
    _owner: OwnerDep,
    session: SessionDep,
    prop: PropertyDep,
    settings: SettingsDep,
    card: Annotated[QrCard, Query()],
) -> Response:
    """The card's QR (level H, 4-module quiet zone) as a PNG of at least 1024 px."""
    return Response(
        content=qr_png(qr_target(session, prop, settings, card)),
        media_type="image/png",
        headers={"Content-Disposition": f'attachment; filename="qr-card-{card}.png"',
                 "Cache-Control": "no-store"},
    )  # fmt: skip
