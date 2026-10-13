"""Hotel Site V2: the owner's hotel facts (amenities, nearby places, how to
reach, good to know, contact, map position) and printed-card scan counts.

Facts are plain owner text, validated strictly: capped lengths, no markup and
amenities only from a fixed list of 40. Nothing here is a price (rule 1) and
nothing here is guest data. The sample hotel's facts are fixed and fictional
(rule 11). A scan is only a count per card type per hotel day: no IP, cookie,
user agent or device data is stored.
"""

from __future__ import annotations

import json
from datetime import date, timedelta
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import SiteCardScan, SiteDetails
from app.services.desk import utc_now

# (id, English, Hindi). The order is the order shown on the site.
AMENITIES: tuple[tuple[str, str, str], ...] = (
    ("wifi", "Free Wi-Fi", "मुफ़्त वाई-फ़ाई"),
    ("parking", "Free parking", "मुफ़्त पार्किंग"),
    ("breakfast", "Breakfast", "नाश्ता"),
    ("restaurant", "Restaurant", "रेस्तरां"),
    ("room_service", "Room service", "रूम सर्विस"),
    ("hot_water", "24-hour hot water", "24 घंटे गर्म पानी"),
    ("heater", "Room heater", "रूम हीटर"),
    ("power_backup", "Power backup", "पावर बैकअप"),
    ("valley_view", "Valley view", "घाटी का नज़ारा"),
    ("mountain_view", "Mountain view", "पहाड़ों का नज़ारा"),
    ("balcony", "Balcony", "बालकनी"),
    ("garden", "Garden", "बगीचा"),
    ("terrace", "Terrace", "छत"),
    ("bonfire", "Bonfire", "अलाव"),
    ("family_rooms", "Family rooms", "फ़ैमिली कमरे"),
    ("kids_play", "Kids' play area", "बच्चों के खेलने की जगह"),
    ("pet_friendly", "Pets allowed", "पालतू जानवर ला सकते हैं"),
    ("travel_desk", "Travel desk", "ट्रैवल डेस्क"),
    ("taxi", "Taxi on request", "मांग पर टैक्सी"),
    ("airport_pickup", "Airport pickup", "एयरपोर्ट पिकअप"),
    ("laundry", "Laundry", "लॉन्ड्री"),
    ("housekeeping", "Daily housekeeping", "रोज़ सफ़ाई"),
    ("tv", "TV", "टीवी"),
    ("tea_coffee", "Tea and coffee maker", "चाय-कॉफ़ी मेकर"),
    ("geyser", "Geyser", "गीज़र"),
    ("lift", "Lift", "लिफ़्ट"),
    ("wheelchair", "Wheelchair access", "व्हीलचेयर से पहुंच"),
    ("doctor_on_call", "Doctor on call", "डॉक्टर ऑन कॉल"),
    ("first_aid", "First aid", "प्राथमिक चिकित्सा"),
    ("cctv", "CCTV in common areas", "सामान्य जगहों पर सीसीटीवी"),
    ("upi", "UPI payments", "यूपीआई भुगतान"),
    ("cards", "Cards accepted", "कार्ड स्वीकार"),
    ("veg_food", "Pure veg food", "शुद्ध शाकाहारी भोजन"),
    ("local_food", "Local Garhwali food", "स्थानीय गढ़वाली भोजन"),
    ("yoga", "Yoga space", "योग की जगह"),
    ("trek_guide", "Trek guide on request", "मांग पर ट्रेक गाइड"),
    ("library", "Book corner", "किताबों का कोना"),
    ("indoor_games", "Indoor games", "इनडोर खेल"),
    ("workspace", "Work desk", "काम की मेज़"),
    ("luggage", "Luggage storage", "सामान रखने की जगह"),
)
AMENITY_IDS: tuple[str, ...] = tuple(a[0] for a in AMENITIES)
AMENITY_LABELS: dict[str, tuple[str, str]] = {a[0]: (a[1], a[2]) for a in AMENITIES}

SCAN_CARDS = ("wallet", "room", "desk")
ScanCard = Literal["wallet", "room", "desk"]
NearbyKind = Literal[
    "viewpoint", "temple", "market", "waterfall", "trek", "lake", "station", "airport", "other"
]
TIME_PATTERN = r"^([01]\d|2[0-3]):[0-5]\d$"


def no_markup(value: str) -> str:
    """Plain text only: the site escapes everything, and markup is never needed."""
    if "<" in value or ">" in value:
        raise ValueError("Use plain text without < or >")
    return value


def phone_ok(value: str) -> str:
    """Digits, spaces and a leading +, or empty."""
    if value and not (value.lstrip("+").replace(" ", "").isdigit() and "+" not in value[1:]):
        raise ValueError("Use digits, spaces and a leading +")
    return value


def amenities_ok(value: list[str]) -> list[str]:
    """Only ids from the fixed list, each once, in the fixed order."""
    unknown = sorted(set(value) - set(AMENITY_IDS))
    if unknown:
        raise ValueError(f"Unknown amenity: {unknown[0][:40]}")
    return [a for a in AMENITY_IDS if a in set(value)]


PlainText = AfterValidator(no_markup)
Name = Annotated[str, Field(min_length=1, max_length=60), PlainText]
OptName = Annotated[str, Field(max_length=60), PlainText]
Line = Annotated[str, Field(min_length=1, max_length=200), PlainText]
OptLine = Annotated[str, Field(max_length=200), PlainText]
Short = Annotated[str, Field(min_length=1, max_length=160), PlainText]
OptShort = Annotated[str, Field(max_length=160), PlainText]
Phone = Annotated[str, Field(max_length=16), AfterValidator(phone_ok)]


class Strict(BaseModel):
    """Every details model: unknown keys rejected, strings stripped."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class NearbyPlace(Strict):
    """A place near the hotel. `bearing` (0 = north, clockwise) places it on the map."""

    name_en: Name
    name_hi: OptName = ""
    minutes: int = Field(ge=1, le=600)
    mode: Literal["walk", "drive"]
    kind: NearbyKind = "other"
    bearing: int = Field(default=0, ge=0, le=359)


class ReachItem(Strict):
    """One way to get to the hotel."""

    mode: Literal["road", "rail", "air"]
    text_en: Line
    text_hi: OptLine = ""


class Note(Strict):
    """One "good to know" line."""

    text_en: Short
    text_hi: OptShort = ""


class Contact(Strict):
    """How guests reach the hotel. Empty strings mean "not set"."""

    phone: Phone = ""
    whatsapp: Phone = ""
    email: Annotated[str, Field(max_length=120, pattern=r"^$|^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$")] = (
        ""
    )
    address_en: OptLine = ""
    address_hi: OptLine = ""


class Geo(Strict):
    """The hotel's map position."""

    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class SiteDetailsIn(Strict):
    """Everything the owner can set. PUT replaces the whole object."""

    amenities: Annotated[
        list[Annotated[str, Field(max_length=40)]],
        Field(max_length=40),
        AfterValidator(amenities_ok),
    ] = Field(default_factory=list)
    nearby: list[NearbyPlace] = Field(default_factory=list, max_length=8)
    how_to_reach: list[ReachItem] = Field(default_factory=list, max_length=6)
    good_to_know: list[Note] = Field(default_factory=list, max_length=8)
    check_in: Annotated[str, Field(pattern=TIME_PATTERN)] = "12:00"
    check_out: Annotated[str, Field(pattern=TIME_PATTERN)] = "11:00"
    contact: Contact = Field(default_factory=Contact)
    geo: Geo | None = None


class AmenityOut(BaseModel):
    """An amenity with its labels, for the site."""

    id: str
    en: str
    hi: str


class SiteDetailsOut(SiteDetailsIn):
    """What the site and the owner screen get. `sample` marks the fixed
    sample facts of the fictional sample hotel."""

    model_config = ConfigDict(extra="forbid")

    amenity_labels: list[AmenityOut] = Field(default_factory=list)
    sample: bool = False


SAMPLE_DETAILS = SiteDetailsIn(
    amenities=[
        "wifi", "parking", "breakfast", "restaurant", "hot_water", "heater", "power_backup",
        "valley_view", "balcony", "garden", "bonfire", "family_rooms", "travel_desk", "taxi",
        "laundry", "tea_coffee", "upi", "local_food", "trek_guide", "luggage",
    ],
    nearby=[
        NearbyPlace(name_en="Mall Road", name_hi="मॉल रोड", minutes=5, mode="walk",
                    kind="market", bearing=200),
        NearbyPlace(name_en="Gun Hill", name_hi="गन हिल", minutes=10, mode="drive",
                    kind="viewpoint", bearing=330),
        NearbyPlace(name_en="Lal Tibba", name_hi="लाल टिब्बा", minutes=15, mode="drive",
                    kind="viewpoint", bearing=70),
        NearbyPlace(name_en="Kempty Falls", name_hi="केम्प्टी फ़ॉल्स", minutes=30, mode="drive",
                    kind="waterfall", bearing=290),
    ],
    how_to_reach=[
        ReachItem(mode="road", text_en="35 km from Dehradun by road, about 1.5 hours.",
                  text_hi="देहरादून से सड़क से 35 किमी, लगभग डेढ़ घंटा।"),
        ReachItem(mode="rail", text_en="Nearest station: Dehradun.",
                  text_hi="सबसे पास का स्टेशन: देहरादून।"),
        ReachItem(mode="air", text_en="Nearest airport: Jolly Grant, Dehradun.",
                  text_hi="सबसे पास का हवाई अड्डा: जॉली ग्रांट, देहरादून।"),
    ],
    good_to_know=[
        Note(text_en="The last 200 m is a steep walk; we carry your bags.",
             text_hi="आख़िरी 200 मीटर चढ़ाई है; सामान हम ले जाते हैं।"),
        Note(text_en="Nights are cold from October to March; heaters in every room.",
             text_hi="अक्टूबर से मार्च तक रातें ठंडी होती हैं; हर कमरे में हीटर है।"),
    ],
    contact=Contact(
        phone="+91 90000 00000", whatsapp="+91 90000 00000", email="",
        address_en="Mall Road, Mussoorie, Uttarakhand (sample address)",
        address_hi="मॉल रोड, मसूरी, उत्तराखंड (नमूना पता)",
    ),
    geo=Geo(lat=30.4598, lng=78.0664),
)  # fmt: skip


def details_out(details: SiteDetailsIn, *, sample: bool) -> SiteDetailsOut:
    """Add each chosen amenity's labels."""
    labels = [
        AmenityOut(id=a, en=AMENITY_LABELS[a][0], hi=AMENITY_LABELS[a][1])
        for a in details.amenities
    ]
    return SiteDetailsOut(**details.model_dump(), amenity_labels=labels, sample=sample)


def stored_details(session: Session, property_id: int) -> SiteDetailsIn | None:
    """The owner's saved facts, or None. A row that no longer validates (a
    future schema change) reads as none rather than breaking the site."""
    row = session.scalar(select(SiteDetails).where(SiteDetails.property_id == property_id))
    if row is None:
        return None
    try:
        return SiteDetailsIn.model_validate(json.loads(row.details_json))
    except (ValueError, ValidationError):
        return None


def read_details(
    session: Session, property_id: int, *, is_sample: bool, locked: bool
) -> SiteDetailsOut:
    """The facts to show. `locked` (production, sample hotel, public page)
    always gives the fixed sample facts, never a visitor's edits. The sample
    hotel starts from its sample facts; any other hotel from empty ones."""
    saved = None if locked else stored_details(session, property_id)
    if saved is not None:
        return details_out(saved, sample=False)
    if is_sample:
        return details_out(SAMPLE_DETAILS, sample=True)
    return details_out(SiteDetailsIn(), sample=False)


def save_details(session: Session, property_id: int, details: SiteDetailsIn) -> None:
    """Replace the owner's facts."""
    row = session.scalar(select(SiteDetails).where(SiteDetails.property_id == property_id))
    if row is None:
        row = SiteDetails(property_id=property_id)
        session.add(row)
    row.details_json = details.model_dump_json()
    row.updated_at = utc_now()
    session.flush()


def record_scan(session: Session, property_id: int, card: str, day: date) -> None:
    """Count one scan of a printed card's QR. Stores only the count."""
    row = session.scalar(
        select(SiteCardScan).where(
            SiteCardScan.property_id == property_id,
            SiteCardScan.card == card,
            SiteCardScan.day == day,
        )
    )
    if row is None:
        try:
            with session.begin_nested():
                session.add(SiteCardScan(property_id=property_id, card=card, day=day, count=1))
            return
        except IntegrityError:  # another scan created today's row first
            row = session.scalars(
                select(SiteCardScan).where(
                    SiteCardScan.property_id == property_id,
                    SiteCardScan.card == card,
                    SiteCardScan.day == day,
                )
            ).one()
    row.count += 1
    session.flush()


def month_scans(session: Session, property_id: int, month_start: date) -> list[SiteCardScan]:
    """Scan rows from the first day of a month to the end of that month."""
    next_month = (month_start.replace(day=1) + timedelta(days=32)).replace(day=1)
    return list(
        session.scalars(
            select(SiteCardScan)
            .where(
                SiteCardScan.property_id == property_id,
                SiteCardScan.day >= month_start,
                SiteCardScan.day < next_month,
            )
            .order_by(SiteCardScan.day, SiteCardScan.card)
        )
    )
