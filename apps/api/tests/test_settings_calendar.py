"""Settings tabs and the Pulse calendar (P6b): owner-only, read-only demo,
validation per the handoff regexes, GSTIN and PAN never logged, contracts
from the ledger, and plan entries."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Booking, OwnerAccount, OwnerSettings, PlanEntry, Property, StaffInvite
from app.services.calendar import EVENTS
from app.services.ledger import load_ledger
from app.services.scenario import saturday_move
from app.services.settings import SettingsError, clean_business

GSTIN = "05AAACH1234K1Z2"
PAN = "AAACH1234K"


def _account(session: Session, phone: str = "9876543210") -> str:
    now = datetime(2026, 10, 10, 9, 0, tzinfo=UTC)
    account = OwnerAccount(name="Meera Rawat", hotel_name="Pine Crest", phone=phone,
                           terms_accepted_at=now, created_at=now, verified_at=now)  # fmt: skip
    session.add(account)
    session.commit()
    return f"a{account.id}"


@pytest.fixture(name="demo")
def fixture_demo(owner: dict[str, str]) -> dict[str, str]:
    return owner | {"X-Seedha-Subject": "demo"}


@pytest.fixture(name="acct")
def fixture_acct(owner: dict[str, str], sample: Session) -> dict[str, str]:
    return owner | {"X-Seedha-Subject": _account(sample)}


def _details(**extra: Any) -> dict[str, Any]:
    return {"name": "Meera Rawat", "email": "meera@pinecrest.example",
            "business_name": "Pine Crest Homestay", "gstin": GSTIN, "pan": PAN,
            "address": "Camel's Back Road, Mussoorie", "pin": "248179"} | extra  # fmt: skip


# --- validation (pure) ----------------------------------------------------------


def test_clean_business_accepts_valid_and_optional_fields() -> None:
    out = clean_business(email=None, business_name=" Pine  Crest ", gstin=" 05aaach1234k1z2",
                         pan="aaach1234k", address=None, pin="248179")  # fmt: skip
    assert out.gstin == GSTIN
    assert out.pan == PAN
    assert out.business_name == "Pine Crest"
    empty = clean_business(email="", business_name="", gstin="", pan="", address="", pin="")
    assert empty.gstin is None and empty.pan is None and empty.pin is None


@pytest.mark.parametrize(
    ("field", "value", "code"),
    [
        ("gstin", "05AAACH1234K1X2", "invalid_gstin"),  # 14th character must be Z
        ("gstin", "5AAACH1234K1Z2", "invalid_gstin"),
        ("pan", "AAAC1234K", "invalid_pan"),
        ("pan", "1AACH1234K", "invalid_pan"),
        ("pin", "24817", "invalid_pin"),
        ("pin", "24817a", "invalid_pin"),
        ("email", "not-an-email", "invalid_email"),
    ],
)
def test_clean_business_rejects(field: str, value: str, code: str) -> None:
    fields: dict[str, str | None] = dict.fromkeys(
        ("email", "business_name", "gstin", "pan", "address", "pin")
    )
    fields[field] = value
    with pytest.raises(SettingsError) as err:
        clean_business(**fields)
    assert err.value.code == code
    assert value not in err.value.message


OTHER_PAN = "ABCDE1234F"  # pragma: allowlist secret (fictional)


def test_pan_must_match_the_pan_inside_the_gstin() -> None:
    with pytest.raises(SettingsError) as err:
        clean_business(email=None, business_name=None, gstin=GSTIN, pan=OTHER_PAN,
                       address=None, pin=None)  # fmt: skip
    assert err.value.code == "pan_gstin_mismatch"


# --- settings routes ------------------------------------------------------------


@pytest.mark.usefixtures("sample")
def test_demo_sees_sample_values_read_only(client: TestClient, demo: dict[str, str]) -> None:
    res = client.get("/settings", headers=demo)
    assert res.status_code == 200
    body = res.json()
    assert body["kind"] == "demo"
    assert body["read_only"] is True
    assert body["personal"]["sample"] is True
    assert body["hotel"] == {"name": "Hotel Deodar View", "town": "Mussoorie",
                             "address": body["hotel"]["address"], "rooms": 22,
                             "is_sample": True}  # fmt: skip
    assert body["security"]["two_step"] == "planned"
    assert body["security"]["idle_minutes"] == 30
    assert body["notifications"] == {"morning_line": True, "close_slip": True, "approvals": True}


def test_demo_cannot_write_personal_staff_or_delete(
    client: TestClient, demo: dict[str, str], sample: Session
) -> None:
    accounts_before = sample.scalar(select(func.count(OwnerAccount.id)))
    assert client.patch("/settings/personal", headers=demo, json=_details()).status_code == 403
    staff = {"name": "Pooja", "role": "front_desk", "mobile": "9811111111"}
    assert client.post("/settings/staff", headers=demo, json=staff).status_code == 403
    assert client.delete("/settings/staff/1", headers=demo).status_code == 403
    res = client.request("DELETE", "/settings/account", headers=demo, json={"confirm": True})
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "demo_read_only"
    sample.expire_all()
    assert sample.scalar(select(func.count(OwnerSettings.id))) == 0
    assert sample.scalar(select(func.count(OwnerAccount.id))) == accounts_before
    listed = client.get("/settings/staff", headers=demo).json()
    assert listed["read_only"] is True
    assert [s["name"] for s in listed["staff"]] == ["Pooja"]
    assert listed["staff"][0]["status"] == "sample"


def test_account_saves_details_and_gstin_is_never_logged(
    client: TestClient, acct: dict[str, str], caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.DEBUG)
    res = client.patch("/settings/personal", headers=acct, json=_details())
    assert res.status_code == 200, res.text
    personal = res.json()["personal"]
    assert personal["gstin"] == GSTIN and personal["pan"] == PAN
    assert personal["sample"] is False
    assert personal["mobile"].startswith("+91 ")
    bad = client.patch("/settings/personal", headers=acct, json=_details(gstin="05AAACH1234K1X2"))
    assert bad.status_code == 422
    assert bad.json()["error"]["code"] == "invalid_gstin"
    assert "05AAACH1234K1X2" not in bad.text
    for record in caplog.records:
        text = record.getMessage()
        assert GSTIN not in text and PAN not in text and "05AAACH1234K1X2" not in text
    cleared = client.patch("/settings/personal", headers=acct, json=_details(gstin="", pan=""))
    assert cleared.json()["personal"]["gstin"] is None


def test_notifications_are_stored_per_subject(
    client: TestClient, acct: dict[str, str], demo: dict[str, str]
) -> None:
    res = client.patch("/settings/notifications", headers=acct, json={"close_slip": False})
    assert res.json() == {"morning_line": True, "close_slip": False, "approvals": True}
    assert client.get("/settings", headers=acct).json()["notifications"]["close_slip"] is False
    assert client.get("/settings", headers=demo).json()["notifications"]["close_slip"] is True
    demo_res = client.patch("/settings/notifications", headers=demo, json={"approvals": False})
    assert demo_res.status_code == 200
    assert demo_res.json()["approvals"] is False


def test_staff_invites_are_records_with_validation(
    client: TestClient, acct: dict[str, str], sample: Session
) -> None:
    assert client.get("/settings/staff", headers=acct).json()["staff"] == []

    def invite(name: str, role: str, mobile: str) -> Any:
        return client.post("/settings/staff", headers=acct,
                           json={"name": name, "role": role, "mobile": mobile})  # fmt: skip

    bad = invite("Pooja", "front_desk", "5811111111")
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "invalid_mobile"
    role = invite("Pooja", "owner", "9811111111")
    assert role.json()["error"]["code"] == "invalid_role"
    ok = invite("Pooja Negi", "front_desk", "+91 98111 11111")
    assert ok.status_code == 200
    staff = ok.json()["staff"]
    assert len(staff) == 1 and staff[0]["status"] == "invited"
    assert "11111" not in staff[0]["mobile"].replace(" ", "")[:-3]
    dup = invite("Pooja N", "front_desk", "9811111111")
    assert dup.status_code == 409
    removed = client.delete(f"/settings/staff/{staff[0]['id']}", headers=acct)
    assert removed.json()["staff"] == []
    assert client.delete("/settings/staff/999", headers=acct).status_code == 404
    sample.expire_all()
    assert sample.scalar(select(func.count(StaffInvite.id))) == 0


def test_contracts_compare_contract_and_statements(
    client: TestClient, demo: dict[str, str], sample: Session
) -> None:
    body = client.get("/settings/contracts", headers=demo).json()
    rows = {c["key"]: c for c in body["channels"]}
    assert body["start"] == "2026-04-01" and body["end"] == "2026-09-30"
    ota = [c for c in body["channels"] if c["kind"] == "ota"]
    assert ota and all(c["contracted_bps"] is not None for c in ota)
    assert all(c["effective_bps"] is not None and c["stays"] > 0 for c in ota)
    # The effective rate is commission over (list minus discount) on counted stays.
    key = ota[0]["key"]
    bookings = sample.scalars(select(Booking).join(Booking.channel)).all()
    counted = [b for b in bookings if b.channel.key == key and b.status == "stay"
               and (b.math_check_passed or b.review_status == "accepted")
               and "2026-04-01" <= b.check_in.isoformat() <= "2026-09-30"]  # fmt: skip
    base = sum(b.list_amount - b.discount for b in counted)
    commission = sum(b.commission for b in counted)
    assert rows[key]["effective_bps"] == round(commission * 10_000 / base)
    assert rows[key]["stays"] == len(counted)


def test_export_and_delete_account_keeps_hotel_data(
    client: TestClient, acct: dict[str, str], sample: Session
) -> None:
    client.patch("/settings/personal", headers=acct, json=_details())
    client.post("/settings/staff", headers=acct,
                json={"name": "Pooja", "role": "front_desk", "mobile": "9811111111"})  # fmt: skip
    export = client.get("/settings/export", headers=acct).json()
    assert export["kind"] == "owner"
    assert export["account"]["name"] == "Meera Rawat"
    assert export["personal"]["gstin"] == GSTIN
    assert len(export["staff"]) == 1
    bookings = sample.scalar(select(func.count(Booking.id)))
    unconfirmed = client.request("DELETE", "/settings/account", headers=acct, json={})
    assert unconfirmed.status_code == 422
    res = client.request("DELETE", "/settings/account", headers=acct, json={"confirm": True})
    assert res.status_code == 200
    sample.expire_all()
    assert sample.scalar(select(func.count(OwnerAccount.id))) == 0
    assert sample.scalar(select(func.count(OwnerSettings.id))) == 0
    assert sample.scalar(select(func.count(StaffInvite.id))) == 0
    assert sample.scalar(select(func.count(Booking.id))) == bookings
    assert sample.scalar(select(func.count(Property.id))) == 1
    # The deleted account's session ends.
    assert client.get("/settings", headers=acct).status_code == 401


@pytest.mark.usefixtures("sample")
def test_settings_need_a_subject(client: TestClient, owner: dict[str, str]) -> None:
    assert client.get("/settings", headers=owner).status_code == 401
    assert client.get("/calendar", headers=owner).status_code == 401
    bad = owner | {"X-Seedha-Subject": "a999"}
    assert client.get("/settings", headers=bad).status_code == 401


# --- calendar -------------------------------------------------------------------


def test_calendar_events_are_sample_channel_decisions(
    client: TestClient, demo: dict[str, str], sample: Session
) -> None:
    body = client.get("/calendar", headers=demo).json()
    assert body["sample"] is True
    assert body["first_month"] == "2026-10-01" and body["last_month"] == "2027-01-01"
    carnival = next(e for e in body["events"] if e["key"] == "winter-line-carnival")
    assert (carnival["start"], carnival["end"]) == ("2026-12-25", "2026-12-30")
    assert carnival["decision"] == (
        "Stop OTA discounts for these dates and keep 6 rooms for direct guests."
    )
    for event in body["events"]:
        assert "₹" not in event["decision"]
        assert not any(w in event["decision"].lower() for w in ("predict", "demand", "expect"))
    prop = sample.scalars(select(Property)).one()
    move = saturday_move(load_ledger(sample, prop.id), 1)
    assert body["facts"]["channel_name"] == move.channel_name
    assert body["facts"]["extra_per_room_night"] == move.extra_per_room
    held = [e for e in body["events"] if e["action"] == "hold"]
    assert all(move.channel_name in e["decision"] for e in held)


def test_plan_add_remove_and_unknown(
    client: TestClient, demo: dict[str, str], sample: Session
) -> None:
    key = EVENTS[0].key
    added = client.post("/calendar/plan", headers=demo, json={"event_key": key}).json()
    assert next(e for e in added["events"] if e["key"] == key)["in_plan"] is True
    again = client.post("/calendar/plan", headers=demo, json={"event_key": key})
    assert again.status_code == 200
    sample.expire_all()
    assert sample.scalar(select(func.count(PlanEntry.id))) == 1
    assert client.post("/calendar/plan", headers=demo,
                       json={"event_key": "nope"}).status_code == 404  # fmt: skip
    removed = client.delete(f"/calendar/plan/{key}", headers=demo).json()
    assert not any(e["in_plan"] for e in removed["events"])


@pytest.mark.usefixtures("base_sample")
def test_calendar_before_statements_has_no_facts(client: TestClient, demo: dict[str, str]) -> None:
    body = client.get("/calendar", headers=demo).json()
    assert body["facts"] is None
    hold = next(e for e in body["events"] if e["action"] == "hold")
    assert "your lowest paying OTA" in hold["decision"]
