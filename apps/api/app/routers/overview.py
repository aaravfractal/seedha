"""GET /overview: the owner's home screen and the app shell in one read."""

from __future__ import annotations

from datetime import date, datetime

from fastapi import APIRouter
from pydantic import BaseModel

from app.deps import OwnerDep, PropertyDep, SessionDep
from app.services.overview import Item, Overview, build_overview

router = APIRouter(prefix="/overview", tags=["overview"])


class OwnerOut(BaseModel):
    """How the shell greets the owner."""

    name: str
    short_name: str
    initials: str


class HotelOut(BaseModel):
    """The hotel chip."""

    name: str
    short_name: str
    rooms_count: int
    is_sample: bool


class PeriodOut(BaseModel):
    """The statement range the figures cover."""

    start: date
    end: date
    days: int
    available_room_nights: int


class KpisOut(BaseModel):
    """Six tiles. Money in paise, shares in tenths of a percent."""

    list_revenue: int
    net_kept: int
    net_kept_share_tenths: int
    net_adr: int
    list_adr: int
    revpar_net: int
    revpar_list: int
    paid_to_channels: int
    paid_to_channels_share_tenths: int | None
    commission_free_share_tenths: int | None
    direct_bookings_tenths: int | None
    room_nights: int
    occupancy_tenths: int


class InsightOut(BaseModel):
    """The ledger insight; `hi` is Roman-script Hinglish."""

    en: str
    hi: str


class WaterfallOut(BaseModel):
    """One waterfall bar, signed paise."""

    key: str
    label: str
    amount: int


class MixOut(BaseModel):
    """Room nights by channel."""

    key: str
    name: str
    room_nights: int
    share_tenths: int


class RoomOut(BaseModel):
    """A room tile; channel is null when the room was empty."""

    number: int
    channel_key: str | None
    code: str | None


class LastNightOut(BaseModel):
    """Rooms sold on the business day from the desk register."""

    date: date
    rooms_count: int
    sold: int
    net_kept: int
    direct_share_pct: int | None
    is_sample: bool
    rooms: list[RoomOut]


class SavingsOut(BaseModel):
    """Saved with codes."""

    total_net_saving: int
    count: int


class ItemOut(BaseModel):
    """A Needs-you row or a notification."""

    id: str
    title: str
    detail: str
    href: str
    icon: str
    at: datetime | None
    amount: int | None


class StepOut(BaseModel):
    """One step of the direct loop."""

    key: str
    done: bool


class ChecklistOut(BaseModel):
    """The 8-step direct loop."""

    steps: list[StepOut]
    done_count: int
    total: int


class OverviewOut(BaseModel):
    """Everything the Overview screen and the app shell read."""

    business_date: date
    owner: OwnerOut
    hotel: HotelOut
    period: PeriodOut
    has_statements: bool
    kpis: KpisOut | None
    insight: InsightOut | None
    waterfall: list[WaterfallOut]
    channel_mix: list[MixOut]
    last_night: LastNightOut
    savings: SavingsOut
    needs_you: list[ItemOut]
    pending_approvals: int
    checklist: ChecklistOut
    notifications: list[ItemOut]


def item_out(item: Item) -> ItemOut:
    """Shape one list item."""
    return ItemOut(
        id=item.key, title=item.title, detail=item.detail, href=item.href, icon=item.icon,
        at=item.at, amount=item.amount,
    )  # fmt: skip


def overview_out(o: Overview) -> OverviewOut:
    """Flatten the composed overview into the response."""
    k = o.kpis
    n = o.last_night
    steps = [StepOut(key=key, done=done) for key, done in o.steps.items()]
    return OverviewOut(
        business_date=o.business_date,
        owner=OwnerOut(name=o.owner.name, short_name=o.owner.short_name, initials=o.owner.initials),
        hotel=HotelOut(
            name=o.prop.name,
            short_name=o.prop.short_name,
            rooms_count=o.prop.rooms_count,
            is_sample=o.prop.is_sample,
        ),
        period=PeriodOut(
            start=o.start,
            end=o.end,
            days=o.days,
            available_room_nights=o.prop.rooms_count * o.days,
        ),
        has_statements=o.has_statements,
        kpis=(
            KpisOut(
                list_revenue=k.list_revenue,
                net_kept=k.net_kept,
                net_kept_share_tenths=k.net_kept_share_tenths,
                net_adr=k.net_adr,
                list_adr=k.list_adr,
                revpar_net=k.revpar_net,
                revpar_list=k.revpar_list,
                paid_to_channels=k.paid_to_channels,
                paid_to_channels_share_tenths=k.paid_to_channels_share_tenths,
                commission_free_share_tenths=k.commission_free_share_tenths,
                direct_bookings_tenths=k.direct_bookings_tenths,
                room_nights=k.room_nights,
                occupancy_tenths=k.occupancy_tenths,
            )
            if k
            else None
        ),
        insight=(
            InsightOut(en=o.insight_en, hi=o.insight_hi)
            if o.insight_en is not None and o.insight_hi is not None
            else None
        ),
        waterfall=[WaterfallOut(key=w.key, label=w.label, amount=w.amount) for w in o.waterfall],
        channel_mix=[
            MixOut(key=m.key, name=m.name, room_nights=m.room_nights, share_tenths=m.share_tenths)
            for m in o.mix
        ],
        last_night=LastNightOut(
            date=n.day,
            rooms_count=n.rooms_count,
            sold=n.sold,
            net_kept=n.net_kept,
            direct_share_pct=n.direct_share_pct,
            is_sample=n.is_sample,
            rooms=[
                RoomOut(number=r.number, channel_key=r.channel_key, code=r.code) for r in n.rooms
            ],
        ),
        savings=SavingsOut(total_net_saving=o.savings.total_net_saving, count=o.savings.count),
        needs_you=[item_out(i) for i in o.needs_you],
        pending_approvals=o.pending_approvals,
        checklist=ChecklistOut(
            steps=steps, done_count=sum(s.done for s in steps), total=len(steps)
        ),
        notifications=[item_out(i) for i in o.notifications],
    )


@router.get("", response_model=OverviewOut)
def get_overview(_owner: OwnerDep, session: SessionDep, prop: PropertyDep) -> OverviewOut:
    """Overview figures, the direct-loop checklist, Needs you and notifications."""
    return overview_out(build_overview(session, prop))
