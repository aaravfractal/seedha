"""Hotel Site V2: the owner's hotel facts (amenities, nearby places, how to
reach, good to know, contact, map position) and printed-card scan counts.

Facts are plain owner text, validated strictly: capped lengths, no markup and
amenities only from a fixed list of 40. Nothing here is a price (rule 1) and
nothing here is guest data. The sample hotel's facts are fixed and fictional
(rule 11). A scan is only a count per card type per hotel day: no IP, cookie,
user agent or device data is stored in the database (hosting access logs keep
request addresses for their normal retention).

Text rules (review R1-10): line breaks and tabs become a space; then no
markup, no control, format (bidi override or
isolate, zero-width), separator or private-use characters, and any non-empty
text has at least one letter or digit. The one exception is a zero-width
joiner or non-joiner right after a Devanagari character, which Hindi spelling
can need. Phones are ASCII digits and spaces with one optional leading +, and
an email is a plain address that cannot carry extra mailto: parameters.

The card perk (`card_perk_en`, `card_perk_hi`) is the owner's own words for
what a guest who scans a printed card and books direct gets. Empty means the
hotel offers no card perk, and then nothing anywhere promises one (R2-1). It
is a perk, never a price or a discount (rule 6), so currency and % are refused.
"""

from __future__ import annotations

import json
import re
import unicodedata
from datetime import date, timedelta
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, BeforeValidator, ConfigDict, Field, ValidationError
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
# Scans counted per card type per hotel day at most; more are not counted.
DAILY_SCAN_CAP = 2_000
ScanCard = Literal["wallet", "room", "desk"]
NearbyKind = Literal[
    "viewpoint", "temple", "market", "waterfall", "trek", "lake", "station", "airport", "other"
]
TIME_PATTERN = r"^([01]\d|2[0-3]):[0-5]\d$"


# Unicode categories never allowed in owner text: control, format (bidi
# overrides and isolates, zero-width), surrogate, private use, unassigned,
# line and paragraph separators.
BANNED_CATEGORIES = frozenset({"Cc", "Cf", "Cs", "Co", "Cn", "Zl", "Zp"})
JOINERS = frozenset({"\u200c", "\u200d"})  # zero-width non-joiner and joiner
PHONE_PATTERN = re.compile(r"\+?[0-9][0-9 ]*")
MIN_PHONE_DIGITS = 6
EMAIL_PATTERN = r"^$|^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"
PRICE_WORDS = re.compile(r"[₹%]|\b(rs|inr|rupees?|discount)\b|रुपये|रुपए|छूट", re.IGNORECASE)


def devanagari(char: str) -> bool:
    """A character from the Devanagari block."""
    return "\u0900" <= char <= "\u097f"


def no_markup(value: str) -> str:
    """Plain, visible text only: the site escapes everything, and markup,
    control or invisible characters are never needed."""
    if "<" in value or ">" in value:
        raise ValueError("Use plain text without < or >")
    for i, char in enumerate(value):
        joiner_ok = char in JOINERS and i > 0 and devanagari(value[i - 1])
        if unicodedata.category(char) in BANNED_CATEGORIES and not joiner_ok:
            raise ValueError(
                "Remove hidden or control characters (line breaks, tabs, invisible marks)"
            )
    if value and not any(unicodedata.category(c)[0] in "LN" for c in value):
        raise ValueError("Use at least one letter or number")
    return value


def phone_ok(value: str) -> str:
    """ASCII digits and spaces with one optional leading +, or empty."""
    if value and not (
        PHONE_PATTERN.fullmatch(value) and sum(c.isdigit() for c in value) >= MIN_PHONE_DIGITS
    ):
        raise ValueError("Use digits 0 to 9, spaces and one leading +")
    return value


def flatten(value: object) -> object:
    """Line breaks and tabs (an owner pressing Enter in a text box) become one
    space; every other control character is refused by `no_markup`."""
    return re.sub(r"[\t\r\n]+", " ", value) if isinstance(value, str) else value


def no_price(value: str) -> str:
    """A perk is something the guest gets, never a price or discount (rule 6)."""
    if PRICE_WORDS.search(value):
        raise ValueError("Describe a perk such as tea on arrival, not a price or discount")
    return value


def amenities_ok(value: list[str]) -> list[str]:
    """Only ids from the fixed list, each once, in the fixed order."""
    unknown = sorted(set(value) - set(AMENITY_IDS))
    if unknown:
        raise ValueError(f"Unknown amenity: {unknown[0][:40]}")
    return [a for a in AMENITY_IDS if a in set(value)]


Flat = BeforeValidator(flatten)
PlainText = AfterValidator(no_markup)
Name = Annotated[str, Field(min_length=1, max_length=60), Flat, PlainText]
OptName = Annotated[str, Field(max_length=60), Flat, PlainText]
Line = Annotated[str, Field(min_length=1, max_length=200), Flat, PlainText]
OptLine = Annotated[str, Field(max_length=200), Flat, PlainText]
Short = Annotated[str, Field(min_length=1, max_length=160), Flat, PlainText]
OptShort = Annotated[str, Field(max_length=160), Flat, PlainText]
Phone = Annotated[str, Field(max_length=16), AfterValidator(phone_ok)]
Perk = Annotated[str, Field(max_length=100), Flat, PlainText, AfterValidator(no_price)]


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
    email: Annotated[str, Field(max_length=120, pattern=EMAIL_PATTERN)] = ""
    address_en: OptLine = ""
    address_hi: OptLine = ""


class Geo(Strict):
    """The hotel's map position."""

    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


Feature = Annotated[str, Field(min_length=1, max_length=40), Flat, PlainText]
Beds = Annotated[str, Field(max_length=40), Flat, PlainText]


class RoomDetail(Strict):
    """Owner facts for one room type the hotel sells, keyed by its name (the
    name must be one of the hotel's room types or built rooms, checked on
    save). Never a price: the price comes from the rooms table or the build."""

    name: Name
    size_sqft: int | None = Field(default=None, ge=50, le=5000)
    beds_en: Beds = ""
    beds_hi: Beds = ""
    max_guests: int | None = Field(default=None, ge=1, le=12)
    features_en: list[Feature] = Field(default_factory=list, max_length=2)
    features_hi: list[Feature] = Field(default_factory=list, max_length=2)
    photo_id: int | None = Field(default=None, ge=1)


def rooms_unique(value: list[RoomDetail]) -> list[RoomDetail]:
    """One entry per room name."""
    names = [r.name for r in value]
    if len(set(names)) != len(names):
        raise ValueError("Each room can be listed only once")
    return value


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
    # The owner's own perk for guests who scan a printed card; empty = none.
    card_perk_en: Perk = ""
    card_perk_hi: Perk = ""
    rooms: Annotated[list[RoomDetail], Field(max_length=12), AfterValidator(rooms_unique)] = Field(
        default_factory=list
    )


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
    card_perk_en="Sample perk: masala chai on arrival for guests who book direct",
    card_perk_hi="नमूना पर्क: सीधे बुक करने वाले मेहमानों के लिए पहुंचने पर मसाला चाय",
    rooms=[
        RoomDetail(name="Family Suite", size_sqft=520, beds_en="1 king bed and 2 single beds",
                   beds_hi="1 किंग बेड और 2 सिंगल बेड", max_guests=4,
                   features_en=["Separate sitting room", "Valley view"],
                   features_hi=["अलग बैठक", "घाटी का नज़ारा"]),
        RoomDetail(name="Deluxe Valley View", size_sqft=320, beds_en="1 king bed",
                   beds_hi="1 किंग बेड", max_guests=3,
                   features_en=["Private balcony", "Valley view"],
                   features_hi=["निजी बालकनी", "घाटी का नज़ारा"]),
        RoomDetail(name="Standard", size_sqft=240, beds_en="1 queen bed",
                   beds_hi="1 क्वीन बेड", max_guests=2,
                   features_en=["Room heater", "Tea and coffee maker"],
                   features_hi=["रूम हीटर", "चाय-कॉफ़ी मेकर"]),
    ],
)  # fmt: skip


def details_out(details: SiteDetailsIn, *, sample: bool) -> SiteDetailsOut:
    """Add each chosen amenity's labels."""
    labels = [
        AmenityOut(id=a, en=AMENITY_LABELS[a][0], hi=AMENITY_LABELS[a][1])
        for a in details.amenities
    ]
    return SiteDetailsOut(**details.model_dump(), amenity_labels=labels, sample=sample)


def check_rooms(details: SiteDetailsIn, room_names: set[str], photo_ids: set[int]) -> str | None:
    """Why the room details cannot be saved, or None. Every name must be a
    room the hotel sells and every photo one of the hotel's site photos."""
    for room in details.rooms:
        if room.name not in room_names:
            return f"{room.name} is not one of your rooms"
        if room.photo_id is not None and room.photo_id not in photo_ids:
            return f"The photo for {room.name} is not one of your site photos"
    return None


def with_room_photos(details: SiteDetailsOut, photo_ids: set[int]) -> SiteDetailsOut:
    """Room photos only when the photo is one this view shows (a public page
    never points at an unpublished or removed photo)."""
    rooms = [
        r
        if r.photo_id is None or r.photo_id in photo_ids
        else r.model_copy(update={"photo_id": None})
        for r in details.rooms
    ]
    return details.model_copy(update={"rooms": rooms})


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


def record_scan(session: Session, property_id: int, card: str, day: date) -> bool:
    """Count one scan of a printed card's QR. Stores only the count. False
    (not counted) once the card type has DAILY_SCAN_CAP scans that hotel day,
    so a script cannot inflate the owner's numbers without bound (R1-4)."""
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
            return True
        except IntegrityError:  # another scan created today's row first
            row = session.scalars(
                select(SiteCardScan).where(
                    SiteCardScan.property_id == property_id,
                    SiteCardScan.card == card,
                    SiteCardScan.day == day,
                )
            ).one()
    if row.count >= DAILY_SCAN_CAP:
        return False
    row.count += 1
    session.flush()
    return True


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
