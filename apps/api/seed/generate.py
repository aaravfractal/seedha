"""Deterministic generator for the Hotel Deodar View sample data (fictional).

Run: python -m seed.generate   (writes seed/data/*.csv)

The output must reproduce every locked total exactly (CLAUDE.md M1, rulings
1 to 7). Line items on every row are computed from the channel contract with
half-up rupee rounding (ruling 1); the generator then nudges individual list
amounts and hotel-funded discounts until the channel sums hit the locked
totals exactly. It refuses to write files if any total is off.
"""

from __future__ import annotations

import calendar
import csv
import random
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path

from app.money import bps_of, gst_on_commission, upi_fee
from seed.spec import (
    CHANNEL_BY_KEY,
    CHANNELS,
    HISTORY_FILE,
    MONTH_ROOM_NIGHTS,
    ROOM_TYPES,
    ROOMS,
    TDS_BPS,
    WINDOW_YEAR,
    ChannelSpec,
)

SEED = 20261013
DATA_DIR = Path(__file__).resolve().parent / "data"
MAX_SEARCH_STEPS = 400_000


class GenerationError(RuntimeError):
    """Raised when the generator cannot hit a locked total."""


# --------------------------------------------------------------------------
# Row model (whole rupees; the loader converts to paise)
# --------------------------------------------------------------------------


@dataclass(slots=True)
class Row:
    """One statement line in whole rupees."""

    file: str
    ref: str
    channel: str
    status: str
    check_in: date
    nights: int
    room: int | None
    guest_name: str
    guest_city: str
    list_amount: int = 0
    discount: int = 0
    commission: int = 0
    gst: int = 0
    fees: int = 0
    tds: int = 0
    tcs: int = 0
    payout: int = 0
    pinned: bool = False
    room_type: str = ""

    @property
    def net(self) -> int:
        """List minus every rounded deduction."""
        return self.list_amount - self.discount - self.commission - self.gst - self.fees


def _rupee(fn: Callable[[int], int], amount_rupees: int) -> int:
    """Apply a paise-based money helper to a rupee amount."""
    return fn(amount_rupees * 100) // 100


def rupee_bps(amount_rupees: int, rate_bps: int) -> int:
    """rate_bps of a rupee amount, rounded half-up to the rupee."""
    return bps_of(amount_rupees * 100, rate_bps) // 100


def compute_lines(row: Row, spec: ChannelSpec) -> None:
    """Fill commission, GST, fees, TDS and payout from the contract (ruling 1)."""
    if row.status != "stay":
        row.list_amount = row.discount = row.commission = row.gst = row.fees = 0
        row.tds = row.tcs = row.payout = 0
        return
    base = row.list_amount - row.discount
    row.commission = _rupee(lambda p: bps_of(p, spec.commission_bps), base)
    row.gst = _rupee(gst_on_commission, row.commission) if spec.gst_applies else 0
    row.fees = _rupee(upi_fee, base) if spec.upi_fee_applies else 0
    row.tds = _rupee(lambda p: bps_of(p, TDS_BPS), base) if spec.tds_applies else 0
    row.tcs = 0
    row.payout = row.net - row.tds - row.tcs


# --------------------------------------------------------------------------
# Names (all fictional). Pools are disjoint so only planted repeats can match.
# --------------------------------------------------------------------------

WINDOW_FIRST = [
    "Aakash",
    "Abhinav",
    "Aditi",
    "Akshay",
    "Alok",
    "Amrita",
    "Ankit",
    "Anushka",
    "Aparna",
    "Arnav",
    "Ashish",
    "Bhavna",
    "Chirag",
    "Devansh",
    "Divya",
    "Gaurav",
    "Harsh",
    "Ishita",
    "Jatin",
    "Kavya",
    "Kunal",
    "Lavanya",
    "Manish",
    "Mansi",
    "Nikhil",
    "Nidhi",
    "Omkar",
    "Pallavi",
    "Parth",
    "Payal",
    "Rajat",
    "Ritika",
    "Sahil",
    "Sakshi",
    "Saurabh",
    "Shreya",
    "Siddharth",
    "Simran",
    "Tanvi",
    "Tarun",
    "Udit",
    "Vaibhav",
    "Varsha",
    "Yash",
    "Zoya",
]
WINDOW_LAST = [
    "Agarwal",
    "Ahuja",
    "Bhatt",
    "Bisht",
    "Chopra",
    "Dutta",
    "Garg",
    "Goel",
    "Grover",
    "Jain",
    "Kapoor",
    "Kohli",
    "Khanna",
    "Kulkarni",
    "Mathur",
    "Mittal",
    "Negi",
    "Pandey",
    "Puri",
    "Rana",
    "Rastogi",
    "Saxena",
    "Sethi",
    "Shukla",
    "Sinha",
    "Sood",
    "Srivastava",
    "Tandon",
    "Thakur",
    "Tiwari",
    "Trivedi",
    "Upadhyay",
    "Vohra",
    "Wadhwa",
    "Bhandari",
    "Dhawan",
    "Gill",
    "Lamba",
    "Marwah",
    "Oberoi",
]
HISTORY_FIRST = [
    "Bharat",
    "Charu",
    "Dhruv",
    "Esha",
    "Farhan",
    "Gauri",
    "Hemant",
    "Indu",
    "Jaya",
    "Keshav",
    "Lalit",
    "Mohit",
    "Naina",
    "Ojas",
    "Prakash",
    "Radhika",
    "Sameer",
    "Tushar",
    "Uma",
    "Vinod",
]
HISTORY_LAST = [
    "Ahluwalia",
    "Bajaj",
    "Chaudhary",
    "Dhillon",
    "Fernandes",
    "Ganguly",
    "Hegde",
    "Jaiswal",
    "Kamath",
    "Luthra",
    "Menon",
    "Nanda",
    "Pillai",
    "Rao",
    "Sengupta",
]
CITIES = [
    "Delhi",
    "Gurugram",
    "Noida",
    "Ghaziabad",
    "Faridabad",
    "Lucknow",
    "Chandigarh",
    "Dehradun",
    "Jaipur",
    "Meerut",
    "Ambala",
    "Kanpur",
    "Agra",
    "Ludhiana",
    "Mumbai",
    "Bengaluru",
    "Kolkata",
    "Pune",
]


@dataclass(frozen=True, slots=True)
class RepeatGuest:
    """A planted repeat: a 2025 first stay and a return OTA booking in 2026."""

    window_name: str
    city: str
    channel: str
    month: int
    nights: int
    paid_twice: int
    first_name: str
    first_channel: str
    first_date: date
    first_city: str | None = None


REPEAT_GUESTS: tuple[RepeatGuest, ...] = (
    RepeatGuest("Rahul S.", "Delhi", "mmt", 5, 3, 3480,
                "Rahul S.", "mmt", date(2025, 5, 16)),
    RepeatGuest("Neha Gupta", "Gurugram", "bcom", 6, 3, 3120,
                "Neha Gupta", "bcom", date(2025, 10, 10), "Delhi"),
    RepeatGuest("A. Verma family", "Lucknow", "mmt", 4, 3, 4060,
                "Anil Verma", "agoda", date(2025, 12, 26), "Kanpur"),
    RepeatGuest("Priya Nair", "Bengaluru", "agoda", 7, 3, 2980,
                "Priya Nair", "mmt", date(2025, 6, 6)),
    RepeatGuest("Vikram Chauhan", "Chandigarh", "mmt", 6, 3, 3650,
                "Vikram Chauhan", "bcom", date(2025, 9, 19)),
    RepeatGuest("Sana Qureshi", "Noida", "bcom", 5, 3, 3409,
                "Sana Qureshi", "bcom", date(2025, 11, 14)),
    RepeatGuest("Karan Malhotra", "Delhi", "mmt", 9, 3, 2860,
                "Karan Malhotra", "walkin", date(2025, 10, 24)),
    RepeatGuest("Meera Iyer", "Mumbai", "bcom", 8, 3, 3921,
                "Meera Iyer", "agoda", date(2025, 12, 12)),
    RepeatGuest("Rohit Bansal", "Meerut", "mmt", 4, 3, 3300,
                "Rohit Bansal", "mmt", date(2025, 12, 19)),
    RepeatGuest("Ananya Joshi", "Dehradun", "agoda", 9, 3, 3761,
                "Ananya Joshi", "direct", date(2025, 11, 7)),
    RepeatGuest("Deepak Rawat", "Ghaziabad", "mmt", 6, 3, 3540,
                "D. Rawat", "ta", date(2025, 8, 22)),
    RepeatGuest("Pooja Arora", "Jaipur", "bcom", 9, 3, 3719,
                "Pooja Arora", "mmt", date(2025, 9, 5)),
)  # fmt: skip

REPEAT_PAID_TWICE_TOTAL = 41_800


# --------------------------------------------------------------------------
# Statement file layout (decision B): 1,500 lines, 3 flagged
# --------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class FileSpec:
    """How many stay and cancellation lines a file carries per channel."""

    filename: str
    channel: str
    months: tuple[int, ...]
    stays: int
    cancellations: int


FILES: tuple[FileSpec, ...] = (
    FileSpec("MakeMyTrip Apr to Jun.pdf", "mmt", (4, 5, 6), 330, 79),
    FileSpec("MakeMyTrip Jul to Sep.pdf", "mmt", (7, 8, 9), 228, 184),
    FileSpec("Booking.com payouts.xlsx", "bcom", (4, 5, 6, 7, 8, 9), 200, 13),
    FileSpec("Agoda statement.csv", "agoda", (4, 5, 6, 7, 8, 9), 88, 7),
    FileSpec("Travel agent register.xlsx", "ta", (4, 5, 6, 7, 8, 9), 165, 15),
    FileSpec("Hotel register.xlsx", "walkin", (4, 5, 6, 7, 8, 9), 75, 0),
    FileSpec("Hotel register.xlsx", "direct", (4, 5, 6, 7, 8, 9), 113, 0),
)
FLAGGED_REFS = ("MM48213", "BK55320", "AG77102")
FILE_ROW_COUNTS = {
    "MakeMyTrip Apr to Jun.pdf": 410,
    "MakeMyTrip Jul to Sep.pdf": 412,
    "Booking.com payouts.xlsx": 214,
    "Agoda statement.csv": 96,
    "Travel agent register.xlsx": 180,
    "Hotel register.xlsx": 188,
}

PROMO_BPS = {
    "mmt": (0, 1000, 1200, 1200, 1500, 2000),
    "bcom": (0, 1000, 1000, 1000, 1500),
    "agoda": (1000, 1500, 1500, 2000),
}
TYPE_WEIGHTS = {
    "mmt": (55, 30, 15),
    "bcom": (60, 20, 20),
    "agoda": (45, 40, 15),
    "ta": (35, 55, 10),
    "walkin": (55, 15, 30),
    "direct": (60, 25, 15),
}
TYPE_ORDER = ("Deluxe Valley View", "Standard", "Family Suite")
WEEKDAY_WEIGHT = (1.0, 1.0, 1.0, 1.0, 3.0, 3.2, 1.3)


def largest_remainder(total: int, weights: list[int]) -> list[int]:
    """Split total into integer parts proportional to weights, summing exactly."""
    weight_sum = sum(weights)
    raw = [total * w / weight_sum for w in weights]
    parts = [int(x) for x in raw]
    order = sorted(range(len(raw)), key=lambda i: (-(raw[i] - parts[i]), i))
    for i in order[: total - sum(parts)]:
        parts[i] += 1
    return parts


@dataclass(slots=True)
class Generator:
    """Holds the random source and every row produced so far."""

    rng: random.Random = field(default_factory=lambda: random.Random(SEED))
    rows: list[Row] = field(default_factory=list)
    used_refs: set[str] = field(default_factory=lambda: set(FLAGGED_REFS))
    occupancy: dict[tuple[int, date], bool] = field(default_factory=dict)
    window_names: list[tuple[str, str]] = field(default_factory=list)
    history_names: list[tuple[str, str]] = field(default_factory=list)

    def __post_init__(self) -> None:
        reserved = {g.window_name for g in REPEAT_GUESTS}
        combos = [f"{f} {lname}" for f in WINDOW_FIRST for lname in WINDOW_LAST]
        combos = [c for c in combos if c not in reserved]
        self.rng.shuffle(combos)
        self.window_names = [(c, self.rng.choice(CITIES)) for c in combos]
        hist = [f"{f} {lname}" for f in HISTORY_FIRST for lname in HISTORY_LAST]
        self.rng.shuffle(hist)
        self.history_names = [(c, self.rng.choice(CITIES)) for c in hist]

    # ---- identifiers -----------------------------------------------------

    def new_ref(self, channel: str) -> str:
        """A unique statement reference in the channel's own format."""
        prefix, digits = {
            "mmt": ("MM", 5),
            "bcom": ("BK", 5),
            "agoda": ("AG", 5),
            "ta": ("TA", 4),
            "walkin": ("HR", 4),
            "direct": ("HR", 4),
        }[channel]
        while True:
            ref = f"{prefix}{self.rng.randrange(10 ** (digits - 1), 10**digits)}"
            if ref not in self.used_refs:
                self.used_refs.add(ref)
                return ref

    def next_window_name(self) -> tuple[str, str]:
        """Next unused fictional guest name and city for the window."""
        return self.window_names.pop()

    # ---- rooms and dates -----------------------------------------------

    def pick_type(self, channel: str) -> str:
        """Room type, weighted by what this channel usually sells."""
        return self.rng.choices(TYPE_ORDER, weights=TYPE_WEIGHTS[channel])[0]

    def place(self, month: int, nights: int, room_type: str) -> tuple[date, int]:
        """Find a check-in date and free room of the type inside the month."""
        last_day = calendar.monthrange(WINDOW_YEAR, month)[1]
        days = list(range(1, last_day - nights + 2))
        weights = [WEEKDAY_WEIGHT[date(WINDOW_YEAR, month, d).weekday()] for d in days]
        candidates = [n for n, t in ROOMS if t == room_type]
        for _ in range(400):
            start = date(WINDOW_YEAR, month, self.rng.choices(days, weights=weights)[0])
            free = [r for r in candidates if self.room_free(r, start, nights)]
            if free:
                room = self.rng.choice(free)
                self.book_room(room, start, nights)
                return start, room
        raise GenerationError(f"no free {room_type} room in month {month}")

    def room_free(self, room: int, start: date, nights: int) -> bool:
        """True when the room has no stay on any of these nights."""
        return all((room, start + timedelta(days=i)) not in self.occupancy for i in range(nights))

    def book_room(self, room: int, start: date, nights: int) -> None:
        """Mark the room taken for each night of the stay."""
        for i in range(nights):
            self.occupancy[(room, start + timedelta(days=i))] = True


def nights_split(room_nights: int, stays: int, rng: random.Random) -> list[int]:
    """Nights per stay (1 to 3) summing to room_nights."""
    if not stays <= room_nights <= 3 * stays:
        raise GenerationError(f"cannot split {room_nights} nights over {stays} stays")
    nights = [1] * stays
    extra = room_nights - stays
    while extra:
        i = rng.randrange(stays)
        if nights[i] < 3:
            nights[i] += 1
            extra -= 1
    return nights


def channel_month_nights() -> dict[str, dict[int, int]]:
    """Room nights per channel per month with the monsoon dip (ruling 6)."""
    months = sorted(MONTH_ROOM_NIGHTS)
    weights = [MONTH_ROOM_NIGHTS[m] for m in months]
    return {
        spec.key: dict(zip(months, largest_remainder(spec.room_nights, weights), strict=True))
        for spec in CHANNELS
    }


def build_structure(gen: Generator) -> None:
    """Create stay and cancellation lines with dates, rooms and nights."""
    nights_by_month = channel_month_nights()
    repeats_by_bucket: dict[tuple[str, int], list[RepeatGuest]] = {}
    for guest in REPEAT_GUESTS:
        repeats_by_bucket.setdefault((guest.channel, guest.month), []).append(guest)
    for spec in FILES:
        month_nights = [nights_by_month[spec.channel][m] for m in spec.months]
        stays_split = largest_remainder(spec.stays, month_nights)
        canc_split = largest_remainder(spec.cancellations, month_nights)
        for month, rn, stays, cancels in zip(
            spec.months, month_nights, stays_split, canc_split, strict=True
        ):
            pinned = repeats_by_bucket.get((spec.channel, month), [])
            for guest in pinned:
                gen.rows.append(_pinned_row(gen, spec.filename, guest))
            rest_nights = rn - sum(g.nights for g in pinned)
            for nights in nights_split(rest_nights, stays - len(pinned), gen.rng):
                gen.rows.append(_stay_row(gen, spec.filename, spec.channel, month, nights))
            for _ in range(cancels):
                gen.rows.append(_cancel_row(gen, spec.filename, spec.channel, month))


def _stay_row(gen: Generator, filename: str, channel: str, month: int, nights: int) -> Row:
    room_type = gen.pick_type(channel)
    start, room = gen.place(month, nights, room_type)
    name, city = gen.next_window_name()
    return Row(filename, gen.new_ref(channel), channel, "stay", start, nights, room,
               name, city, room_type=room_type)  # fmt: skip


def _pinned_row(gen: Generator, filename: str, guest: RepeatGuest) -> Row:
    room_type = "Family Suite" if "family" in guest.window_name else "Deluxe Valley View"
    start, room = gen.place(guest.month, guest.nights, room_type)
    return Row(filename, gen.new_ref(guest.channel), guest.channel, "stay", start,
               guest.nights, room, guest.window_name, guest.city, pinned=True,
               room_type=room_type)  # fmt: skip


def _cancel_row(gen: Generator, filename: str, channel: str, month: int) -> Row:
    last_day = calendar.monthrange(WINDOW_YEAR, month)[1]
    start = date(WINDOW_YEAR, month, gen.rng.randint(1, last_day - 2))
    name, city = gen.next_window_name()
    return Row(filename, gen.new_ref(channel), channel, "cancelled", start,
               gen.rng.choice((1, 1, 2)), None, name, city)  # fmt: skip


# --------------------------------------------------------------------------
# Money: initial values, then exact balancing
# --------------------------------------------------------------------------


def initial_rates(gen: Generator, spec: ChannelSpec, rows: list[Row]) -> None:
    """Rate per night near the room type's rack rate, scaled to the channel ADR."""
    adr = spec.list_amount // spec.room_nights
    expected = sum(ROOM_TYPES[r.room_type] * r.nights for r in rows) / sum(r.nights for r in rows)
    factor = adr / expected
    for row in rows:
        season = {4: 1.0, 5: 1.06, 6: 1.06, 7: 0.9, 8: 0.9, 9: 1.0}[row.check_in.month]
        rate = ROOM_TYPES[row.room_type] * factor * season
        rate *= gen.rng.uniform(0.95, 1.05)
        row.list_amount = round(rate / 100) * 100 * row.nights


def balance_list(gen: Generator, spec: ChannelSpec, rows: list[Row]) -> None:
    """Move whole Rs 100 nightly steps until the channel list total is exact."""
    free = [r for r in rows if not r.pinned]
    diff = spec.list_amount - sum(r.list_amount for r in rows)
    if diff % 100:
        raise GenerationError(f"{spec.key}: list difference {diff} not in Rs 100 steps")
    singles = [r for r in free if r.nights == 1]
    while diff:
        step_sign = 1 if diff > 0 else -1
        row = gen.rng.choice(free)
        step = 100 * row.nights
        if abs(diff) < step:
            row = gen.rng.choice(singles)
            step = 100
        row.list_amount += step_sign * step
        diff -= step_sign * step


def initial_discounts(gen: Generator, spec: ChannelSpec, rows: list[Row]) -> None:
    """Hotel-funded promo per row, then exact total in small rupee steps."""
    free = [r for r in rows if not r.pinned]
    for row in free:
        promo = gen.rng.choice(PROMO_BPS.get(spec.key, (0,)))
        row.discount = rupee_bps(row.list_amount, promo)
    if spec.discount == 0:
        for row in free:
            row.discount = 0
        return
    diff = spec.discount - sum(r.discount for r in rows)
    while diff:
        row = gen.rng.choice(free)
        if diff > 0:
            step = min(diff, 40, row.list_amount // 4 - row.discount)
        else:
            step = -min(-diff, 40, row.discount)
        row.discount += step
        diff -= step


def solve_pinned(spec: ChannelSpec, row: Row, target: int) -> None:
    """Choose list and discount so commission + GST equals the planted target."""
    effective = spec.commission_bps / 10_000 * (1.18 if spec.gst_applies else 1)
    base_needed = target / effective
    for rate in range(3_500, 7_001, 100):
        list_amount = rate * row.nights
        for discount in range(int(list_amount * 0.08), int(list_amount * 0.2)):
            if abs(list_amount - discount - base_needed) > 10:
                continue
            row.list_amount, row.discount = list_amount, discount
            compute_lines(row, spec)
            if row.commission + row.gst == target:
                return
    raise GenerationError(f"no list/discount gives {target} for {row.guest_name}")


def cost(spec: ChannelSpec, rows: list[Row]) -> int:
    """Total absolute distance of commission, GST and fee sums from locked."""
    return (
        abs(spec.commission - sum(r.commission for r in rows))
        + abs(spec.gst - sum(r.gst for r in rows))
        + abs(spec.fees - sum(r.fees for r in rows))
    )


def balance_rounding(gen: Generator, spec: ChannelSpec, rows: list[Row]) -> None:
    """Swap rupees between rows (discount, or Rs 100 of list for fee-only
    channels) until rounded commission, GST and fee sums are exact."""
    free = [r for r in rows if not r.pinned and r.status == "stay"]
    for row in rows:
        compute_lines(row, spec)
    current = cost(spec, rows)
    steps = 0
    while current:
        steps += 1
        if steps > MAX_SEARCH_STEPS:
            raise GenerationError(f"{spec.key}: rounding search did not converge")
        a, b = gen.rng.sample(free, 2)
        if spec.discount:
            delta = gen.rng.randint(1, 5)
            if b.discount < delta or a.discount + delta > a.list_amount // 4:
                continue
            a.discount += delta
            b.discount -= delta
        else:
            delta = 100
            if a.nights != 1 or b.nights != 1 or b.list_amount <= 2_500:
                continue
            a.list_amount += delta
            b.list_amount -= delta
        compute_lines(a, spec)
        compute_lines(b, spec)
        new = cost(spec, rows)
        if new <= current:
            current = new
            continue
        if spec.discount:
            a.discount -= delta
            b.discount += delta
        else:
            a.list_amount -= delta
            b.list_amount += delta
        compute_lines(a, spec)
        compute_lines(b, spec)


def build_money(gen: Generator) -> None:
    """Fill money on every window row so all channel totals are exact."""
    pinned_targets = {g.window_name: g.paid_twice for g in REPEAT_GUESTS}
    for spec in CHANNELS:
        rows = [r for r in gen.rows if r.channel == spec.key]
        stays = [r for r in rows if r.status == "stay"]
        for row in stays:
            if row.pinned:
                solve_pinned(spec, row, pinned_targets[row.guest_name])
        initial_rates(gen, spec, [r for r in stays if not r.pinned])
        balance_list(gen, spec, stays)
        initial_discounts(gen, spec, stays)
        balance_rounding(gen, spec, rows)


# --------------------------------------------------------------------------
# Flagged rows (rule 3): built to fail their check
# --------------------------------------------------------------------------


def flagged_rows(gen: Generator) -> list[Row]:
    """MM48213 payout mismatch, BK55320 GST line missing, AG77102 commission
    on a cancelled stay."""
    mmt, bcom, agoda = (CHANNEL_BY_KEY[k] for k in ("mmt", "bcom", "agoda"))
    mm = _mm48213(gen, mmt)
    bk = Row("Booking.com payouts.xlsx", "BK55320", "bcom", "stay", date(2026, 6, 12), 1,
             None, "Ritesh Kalra", "Panipat", list_amount=4_400, discount=440)  # fmt: skip
    start, room = gen.place(6, 1, "Deluxe Valley View")
    bk.check_in, bk.room = start, room
    compute_lines(bk, bcom)
    hidden_gst = bk.gst
    bk.gst = 0
    bk.payout = bk.list_amount - bk.discount - bk.commission - hidden_gst - bk.tds
    ag = Row("Agoda statement.csv", "AG77102", "agoda", "cancelled", date(2026, 7, 18), 1,
             None, "Sonal Bedi", "Amritsar")  # fmt: skip
    ag.commission = bps_of(3_400_00, agoda.commission_bps) // 100
    ag.gst = gst_on_commission(ag.commission * 100) // 100
    ag.payout = -(ag.commission + ag.gst)
    return [mm, bk, ag]


def _mm48213(gen: Generator, mmt: ChannelSpec) -> Row:
    """A stay whose printed payout is Rs 120 short of list minus deductions."""
    row = Row("MakeMyTrip Apr to Jun.pdf", "MM48213", "mmt", "stay", date(2026, 5, 22), 1,
              None, "Gaurav Sehgal", "Rohtak")  # fmt: skip
    for list_amount in range(4_000, 6_001, 10):
        for discount in range(list_amount // 10, list_amount * 15 // 100):
            row.list_amount, row.discount = list_amount, discount
            compute_lines(row, mmt)
            if row.payout == 3_240:
                start, room = gen.place(5, 1, "Deluxe Valley View")
                row.check_in, row.room = start, room
                row.payout = 3_120
                return row
    raise GenerationError("cannot construct MM48213")


# --------------------------------------------------------------------------
# History (2025) and in-house today (October 2026, outside the window)
# --------------------------------------------------------------------------


def history_rows(gen: Generator) -> list[Row]:
    """Earlier stays: the 12 planted first stays plus unrelated past guests."""
    rows: list[Row] = []
    for guest in REPEAT_GUESTS:
        rows.append(_history_row(gen, guest.first_channel, guest.first_date,
                                 guest.first_name, guest.first_city or guest.city))  # fmt: skip
    start = date(2025, 4, 1)
    for _ in range(140):
        name, city = gen.history_names.pop()
        day = start + timedelta(days=gen.rng.randrange(365))
        channel = gen.rng.choice(("mmt", "mmt", "bcom", "agoda", "ta", "walkin", "direct"))
        rows.append(_history_row(gen, channel, day, name, city))
    return rows


def _history_row(gen: Generator, channel: str, day: date, name: str, city: str) -> Row:
    spec = CHANNEL_BY_KEY[channel]
    room_type = gen.pick_type(channel)
    nights = gen.rng.choice((1, 1, 2, 3))
    room = gen.rng.choice([n for n, t in ROOMS if t == room_type])
    row = Row(HISTORY_FILE, gen.new_ref(channel), channel, "stay", day, nights, room,
              name, city, room_type=room_type)  # fmt: skip
    row.list_amount = ROOM_TYPES[room_type] * nights
    promo = gen.rng.choice(PROMO_BPS.get(channel, (0,)))
    row.discount = bps_of(row.list_amount * 100, promo) // 100
    compute_lines(row, spec)
    return row


@dataclass(frozen=True, slots=True)
class TodayGuest:
    """An in-house stay on the demo date. desk=True for the three Desk guests."""

    name: str
    short: str
    city: str
    channel: str
    room: int
    nights: int
    list_amount: int
    discount: int
    desk: bool
    code: str


TODAY_GUESTS: tuple[TodayGuest, ...] = (
    TodayGuest("Neha Gupta", "Neha ji", "Gurugram", "bcom", 104, 1, 4_000, 600, True,
               "DEODAR-NG26"),
    TodayGuest("Rahul Sharma", "Rahul ji", "Delhi", "mmt", 207, 1, 6_200, 744, True,
               "DEODAR-RS26"),
    TodayGuest("Arjun Mehta", "Arjun ji", "Ludhiana", "walkin", 112, 1, 3_400, 0, True,
               "DEODAR-AM26"),
    TodayGuest("Kritika Anand", "Kritika ji", "Delhi", "mmt", 101, 1, 4_300, 516, False, ""),
    TodayGuest("Mohan Lal Dua", "Mohan ji", "Ambala", "mmt", 102, 1, 4_300, 516, False, ""),
    TodayGuest("Shalini Vats", "Shalini ji", "Noida", "mmt", 103, 1, 4_300, 0, False, ""),
    TodayGuest("Tejas Nanda", "Tejas ji", "Pune", "mmt", 105, 1, 4_200, 0, False, ""),
    TodayGuest("Ira Bhalla", "Ira ji", "Gurugram", "bcom", 106, 1, 4_400, 440, False, ""),
    TodayGuest("Naveen Arya", "Naveen ji", "Meerut", "agoda", 201, 1, 3_400, 0, False, ""),
    TodayGuest("Ruchi Dhingra", "Ruchi ji", "Jaipur", "ta", 202, 1, 3_800, 0, False, ""),
    TodayGuest("Sunil Kaushik", "Sunil ji", "Dehradun", "bcom", 107, 1, 4_300, 0, False, ""),
    TodayGuest("Alka Pruthi", "Alka ji", "Delhi", "direct", 108, 1, 4_300, 0, False, ""),
    TodayGuest("Varun Chadha", "Varun ji", "Chandigarh", "direct", 110, 1, 4_500, 0, False, ""),
    TodayGuest("Geeta Mann", "Geeta ji", "Kanpur", "direct", 109, 1, 3_400, 0, False, ""),
)  # fmt: skip


def today_rows() -> list[Row]:
    """In-house stays on the demo date. check_in is a placeholder; the loader
    replaces it with DEMO_DATE (default: the day the seed is loaded)."""
    rows: list[Row] = []
    for i, guest in enumerate(TODAY_GUESTS):
        spec = CHANNEL_BY_KEY[guest.channel]
        prefix = {"mmt": "MM", "bcom": "BK", "agoda": "AG", "ta": "TA"}.get(guest.channel, "HR")
        row = Row("In-house today (sample)", f"{prefix}9{i:04d}", guest.channel, "stay",
                  date(2026, 10, 1), guest.nights, guest.room, guest.name, guest.city,
                  list_amount=guest.list_amount, discount=guest.discount)  # fmt: skip
        compute_lines(row, spec)
        rows.append(row)
    return rows


# --------------------------------------------------------------------------
# Verification and output
# --------------------------------------------------------------------------


def verify_window(rows: list[Row]) -> None:
    """Refuse to continue unless every locked total is exact."""
    passing = [r for r in rows if r.ref not in FLAGGED_REFS]
    if len(rows) != 1_500 or len(passing) != 1_497:
        raise GenerationError(f"expected 1,500 rows / 1,497 passing, got {len(rows)}")
    for name, expected in FILE_ROW_COUNTS.items():
        actual = sum(1 for r in rows if r.file == name)
        if actual != expected:
            raise GenerationError(f"{name}: {actual} rows, expected {expected}")
    for spec in CHANNELS:
        mine = [r for r in passing if r.channel == spec.key]
        totals = (
            sum(r.nights for r in mine if r.status == "stay"),
            sum(r.list_amount for r in mine),
            sum(r.discount for r in mine),
            sum(r.commission for r in mine),
            sum(r.gst for r in mine),
            sum(r.fees for r in mine),
        )
        expected_t = (spec.room_nights, spec.list_amount, spec.discount, spec.commission,
                      spec.gst, spec.fees)  # fmt: skip
        if totals != expected_t:
            raise GenerationError(f"{spec.key}: {totals} != {expected_t}")
    repeat_total = sum(r.commission + r.gst for r in passing if r.pinned)
    if repeat_total != REPEAT_PAID_TWICE_TOTAL:
        raise GenerationError(f"repeat total {repeat_total} != {REPEAT_PAID_TWICE_TOTAL}")


ROW_FIELDS = ("file", "external_ref", "channel", "status", "check_in", "nights", "room",
              "guest_name", "guest_city", "list_amount", "discount", "commission", "gst",
              "fees", "tds", "tcs", "payout")  # fmt: skip


def write_rows(path: Path, rows: list[Row]) -> None:
    """Write rows as CSV in whole rupees."""
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(ROW_FIELDS)
        for r in rows:
            writer.writerow((r.file, r.ref, r.channel, r.status, r.check_in.isoformat(),
                             r.nights, r.room or "", r.guest_name, r.guest_city,
                             r.list_amount, r.discount, r.commission, r.gst, r.fees,
                             r.tds, r.tcs, r.payout))  # fmt: skip


def write_repeat_key(path: Path, window: list[Row], history: list[Row]) -> None:
    """Answer key for matcher tests: which window row repeats which 2025 stay."""
    by_name = {r.guest_name: r for r in window if r.pinned}
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(("window_ref", "history_ref", "paid_twice"))
        for guest, first in zip(REPEAT_GUESTS, history, strict=False):
            row = by_name[guest.window_name]
            writer.writerow((row.ref, first.ref, row.commission + row.gst))


def write_today(path: Path, rows: list[Row]) -> None:
    """Today's in-house stays with Desk flags and perk codes."""
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow((*ROW_FIELDS, "short_name", "desk", "perk_code"))
        for r, guest in zip(rows, TODAY_GUESTS, strict=True):
            writer.writerow((r.file, r.ref, r.channel, r.status, "", r.nights, r.room,
                             r.guest_name, r.guest_city, r.list_amount, r.discount,
                             r.commission, r.gst, r.fees, r.tds, r.tcs, r.payout,
                             guest.short, int(guest.desk), guest.code))  # fmt: skip


def generate(out_dir: Path = DATA_DIR) -> dict[str, int]:
    """Build every sample row, verify the locked totals, write the CSVs."""
    gen = Generator()
    build_structure(gen)
    build_money(gen)
    window = gen.rows + flagged_rows(gen)
    verify_window(window)
    window.sort(key=lambda r: (r.file, r.check_in, r.ref))
    history = history_rows(gen)
    today = today_rows()
    out_dir.mkdir(parents=True, exist_ok=True)
    write_rows(out_dir / "window_rows.csv", window)
    write_rows(out_dir / "history_rows.csv", history)
    write_today(out_dir / "today_rows.csv", today)
    write_repeat_key(out_dir / "repeat_key.csv", window, history)
    return {"window": len(window), "history": len(history), "today": len(today)}


if __name__ == "__main__":
    print(generate())  # noqa: T201
