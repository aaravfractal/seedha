"""Eight sample guest inbox threads for the sample hotel (POLISH_BUILD B).

Each thread belongs to a guest who said yes at the Desk on one of the earlier
one-night desk stays (seed/closes.py), so rule 4 holds: the WhatsApp number
lives only on a Desk consent record, never on an OTA row. The consents are
salted and fingerprinted like the real flow, flagged `seeded` (so the 8-step
demo's Desk step stays open) and sealed in one past local proof bundle (so
the Proof screen has nothing pending). No perk codes, approvals or savings
are created, so the demo loop and every locked number stay as they were.

Names, numbers and messages are fictional sample data (rule 11). Messages are
dated relative to `now`, so the unread ones are a few hours old and the
WhatsApp 24-hour reply window is open in the demo.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Booking, Consent, GuestMemory, InboxMessage, Property
from app.services.drafter import STOP_LINE
from app.services.inbox import add_seeded_consent, seeded_number
from app.services.proof import LocalOnly, write_bundle

CONSENT_UTC = time(13, 30)  # 19:00 IST, the evening of the stay
READ_AFTER = timedelta(minutes=12)
SEAL_AFTER = timedelta(hours=4)
MARGIN = timedelta(hours=1)


@dataclass(frozen=True, slots=True)
class Line:
    """One message, `hours` before the anchor time."""

    hours: float
    who: Literal["guest", "owner"]
    body: str


@dataclass(frozen=True, slots=True)
class SeedThread:
    """A sample thread on the close stay `CL{offset}{room}`."""

    offset: int
    room: int
    unread: bool
    lines: tuple[Line, ...]
    preferences: tuple[str, ...]
    notes: tuple[str, ...] = ()


THREADS: tuple[SeedThread, ...] = (
    SeedThread(3, 108, True, (
        Line(20, "guest", "Thank you for the lovely stay. The view from the balcony was "
             "beautiful in the morning."),
        Line(19.5, "owner", "Thank you Farhan ji, it was a pleasure to host you. Have a safe "
             "drive home."),
        Line(3, "guest", "Hello, could you send the invoice for my stay? I need it for my "
             "office reimbursement."),
    ), ("Prefers a mountain-view room", "Usually arrives late in the evening"),
        ("Travels for work, mostly on weekdays",)),
    SeedThread(3, 101, False, (
        Line(9, "guest", "Namaste! Hum next Saturday phir aa rahe hain. Kya Sunday ko late "
             "checkout mil sakta hai? Do baje tak?"),
        Line(8.5, "owner", "Namaste Yamini ji, a late checkout on Sunday should be possible. "
             "I will confirm the day before once I see the arrivals."),
    ), ("Likes a late checkout on Sundays", "Vegetarian meals")),
    SeedThread(4, 101, False, (
        Line(5, "guest", "Hi, we are driving up again on Friday and should reach by nine in "
             "the morning. Is early check-in possible? We have a small child with us."),
    ), ("Travels with a small child", "Asks for an extra pillow")),
    SeedThread(4, 201, True, (
        Line(2, "guest", "नमस्ते, हम अगले महीने दो परिवार आ रहे हैं, दो गाड़ियाँ होंगी। क्या "
             "होटल में दोनों गाड़ियों के लिए पार्किंग मिल जाएगी?"),
    ), ("Comes with family in two cars", "Prefers rooms on the ground floor")),
    SeedThread(3, 201, True, (
        Line(1.2, "guest", "Hi! Diwali pe family ke saath aana hai, do rooms chahiye teen "
             "raaton ke liye. Kya rooms available hain? Last time wala valley view mil jaye "
             "toh best."),
    ), ("Prefers the valley-view rooms", "Visits around Diwali"),
        ("Asked about a family trip during the festival week",)),
    SeedThread(3, 204, False, (
        Line(18, "guest", "Hi, small feedback from my stay: the Wi-Fi was not working in room "
             "204 most of the evening. I had to use my phone hotspot for a work call."),
        Line(17, "owner", "Sorry about that, Nikhil ji. The router near room 204 was faulty and "
             "we have replaced it today. Thank you for telling us."),
        Line(16, "guest", "Great, thanks for fixing it so quickly."),
        Line(15.5, "owner", "Thank you Nikhil ji. Hope to see you again soon."),
    ), ("Works remotely and needs good Wi-Fi", "Likes a quiet room away from the road")),
    SeedThread(5, 107, False, (
        Line(22, "guest", "नमस्ते जी, मैंने अपनी बुकिंग की दूसरी रात रद्द की थी। उस रात का "
             "रिफंड कब तक आएगा?"),
        Line(21, "owner", "नमस्ते तरुण जी, आपका रिफंड शुरू कर दिया गया है। बैंक में आने में "
             "तीन से पाँच कामकाजी दिन लग सकते हैं।"),
        Line(6, "guest", "ठीक है, धन्यवाद। आ जाए तो मैं बता दूँगा।"),
    ), ("Prefers Hindi on WhatsApp", "Early riser, likes tea at six")),
    SeedThread(6, 209, True, (
        Line(12, "guest", "Namaste ji, hum Dehradun station se aa rahe hain aur bags kaafi "
             "hain. Cab ka best route kaunsa hai?"),
        Line(11.5, "owner", "Namaste Lalit ji, take a cab up the Mussoorie road and ask for "
             "Mall Road. Tell us your time and our staff will help with the bags."),
        Line(0.5, "guest", "Thik hai, kal subah das baje tak pahunch jayenge. Bags ke liye koi "
             "staff mil jayega?"),
    ), ("Travels with a dog", "Arrives by train at Dehradun")),
)  # fmt: skip


def _given_at(stay: Booking) -> datetime:
    """The evening of the stay, when the guest said yes at the Desk."""
    return datetime.combine(stay.check_in, CONSENT_UTC, UTC)


def _anchor(stays: list[Booking], now: datetime) -> datetime:
    """`now`, moved later if needed so every message follows its consent."""
    latest = max(
        _given_at(stay) + timedelta(hours=max(line.hours for line in thread.lines)) + MARGIN
        for stay, thread in zip(stays, THREADS, strict=True)
    )
    return max(now, latest)


def _stay(session: Session, prop: Property, thread: SeedThread, demo_date: date) -> Booking:
    """The earlier Desk close this thread's guest stayed on."""
    ref = f"CL{thread.offset}{thread.room}"
    stay = session.scalar(
        select(Booking).where(Booking.property_id == prop.id, Booking.external_ref == ref)
    )
    if stay is None or stay.check_in != demo_date - timedelta(days=thread.offset):
        raise LookupError(f"sample close stay {ref} missing")
    return stay


def _messages(session: Session, consent: Consent, thread: SeedThread, anchor: datetime) -> None:
    """The thread's texts. Owner replies carry the STOP line like every send."""
    last_guest = max(i for i, line in enumerate(thread.lines) if line.who == "guest")
    for i, line in enumerate(thread.lines):
        at = anchor - timedelta(hours=line.hours)
        if line.who == "owner":
            row = InboxMessage(consent_id=consent.id, direction="out",
                               body=f"{line.body} {STOP_LINE}", created_at=at,
                               sent_by="owner", transport="simulated")  # fmt: skip
        else:
            unread = thread.unread and i == last_guest
            row = InboxMessage(consent_id=consent.id, direction="in", body=line.body,
                               created_at=at, sent_by="guest", transport="whatsapp",
                               read_at=None if unread else at + READ_AFTER)  # fmt: skip
        session.add(row)


def load_inbox_threads(
    session: Session, prop: Property, demo_date: date, now: datetime
) -> list[Consent]:
    """Seed the eight sample threads; returns their consents (all sealed)."""
    stays = [_stay(session, prop, thread, demo_date) for thread in THREADS]
    anchor = _anchor(stays, now)
    consents: list[Consent] = []
    for index, (stay, thread) in enumerate(zip(stays, THREADS, strict=True)):
        consent = add_seeded_consent(session, stay, seeded_number(index), _given_at(stay))
        consents.append(consent)
        _messages(session, consent, thread, anchor)
        for text in thread.preferences:
            session.add(GuestMemory(guest_id=consent.guest_id, kind="preference", text=text,
                                    created_at=consent.given_at))  # fmt: skip
        for text in thread.notes:
            session.add(GuestMemory(guest_id=consent.guest_id, kind="note", text=text,
                                    created_at=consent.given_at))  # fmt: skip
    session.flush()
    sealed_at = max(c.given_at for c in consents) + SEAL_AFTER
    write_bundle(session, prop.id, LocalOnly(), sealed_at)
    return consents
