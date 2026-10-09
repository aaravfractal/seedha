"""Statement upload through the API (CLAUDE.md M2 check)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Booking
from app.money import rupees
from app.services.ledger import load_ledger
from app.services.samples import SAMPLE_FILES, sample_path

AGODA = SAMPLE_FILES.index("Agoda statement.csv")


def upload(client: TestClient, owner: dict[str, str], name: str, data: bytes) -> dict[str, object]:
    res = client.post("/statements", headers=owner, files={"file": (name, data, "text/csv")})
    return {"status_code": res.status_code, **res.json()}


@pytest.mark.usefixtures("base_sample")
def test_six_sample_files_yield_1500_rows_and_3_flagged(
    client: TestClient, owner: dict[str, str], base_sample: Session
) -> None:
    samples = client.get("/statements/samples", headers=owner).json()
    assert [s["filename"] for s in samples] == list(SAMPLE_FILES)
    for sample in samples:
        res = client.post(f"/statements/samples/{sample['index']}", headers=owner)
        assert res.status_code == 200, res.text
        assert res.json()["status"] == "imported"
    summary = client.get("/statements", headers=owner).json()
    assert summary["rows"] == 1_500
    assert summary["flagged"] == 3
    assert summary["pending_review"] == 3
    assert {r["external_ref"] for r in summary["flagged_rows"]} == {
        "MM48213", "BK55320", "AG77102",
    }  # fmt: skip
    assert [f["row_count"] for f in summary["files"]] == [410, 412, 214, 96, 180, 188]
    ledger = load_ledger(base_sample, 1)
    assert ledger.totals.paid_to_channels == rupees(10_39_108)
    assert ledger.totals.net_kept == rupees(47_33_012)
    assert ledger.room_nights == 1_500
    steps = client.get("/pipeline", headers=owner).json()["steps"]
    assert {s["key"] for s in steps if s["done"]} == {"up", "ai"}

    again = client.post("/statements/samples/0", headers=owner).json()
    assert again["status"] == "already_imported"
    assert client.get("/statements", headers=owner).json()["rows"] == 1_500


@pytest.mark.usefixtures("base_sample")
def test_same_lines_in_a_different_file_are_not_counted_twice(
    client: TestClient, owner: dict[str, str]
) -> None:
    data = sample_path(AGODA).read_bytes()
    first = upload(client, owner, "agoda.csv", data)
    assert (first["status"], first["rows"], first["flagged"]) == ("imported", 96, 1)
    resaved = data.replace(b"\n", b"\r\n")
    second = upload(client, owner, "agoda again.csv", resaved)
    assert (second["status"], second["rows"], second["duplicates"]) == ("imported", 0, 96)


@pytest.mark.usefixtures("base_sample")
def test_review_flagged_row(
    client: TestClient, owner: dict[str, str], base_sample: Session
) -> None:
    upload(client, owner, "agoda.csv", sample_path(AGODA).read_bytes())
    row = base_sample.scalars(select(Booking).where(Booking.external_ref == "AG77102")).one()
    before = load_ledger(base_sample, 1).totals.paid_to_channels
    res = client.post(f"/statements/rows/{row.id}/review", headers=owner,
                      json={"decision": "accept"})  # fmt: skip
    assert res.status_code == 200
    assert res.json()["pending_review"] == 0
    base_sample.expire_all()
    assert load_ledger(base_sample, 1).totals.paid_to_channels == before + rupees(802)
    res = client.post(f"/statements/rows/{row.id}/review", headers=owner,
                      json={"decision": "exclude"})  # fmt: skip
    assert res.json()["flagged_rows"][0]["review_status"] == "excluded"


@pytest.mark.usefixtures("base_sample")
def test_review_rejects_bad_input(
    client: TestClient, owner: dict[str, str], base_sample: Session
) -> None:
    upload(client, owner, "agoda.csv", sample_path(AGODA).read_bytes())
    clean = base_sample.scalars(
        select(Booking).where(Booking.source == "statement", Booking.math_check_passed.is_(True))
    ).first()
    assert clean is not None
    assert client.post(f"/statements/rows/{clean.id}/review", headers=owner,
                       json={"decision": "accept"}).status_code == 404  # fmt: skip
    assert client.post("/statements/rows/999999/review", headers=owner,
                       json={"decision": "accept"}).status_code == 404  # fmt: skip
    bad = client.post("/statements/rows/1/review", headers=owner, json={"decision": "maybe"})
    assert bad.status_code == 422


@pytest.mark.usefixtures("base_sample")
def test_upload_errors(
    client: TestClient, owner: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    empty = upload(client, owner, "a.csv", b"")
    assert (empty["status_code"], empty["error"]["code"]) == (422, "empty_file")  # type: ignore[index]
    junk = upload(client, owner, "a.docx", b"hello")
    assert (junk["status_code"], junk["error"]["code"]) == (422, "unreadable_statement")  # type: ignore[index]
    unknown = upload(client, owner, "odd.csv", b"Ref,Gross\nX1,100\n")
    assert (unknown["status_code"], unknown["error"]["code"]) == (503, "needs_claude")  # type: ignore[index]
    monkeypatch.setattr("app.routers.statements.MAX_UPLOAD_BYTES", 10)
    big = upload(client, owner, "a.csv", b"x" * 11)
    assert (big["status_code"], big["error"]["code"]) == (413, "file_too_large")  # type: ignore[index]
    missing = client.post("/statements", headers=owner)
    assert missing.status_code == 422
    assert client.post("/statements/samples/6", headers=owner).status_code == 404
    assert client.post("/statements/samples/-1", headers=owner).status_code == 404


@pytest.mark.usefixtures("base_sample")
def test_statements_need_owner(client: TestClient) -> None:
    assert client.get("/statements").status_code == 401
    assert client.get("/statements/samples").status_code == 401
    assert client.post("/statements/samples/0").status_code == 401
    assert client.post("/statements", files={"file": ("a.csv", b"x")}).status_code == 401
    assert client.post("/statements/rows/1/review", json={"decision": "accept"}).status_code == 401


class FakeReader:
    """Pretends Claude read an unknown CSV layout."""

    def extract(self, text: str, filename: str) -> dict[str, object]:
        assert filename == "odd.csv"
        assert "X1" in text
        return {
            "channel": "Agoda",
            "rows": [{
                "ref": "X1", "guest_name": "Test Guest", "guest_city": "Delhi",
                "check_in": "2026-05-01", "nights": 1, "status": "stay", "list_amount": "4000",
                "discount": "0", "commission": "800", "gst_on_commission": "144", "fees": "0",
                "tds": "0", "tcs": "0", "payout": "3056",
            }],
        }  # fmt: skip


@pytest.mark.usefixtures("base_sample")
def test_unknown_layout_read_by_claude(client: TestClient, owner: dict[str, str]) -> None:
    client.app.state.statement_reader = FakeReader()  # type: ignore[attr-defined]
    data = b"Ref,Guest,Date,Gross,Commission,GST,Paid\nX1,Test Guest,2026-05-01,4000,800,144,3056\n"
    res = upload(client, owner, "odd.csv", data)
    assert (res["status"], res["method"], res["rows"], res["flagged"]) == (
        "imported",
        "claude",
        1,
        0,
    )
