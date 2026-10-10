"""Seedha Site: the hotel's own direct-booking website.

Room prices are the hotel's public (rack) rates from the rooms table. Package
prices are computed: room rate x nights + listed extras, so every rupee on
the site comes from code (rule 1), and packages add value without lowering
the public room price (rule 6). Reasons shown for each package come from the
owner's own data where possible.

The setup answers below are the fictional sample hotel's (rule 11); a real
hotel gives them in the WhatsApp setup chat. Hindi copy is in Devanagari.
"""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Booking, Property, SiteConfig
from app.money import rupees
from app.services.ledger import DEFAULT_END, DEFAULT_START
from app.services.link import room_rates

MOODS = ("pine", "stone", "sky")
LANGS = ("en", "hi")
STAGES = ("empty", "chat", "review")
PACKAGE_STATES = ("pending", "approved", "skipped")
MIN_PACKAGE_NIGHTS, MAX_PACKAGE_NIGHTS = 1, 7
FRIDAY, SATURDAY = 4, 5

Bilingual = dict[str, str]


def both(en: str, hi: str) -> Bilingual:
    """One piece of copy in English and Hindi."""
    return {"en": en, "hi": hi}


@dataclass(frozen=True, slots=True)
class Extra:
    """Something added to a package, with its price in paise (per night or once)."""

    label: str
    amount: int
    per_night: bool = False


@dataclass(frozen=True, slots=True)
class PackageSpec:
    """A suggested package. `includes_*` follow the nights ("2 nights, ...")."""

    key: str
    name: Bilingual
    room_type: str
    nights: int
    includes_en: str
    includes_hi: str
    extras: tuple[Extra, ...]


PACKAGES: tuple[PackageSpec, ...] = (
    PackageSpec("wk", both("Weekend in the clouds", "बादलों में वीकेंड"), "Deluxe Valley View", 2,
                "breakfast, bonfire", "नाश्ता, अलाव",
                (Extra("Breakfast for two", rupees(400), per_night=True),)),
    PackageSpec("cd", both("Char Dham stopover", "चार धाम पड़ाव"), "Deluxe Valley View", 1,
                "early breakfast at 5 AM, parking", "सुबह 5 बजे नाश्ता, पार्किंग", ()),
    PackageSpec("mm", both("Monsoon midweek", "मानसून मिडवीक"), "Standard", 3,
                "breakfast, late checkout", "नाश्ता, देर से चेक-आउट",
                (Extra("Breakfast for two", rupees(400), per_night=True),
                 Extra("Late checkout", rupees(500)))),
)  # fmt: skip

# The sample hotel's setup answers (rule 11).
SAMPLE_ADDRESS = "deodarview.seedha.site"
NAME_HI = "देवदार व्यू"
LOCATION = both("Mall Road, Mussoorie", "मॉल रोड, मसूरी")
TAGLINE = both(
    "A quiet stay above Mall Road, with the valley at your window.",
    "मॉल रोड के ऊपर एक शांत ठहराव, खिड़की से घाटी का नज़ारा।",
)
ROOM_COPY: dict[str, tuple[str, Bilingual]] = {
    "Deluxe Valley View": ("डीलक्स वैली व्यू",
                           both("Breakfast included · valley view", "नाश्ता शामिल · घाटी का नज़ारा")),
    "Family Suite": ("फ़ैमिली सुइट", both("Two rooms · up to 4 guests", "दो कमरे · 4 मेहमान तक")),
    "Standard": ("स्टैंडर्ड", both("Cosy room · garden side", "आरामदायक कमरा · बगीचे की ओर")),
}  # fmt: skip
NEARBY: tuple[tuple[Bilingual, Bilingual], ...] = (
    (both("Mall Road", "मॉल रोड"), both("5 min walk", "5 मिनट पैदल")),
    (both("Gun Hill", "गन हिल"), both("10 min", "10 मिनट")),
    (both("Lal Tibba", "लाल टिब्बा"), both("15 min drive", "15 मिनट ड्राइव")),
    (both("Kempty Falls", "केम्प्टी फ़ॉल्स"), both("30 min drive", "30 मिनट ड्राइव")),
)
GALLERY: tuple[Bilingual, ...] = (
    both("View", "नज़ारा"),
    both("Deluxe room", "डीलक्स कमरा"),
    both("Breakfast", "नाश्ता"),
    both("Building", "इमारत"),
    both("Garden", "बगीचा"),
    both("Sunset", "सूर्यास्त"),
)
CONTACT = {"phone": "+91 90000 00000", "upi": "deodarview@upi"}
SETUP = {
    "photos_sent": 6,
    "photos_wanted": 8,
    "photo_labels": ["View", "Deluxe room", "Breakfast", "Building", "Garden", "Sunset"],
    "photo_tip": "Two more, please: one of the family suite and one of the entrance in daylight.",
    "voice_length": "0:42",
    "voice_summary": (
        "Family-run hotel, 5 minutes above Mall Road. Valley view from most rooms. "
        "Homely breakfast. Quiet at night."
    ),
}
GOOGLE_CATEGORIES = ("Hotel", "Family hotel", "Mountain resort", "Bed and breakfast")
GOOGLE_PHOTOS = ("View", "Deluxe room", "Breakfast", "Building", "Family suite")


@dataclass(frozen=True, slots=True)
class PriceLine:
    """One line of a package price (paise)."""

    label: str
    amount: int


@dataclass(frozen=True, slots=True)
class Package:
    """A package with its computed price, reason and the owner's decision."""

    spec: PackageSpec
    nights: int
    price: int
    lines: tuple[PriceLine, ...]
    why: str
    state: str

    @property
    def approved(self) -> bool:
        """Shown on the site."""
        return self.state == "approved"

    def includes(self, lang: str) -> str:
        """'2 nights, breakfast, bonfire' in the language asked for."""
        if lang == "hi":
            unit = "रात" if self.nights == 1 else "रातें"
            return f"{self.nights} {unit}, {self.spec.includes_hi}"
        unit = "night" if self.nights == 1 else "nights"
        return f"{self.nights} {unit}, {self.spec.includes_en}"


def slugify(name: str) -> str:
    """'Deodar View' -> 'deodar-view'."""
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def get_config(session: Session, property_id: int) -> SiteConfig:
    """The property's site settings, created on first use.

    Two first requests can race; the loser's insert is rolled back to a
    savepoint and it reads the row the winner created.
    """
    query = select(SiteConfig).where(SiteConfig.property_id == property_id)
    config = session.scalar(query)
    if config is not None:
        return config
    try:
        with session.begin_nested():
            config = SiteConfig(property_id=property_id)
            session.add(config)
    except IntegrityError:
        config = session.scalar(query)
        if config is None:  # pragma: no cover - the conflicting row must exist
            raise
    return config


def package_lines(spec: PackageSpec, nights: int, rates: dict[str, int]) -> tuple[PriceLine, ...]:
    """The public room rate for each night, then the extras (paise)."""
    unit = "night" if nights == 1 else "nights"
    lines = [PriceLine(f"{spec.room_type}, {nights} {unit}", rates[spec.room_type] * nights)]
    for extra in spec.extras:
        lines.append(PriceLine(extra.label, extra.amount * (nights if extra.per_night else 1)))
    return tuple(lines)


def package_price(spec: PackageSpec, rates: dict[str, int], nights: int | None = None) -> int:
    """Public room rate x nights + extras (paise). Never below the room price alone."""
    return sum(line.amount for line in package_lines(spec, nights or spec.nights, rates))


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


def read_states(raw: str) -> dict[str, tuple[str, int | None]]:
    """Owner decisions stored as 'key:state:nights' tokens.

    A bare 'key' (the earlier format) means approved at the suggested nights.
    """
    out: dict[str, tuple[str, int | None]] = {}
    for token in filter(None, raw.split(",")):
        key, _, rest = token.partition(":")
        state, _, nights = rest.partition(":")
        out[key] = (state or "approved", int(nights) if nights.isdigit() else None)
    return out


def write_states(config: SiteConfig, states: dict[str, tuple[str, int | None]]) -> None:
    """Store the decisions back on the config."""
    config.approved_packages = ",".join(
        f"{key}:{state}:{nights or ''}" for key, (state, nights) in sorted(states.items())
    )


def packages(session: Session, prop: Property, config: SiteConfig) -> list[Package]:
    """All suggested packages with computed prices and the owner's decisions."""
    rates = room_rates(session, prop.id)
    why = reasons(session, prop.id)
    states = read_states(config.approved_packages)
    out = []
    for spec in PACKAGES:
        state, nights = states.get(spec.key, ("pending", None))
        n = nights or spec.nights
        lines = package_lines(spec, n, rates)
        out.append(Package(spec, n, sum(x.amount for x in lines), lines, why[spec.key], state))
    return out


def spec_for(key: str) -> PackageSpec:
    """The package with this key. Unknown keys raise KeyError."""
    for spec in PACKAGES:
        if spec.key == key:
            return spec
    raise KeyError(key)


def approve_package(config: SiteConfig, key: str) -> None:
    """Add a package to the site. Unknown keys raise KeyError."""
    decide_package(config, key, state="approved")


def decide_package(
    config: SiteConfig, key: str, *, state: str | None = None, nights: int | None = None
) -> None:
    """Approve, skip or edit a package. Editing the nights asks for a fresh OK.

    Unknown keys raise KeyError; a bad state or nights raises ValueError.
    """
    spec = spec_for(key)
    if state is not None and state not in PACKAGE_STATES:
        raise ValueError(state)
    if nights is not None and not MIN_PACKAGE_NIGHTS <= nights <= MAX_PACKAGE_NIGHTS:
        raise ValueError(nights)
    states = read_states(config.approved_packages)
    old_state, old_nights = states.get(key, ("pending", None))
    new_nights = old_nights if nights is None else (None if nights == spec.nights else nights)
    new_state = state or (
        "pending" if nights is not None and new_nights != old_nights else old_state
    )
    states[key] = (new_state, new_nights)
    write_states(config, states)


def rooms_copy(room_type: str) -> tuple[str, Bilingual]:
    """Hindi name and a short line for a room type (plain fallback for unknown types)."""
    return ROOM_COPY.get(room_type, (room_type, both("", "")))


def google_description(prop: Property) -> Bilingual:
    """Ready-to-paste Google Business Profile descriptions."""
    n = prop.rooms_count
    return both(
        f"{prop.short_name} is a family-run {n}-room hotel a short walk above Mall Road, "
        "Mussoorie. Valley-view rooms, homely breakfast, and direct booking with UPI.",
        f"{NAME_HI} मसूरी के मॉल रोड से थोड़ी दूरी पर {n} कमरों वाला पारिवारिक होटल है। "
        "घाटी के नज़ारे वाले कमरे, घर जैसा नाश्ता, और UPI से सीधी बुकिंग।",
    )


def is_public(prop: Property, config: SiteConfig) -> bool:
    """Guests may see a site once it is published; the sample hotel is always shown."""
    return config.published_at is not None or prop.is_sample
