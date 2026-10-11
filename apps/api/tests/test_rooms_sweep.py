"""Room board sweep (POLISH_BUILD T1): every sold room on every board night.

Money equals the stored booking row, guests appear as initials only (no name
or WhatsApp number anywhere), the consent id follows the active consent, the
direct illustration is ruling 5, and the slip reprint has no side effects.
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import date
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    Booking,
    Consent,
    DeskCommand,
    Guest,
    InboxMessage,
    Message,
    PerkCode,
    Property,
    Saving,
    StayInvoice,
)
from app.services.consent import active_consent
from app.services.desk import in_house
from app.services.overview import owner_initials
from app.services.rooms import contract_terms
from app.services.savings import compute_saving
from app.services.slips import COMMISSION_FREE_KINDS
from seed.load import load_sample
from tests.conftest import DEMO_DATE, DEVICE_KEY

MONEY = ("list_amount", "discount", "commission", "gst_on_commission", "fees", "net_kept")


@pytest.fixture(name="inbox")
def fixture_inbox(session: Session) -> Session:
    """The sample hotel with statements and the eight seeded inbox threads."""
    load_sample(session, DEMO_DATE, with_statements=True, device_key=DEVICE_KEY, with_inbox=True)
    session.commit()
    return session


def sold_rooms(client: TestClient, owner: dict[str, str]) -> Iterator[tuple[str, int]]:
    """(night, room) for every sold tile on the board."""
    body = client.get("/rooms/nights", headers=owner).json()
    assert len(body["nights"]) == 7
    for night in body["nights"]:
        assert sum(1 for t in night["tiles"] if t["sold"]) == night["rooms_sold"]
        for tile in night["tiles"]:
            if tile["sold"]:
                yield night["night"], int(tile["room"])


def stored_stay(session: Session, night: str, room: int) -> Booking:
    prop = session.scalars(select(Property)).one()
    stays = [
        s.booking
        for s in in_house(session, prop.id, date.fromisoformat(night))
        if s.room is not None and s.room.number == room
    ]
    assert len(stays) == 1, (night, room)
    return stays[0]


def private_strings(session: Session) -> list[str]:
    """Every guest name and WhatsApp number the database holds."""
    names = [g.display_name for g in session.scalars(select(Guest))]
    short = [g.short_name for g in session.scalars(select(Guest)) if len(g.short_name) >= 4]
    numbers: list[str] = []
    for c in session.scalars(select(Consent).where(Consent.whatsapp_number.is_not(None))):
        number = str(c.whatsapp_number)
        numbers += [number, number[-10:]]
    return names + short + numbers


def expected_if_direct(session: Session, row: Booking) -> dict[str, Any] | None:
    """Ruling 5 on the stay's own contract; None for walk-in and direct."""
    if row.channel.kind in COMMISSION_FREE_KINDS:
        return None
    bps, gst = contract_terms(session, row.channel_id)
    saving = compute_saving(row.list_amount - row.discount, bps, gst)
    assert saving is not None
    return {
        "extra_kept": saving.net_saving,
        "commission_avoided": saving.commission_avoided,
        "gst_avoided": saving.gst_avoided,
        "upi_fee": saving.upi_fee,
        "commission_rate_bps": saving.commission_rate_used,
        "label": "Illustration",
    }


def test_every_sold_room_on_every_night_is_the_stored_row(
    client: TestClient, owner: dict[str, str], inbox: Session
) -> None:
    seen = 0
    consented = 0
    for night, room in sold_rooms(client, owner):
        res = client.get(f"/rooms/{night}/{room}", headers=owner)
        assert res.status_code == 200, (night, room, res.text)
        body: dict[str, Any] = res.json()
        row = stored_stay(inbox, night, room)
        assert (body["booking_id"], body["night"], body["room"]) == (row.id, night, room)
        for field in (*MONEY, "nights"):
            assert body[field] == getattr(row, field), (night, room, field)
        assert body["channel_key"] == row.channel.key
        assert body["checked_out"] is (row.checked_out_at is not None)
        assert row.guest is not None
        assert body["guest_initials"] == owner_initials(row.guest.display_name)
        active = active_consent(inbox, row.guest.id)
        assert body["consent_id"] == (active.id if active is not None else None)
        assert body["consent_status"] == (
            "consented_at_desk" if active is not None else "not_consented"
        )
        consented += active is not None
        assert body["if_direct"] == expected_if_direct(inbox, row)
        seen += 1
    nights_total = sum(
        n["rooms_sold"] for n in client.get("/rooms/nights", headers=owner).json()["nights"]
    )
    assert seen == nights_total > 90
    assert consented == 8, "the eight seeded Desk consents sit on board nights"


def test_no_name_or_number_anywhere_in_rooms_json(
    client: TestClient, owner: dict[str, str], inbox: Session
) -> None:
    secrets_ = private_strings(inbox)
    assert any(s.startswith("+91") for s in secrets_)
    pages = [client.get("/rooms/nights", headers=owner).text]
    for night, room in sold_rooms(client, owner):
        pages.append(client.get(f"/rooms/{night}/{room}", headers=owner).text)
    for page in pages:
        for secret in secrets_:
            assert secret not in page, secret
    for night, room in list(sold_rooms(client, owner))[:20]:
        slip = client.post(f"/rooms/{night}/{room}/slip", headers=owner).text
        for secret in secrets_:
            assert secret not in slip, secret


def test_consent_id_disappears_after_stop_and_after_forget(
    client: TestClient, owner: dict[str, str], inbox: Session
) -> None:
    seeded = inbox.scalars(select(Consent).order_by(Consent.id)).all()
    stopped, forgotten = seeded[0], seeded[1]
    spots = {}
    for c in (stopped, forgotten):
        stay = c.booking
        assert stay.room is not None
        spots[c.id] = (stay.check_in.isoformat(), stay.room.number)
        body = client.get(f"/rooms/{spots[c.id][0]}/{spots[c.id][1]}", headers=owner).json()
        assert body["consent_id"] == c.id
    res = client.post(f"/inbox/threads/{stopped.id}/simulate", headers=owner, json={"text": "STOP"})
    assert res.status_code == 200
    res = client.post(f"/inbox/threads/{forgotten.id}/forget", headers=owner,
                      json={"confirm": True})  # fmt: skip
    assert res.status_code == 200
    for cid, (night, room) in spots.items():
        body = client.get(f"/rooms/{night}/{room}", headers=owner).json()
        assert (body["consent_status"], body["consent_id"]) == ("not_consented", None), cid


def side_effect_counts(session: Session) -> tuple[int, ...]:
    session.expire_all()
    models: tuple[type[Any], ...] = (PerkCode, Message, InboxMessage, Consent, Saving,
                                     StayInvoice)  # fmt: skip
    counts = [int(session.scalar(select(func.count()).select_from(m)) or 0) for m in models]
    counts.append(
        int(session.scalar(select(func.count()).where(Booking.checked_out_at.is_not(None))) or 0)
    )
    return tuple(counts)


def test_slip_on_every_room_has_no_side_effects(
    client: TestClient, owner: dict[str, str], inbox: Session
) -> None:
    before = side_effect_counts(inbox)
    commands = int(inbox.scalar(select(func.count()).select_from(DeskCommand)) or 0)
    rooms = list(sold_rooms(client, owner))
    for night, room in rooms:
        res = client.post(f"/rooms/{night}/{room}/slip", headers=owner)
        assert res.status_code == 200, (night, room)
        lines = {line["label"]: line["amount"] for line in res.json()["lines"]}
        row = stored_stay(inbox, night, room)
        assert row.net_kept in lines.values(), (night, room)
        if row.channel.kind in COMMISSION_FREE_KINDS:
            assert "Commission" not in lines
    assert side_effect_counts(inbox) == before
    inbox.expire_all()
    after = int(inbox.scalar(select(func.count()).select_from(DeskCommand)) or 0)
    assert after == commands + 3 * len(rooms)


@pytest.mark.parametrize("method", ["GET", "POST"])
def test_demo_session_on_a_real_hotel_is_refused(
    client: TestClient, owner: dict[str, str], inbox: Session, method: str
) -> None:
    inbox.scalars(select(Property)).one().is_sample = False
    inbox.commit()
    demo = {**owner, "X-Seedha-Subject": "demo"}
    night = DEMO_DATE.isoformat()
    path = f"/rooms/{night}/104" + ("/slip" if method == "POST" else "")
    assert client.request(method, path, headers=demo).status_code == 403
    assert client.get("/rooms/nights", headers=demo).status_code == 403
