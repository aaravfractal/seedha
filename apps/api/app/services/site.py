"""Seedha Site: the hotel's own direct-booking website.

Room prices are the hotel's public (rack) rates from the rooms table. Package
prices are computed: room rate x nights + listed extras, so every rupee on
the site comes from code (rule 1), and packages add value without lowering
the public room price (rule 6). Reasons shown for each package come from the
owner's own data where possible.

The setup answers below are the fictional sample hotel's (rule 11); a real
hotel gives them in the WhatsApp setup chat.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import Booking, Property, SiteConfig
from app.money import rupees
from app.services.ledger import DEFAULT_END, DEFAULT_START
from app.services.link import room_rates

MOODS = ("pine", "stone", "sky")
LANGS = ("en", "hi")
STAGES = ("empty", "chat", "review")
FRIDAY, SATURDAY = 4, 5


@dataclass(frozen=True, slots=True)
class Extra:
    """Something added to a package, with its price in paise."""

    label: str
    amount: int


@dataclass(frozen=True, slots=True)
class PackageSpec:
    """A suggested package."""

    key: str
    name: str
    room_type: str
    nights: int
    includes: str
    extras: tuple[Extra, ...]


PACKAGES: tuple[PackageSpec, ...] = (
    PackageSpec("wk", "Weekend in the clouds", "Deluxe Valley View", 2,
                "2 nights, breakfast, bonfire", (Extra("Breakfast for two, 2 days", rupees(800)),)),
    PackageSpec("cd", "Char Dham stopover", "Deluxe Valley View", 1,
                "1 night, breakfast at 5 AM, parking", ()),
    PackageSpec("mm", "Monsoon midweek", "Standard", 3, "3 nights, breakfast, late checkout",
                (Extra("Breakfast for two, 3 days", rupees(1_200)),
                 Extra("Late checkout", rupees(500)))),
)  # fmt: skip

SETUP_CHAT: tuple[tuple[str, str], ...] = (
    ("Send 8 photos: rooms, view, food, outside.", "8 photos sent"),
    ("Apne hotel ke baare mein ek voice note bhejiye.", "Voice note, 0:42"),
    ("Room types aur normal price?", "Deluxe, Family Suite, Standard"),
    ("Paas mein kya hai?", "Mall Road, Gun Hill, Kempty Falls, Lal Tibba"),
    ("Contact number aur UPI ID?", "98XXX XXXXX · deodarview@upi (sample)"),
)
WELCOME = {
    "en": "Quiet rooms above Mall Road with valley views.",
    "hi": "Mall Road ke upar shaant kamre, valley view ke saath.",
}
NEARBY = (
    "Mall Road 5 min walk · Gun Hill 10 min · Lal Tibba 15 min drive · Kempty Falls 30 min drive"
)
SAMPLE_ADDRESS = "deodarview.seedha.site"


@dataclass(frozen=True, slots=True)
class Package:
    """A package with its computed price and reason."""

    spec: PackageSpec
    price: int
    why: str
    approved: bool


def get_config(session: Session, property_id: int) -> SiteConfig:
    """The property's site settings, created on first use."""
    config = session.scalar(select(SiteConfig).where(SiteConfig.property_id == property_id))
    if config is None:
        config = SiteConfig(property_id=property_id)
        session.add(config)
        session.flush()
    return config


def package_price(spec: PackageSpec, rates: dict[str, int]) -> int:
    """Public room rate x nights + extras (paise)."""
    return rates[spec.room_type] * spec.nights + sum(e.amount for e in spec.extras)


def window_stays(session: Session, property_id: int) -> list[Booking]:
    """Counted stays in the default ledger window."""
    return list(
        session.scalars(
            select(Booking).where(
                Booking.property_id == property_id,
                Booking.status == "stay",
                Booking.check_in >= DEFAULT_START,
                Booking.check_in <= DEFAULT_END,
                or_(Booking.math_check_passed.is_(True), Booking.review_status == "accepted"),
            )
        )
    )


def reasons(session: Session, property_id: int) -> dict[str, str]:
    """Why each package, from the owner's own bookings where possible."""
    stays = window_stays(session, property_id)
    total = sum(b.nights for b in stays)
    out = {"cd": "Yatra guests stay one night on the way to the Char Dham."}
    if not total:
        out["wk"] = "Weekends usually fill first in hill towns."
        out["mm"] = "Monsoon weekdays are usually the emptiest."
        return out
    weekend = sum(b.nights for b in stays if b.check_in.weekday() in {FRIDAY, SATURDAY})
    share = (weekend * 100 + total // 2) // total
    out["wk"] = (
        f"Your weekends fill fastest: {share}% of room nights start on a Friday or Saturday."
    )
    by_month: Counter[int] = Counter()
    for b in stays:
        by_month[b.check_in.month] += b.nights
    quiet = sorted(by_month, key=lambda m: by_month[m])[:2]
    names = " and ".join(datetime(2026, m, 1, tzinfo=UTC).strftime("%B") for m in sorted(quiet))
    out["mm"] = f"{names} are your emptiest months."
    return out


def packages(session: Session, prop: Property, config: SiteConfig) -> list[Package]:
    """All suggested packages with computed prices."""
    rates = room_rates(session, prop.id)
    why = reasons(session, prop.id)
    approved = set(filter(None, config.approved_packages.split(",")))
    return [
        Package(spec, package_price(spec, rates), why[spec.key], spec.key in approved)
        for spec in PACKAGES
    ]


def approve_package(config: SiteConfig, key: str) -> None:
    """Add a package to the site. Unknown keys raise KeyError."""
    if key not in {p.key for p in PACKAGES}:
        raise KeyError(key)
    approved = set(filter(None, config.approved_packages.split(",")))
    approved.add(key)
    config.approved_packages = ",".join(sorted(approved))
