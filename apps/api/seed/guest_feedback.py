"""Two sample card-page feedbacks for the sample hotel (D-106), seeded with
the inbox threads (demo and reset).

* CL2105: verified, no consent, so no number is stored.
* CL3201: verified, consent ticked, with the fictional number the sample
  inbox thread already holds (+91 90000 00105, a Desk consent).

CL2101 and CL3108 stay unrated so anyone can try the card page with them.

Both are fictional and labelled sample data (rule 11). Each verified stay
gives one public 'card' rating, so the hotel has 2: below 3, the site still
says it has no ratings yet. No codes are made: the owner approves rewards.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Booking, Consent, GuestFeedback, Property
from app.services.guest_feedback import WORDING_VERSION, give_rating

SAMPLE_REVIEWS = {
    "CL2105": (4, 4, "Sample feedback: quiet room and warm staff. Breakfast could start earlier."),
    "CL3201": (5, 5, "Sample feedback: the balcony view in the morning was beautiful."),
}


def load_sample_feedback(session: Session, prop: Property, now: datetime) -> None:
    """Seed the two sample feedbacks and their ratings, a few hours old."""
    for hours, (ref, (overall, food, review)) in enumerate(SAMPLE_REVIEWS.items(), start=2):
        stay = session.scalars(
            select(Booking).where(Booking.property_id == prop.id, Booking.external_ref == ref)
        ).one()
        number = session.scalar(
            select(Consent.whatsapp_number).where(Consent.booking_id == stay.id)
        )
        at = now - timedelta(hours=hours)
        session.add(
            GuestFeedback(
                property_id=prop.id, booking_id=stay.id, verified=True,
                name=stay.guest_name[:60], phone=number,
                consent_at=at if number else None,
                consent_wording_version=WORDING_VERSION if number else None,
                overall=overall, food=food, review=review, reward="breakfast", status="new",
                created_at=at,
            )
        )  # fmt: skip
        give_rating(session, stay, overall, review, at)
    session.flush()
