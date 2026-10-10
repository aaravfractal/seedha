"""The sample hotel reproduces every locked number (CLAUDE.md M1, rulings 1-7).

Expected values are written out here by hand from CLAUDE.md and the rulings,
not imported from the generator, so a generator bug cannot hide itself.
"""

from __future__ import annotations

import csv
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Booking, Channel, ChannelContract, StatementFile
from app.money import bps_of, gst_on_commission, rupees
from app.services.ledger import LedgerSummary, load_ledger
from seed.coded_history import CODED_STAYS
from seed.load import SeedError, load_sample, resolve_demo_date

DATA = Path(__file__).resolve().parent.parent / "seed" / "data"


@pytest.fixture(name="ledger")
def fixture_ledger(sample: Session) -> LedgerSummary:
    return load_ledger(sample, 1)


def by_key(ledger: LedgerSummary) -> dict[str, object]:
    return {c.channel.key: c for c in ledger.channels}


def test_paid_to_channels(ledger: LedgerSummary) -> None:
    assert ledger.totals.paid_to_channels == rupees(10_39_108)


def test_lost_vs_list_price(ledger: LedgerSummary) -> None:
    assert ledger.totals.lost_vs_list_price == rupees(15_71_988)


def test_total_net_kept(ledger: LedgerSummary) -> None:
    assert ledger.totals.net_kept == rupees(47_33_012)
    assert ledger.totals.list_amount == rupees(63_05_000)


@pytest.mark.parametrize(
    ("key", "room_nights", "net", "net_adr"),
    [
        ("mmt", 620, 16_96_642, 2_737),
        ("bcom", 310, 9_66_858, 3_119),
        ("agoda", 140, 3_63_664, 2_598),
        ("ta", 180, 6_15_600, 3_420),
        ("walkin", 90, 4_05_000, 4_500),
        ("direct", 160, 6_85_248, 4_283),
    ],
)
def test_channel_net_and_adr(
    ledger: LedgerSummary, key: str, room_nights: int, net: int, net_adr: int
) -> None:
    summary = by_key(ledger)[key]
    assert summary.room_nights == room_nights  # type: ignore[attr-defined]
    assert summary.lines.net_kept == rupees(net)  # type: ignore[attr-defined]
    assert summary.net_adr == rupees(net_adr)  # type: ignore[attr-defined]


def test_makemytrip_first_by_bookings_fifth_by_money_kept(ledger: LedgerSummary) -> None:
    assert ledger.rank_by_bookings[0] == "mmt"
    assert ledger.rank_by_money_kept.index("mmt") == 4
    assert ledger.rank_by_money_kept == ("walkin", "direct", "ta", "bcom", "mmt", "agoda")


def test_shares_and_revpar_rulings_3(ledger: LedgerSummary) -> None:
    assert ledger.room_nights == 1_500
    assert ledger.direct_bookings_tenths == 107
    assert ledger.commission_free_share_tenths == 167
    assert ledger.paid_to_channels_share_tenths == 165
    assert ledger.revpar_list == rupees(1_566)
    assert ledger.revpar_net == rupees(1_176)


def test_1500_rows_and_3_flagged(sample: Session) -> None:
    statement = sample.scalars(select(Booking).where(Booking.source == "statement")).all()
    assert len(statement) == 1_500
    flagged = {b.external_ref: b for b in statement if not b.math_check_passed}
    assert set(flagged) == {"MM48213", "BK55320", "AG77102"}
    assert flagged["MM48213"].flag_detail == ("Payout ₹3,120, but list minus deductions is ₹3,240")
    assert flagged["BK55320"].flag_detail == "GST on commission line missing"
    assert flagged["AG77102"].flag_detail == "Commission charged on a cancelled stay"
    assert all(b.review_status == "pending" for b in flagged.values())


def test_file_row_counts(sample: Session) -> None:
    files = sample.scalars(select(StatementFile)).all()
    counts = {f.filename: (f.row_count, f.flagged_count) for f in files}
    assert counts["MakeMyTrip Apr to Jun.pdf"] == (410, 1)
    assert counts["MakeMyTrip Jul to Sep.pdf"] == (412, 0)
    assert counts["Booking.com payouts.xlsx"] == (214, 1)
    assert counts["Agoda statement.csv"] == (96, 1)
    assert counts["Travel agent register.xlsx"] == (180, 0)
    assert counts["Hotel register.xlsx"] == (188, 0)


def test_accepting_a_flagged_row_brings_it_into_the_flip(sample: Session) -> None:
    """Rule 3: excluded until the owner reviews; accepted rows then count."""
    row = sample.scalars(select(Booking).where(Booking.external_ref == "AG77102")).one()
    before = load_ledger(sample, 1).totals.paid_to_channels
    row.review_status = "accepted"
    sample.flush()
    assert load_ledger(sample, 1).totals.paid_to_channels == before + rupees(802)


def test_net_kept_column_matches_formula_on_every_row(sample: Session) -> None:
    for b in sample.scalars(select(Booking)):
        assert b.net_kept == (
            b.list_amount - b.discount - b.commission - b.gst_on_commission - b.fees
        )
        assert b.list_amount % 100 == 0  # whole rupees, as statements print


def test_gst_is_18_percent_of_commission_on_passing_rows(sample: Session) -> None:
    """Rule 2 per row: GST on commission is exactly 18%, rounded to the rupee."""
    checked = 0
    for b in sample.scalars(select(Booking).where(Booking.math_check_passed.is_(True))):
        contract = b.channel.contracts[0]
        expected = gst_on_commission(b.commission) if contract.gst_applies else 0
        assert b.gst_on_commission == expected, b.external_ref
        assert b.commission == bps_of(b.list_amount - b.discount, contract.commission_bps) or (
            b.status == "cancelled" and b.commission == 0
        ), b.external_ref
        checked += 1
    assert checked == 1_497 + 152 + 14 + len(CODED_STAYS)  # D-080 coded history


def test_tds_never_reduces_net(sample: Session) -> None:
    """Rule 2: TDS is a credit. Net excludes it even though payout does not."""
    row = sample.scalars(
        select(Booking).where(Booking.source == "statement", Booking.tds > 0)
    ).first()
    assert row is not None
    assert row.payout_reported == row.net_kept - row.tds - row.gst_tcs


def test_contract_rates_ruling_5(sample: Session) -> None:
    rates = {
        c.channel.key: (c.commission_bps, c.gst_applies)
        for c in sample.scalars(select(ChannelContract))
    }
    assert rates["mmt"] == (2_200, True)
    assert rates["bcom"] == (1_800, True)
    assert rates["agoda"] == (2_000, True)
    assert rates["ta"] == (1_000, False)


def test_neha_desk_booking_ruling_4(sample: Session) -> None:
    neha = sample.scalars(
        select(Booking).where(Booking.guest_name == "Neha Gupta", Booking.source == "desk")
    ).one()
    assert neha.channel.key == "bcom"
    assert (neha.list_amount, neha.discount, neha.commission, neha.gst_on_commission) == (
        rupees(4_000),
        rupees(600),
        rupees(612),
        rupees(110),
    )
    assert neha.net_kept == rupees(2_678)
    assert neha.check_in == date(2026, 10, 13)


def test_desk_guests_are_outside_the_window_decision_d(sample: Session) -> None:
    desk = sample.scalars(select(Booking).where(Booking.source == "desk")).all()
    assert len(desk) == 14
    assert {b.guest_name for b in desk} >= {"Neha Gupta", "Rahul Sharma", "Arjun Mehta"}
    assert all(b.check_in > date(2026, 9, 30) for b in desk)
    assert all(b.guest_id is not None for b in desk)


def test_desk_activity_never_changes_locked_totals(sample: Session) -> None:
    before = load_ledger(sample, 1)
    channel = sample.scalars(select(Channel).where(Channel.key == "direct")).one()
    sample.add(
        Booking(
            property_id=1,
            channel_id=channel.id,
            external_ref="HR-NEW",
            source="desk",
            status="stay",
            check_in=date(2026, 10, 14),
            nights=2,
            guest_name="Test Guest",
            list_amount=rupees(8_600),
            discount=0,
            commission=0,
            gst_on_commission=0,
            fees=rupees(34),
            net_kept=rupees(8_566),
            payout_reported=rupees(8_566),
            math_check_passed=True,
        )  # fmt: skip
    )
    sample.flush()
    after = load_ledger(sample, 1)
    assert after.totals == before.totals
    assert after.room_nights == before.room_nights


def test_history_is_2025_and_outside_window(sample: Session) -> None:
    history = sample.scalars(select(Booking).where(Booking.source == "history")).all()
    assert len(history) == 152
    assert all(b.check_in < date(2026, 4, 1) for b in history)


def test_twelve_repeat_guests_paid_41800_twice_decision_c(sample: Session) -> None:
    with (DATA / "repeat_key.csv").open(encoding="utf-8") as handle:
        key = list(csv.DictReader(handle))
    assert len(key) == 12
    refs = [k["window_ref"] for k in key]
    rows = sample.scalars(select(Booking).where(Booking.external_ref.in_(refs))).all()
    assert len(rows) == 12
    assert all(r.channel.kind == "ota" and r.math_check_passed for r in rows)
    assert sum(r.commission + r.gst_on_commission for r in rows) == rupees(41_800)
    firsts = sample.scalars(
        select(Booking).where(Booking.external_ref.in_([k["history_ref"] for k in key]))
    ).all()
    assert all(b.check_in.year == 2025 for b in firsts)


def test_monthly_breakdown_sums_and_monsoon_dip_ruling_6(sample: Session) -> None:
    rows = sample.scalars(
        select(Booking).where(Booking.source == "statement", Booking.math_check_passed.is_(True))
    ).all()
    nights: Counter[int] = Counter()
    paid: dict[str, Counter[int]] = defaultdict(Counter)
    for b in rows:
        if b.status == "stay":
            nights[b.check_in.month] += b.nights
        paid[b.channel.key][b.check_in.month] += b.commission + b.gst_on_commission + b.fees
    assert sorted(nights) == [4, 5, 6, 7, 8, 9]
    assert sum(nights.values()) == 1_500
    others = [nights[m] for m in (4, 5, 6, 9)]
    assert nights[7] < min(others)
    assert nights[8] < min(others)
    assert sum(sum(c.values()) for c in paid.values()) == rupees(10_39_108)
    assert sum(paid["mmt"].values()) == rupees(5_94_878)
    assert paid["mmt"][9] != rupees(99_146)  # ruling 6: the true figure, not forced


def test_no_room_double_booked(sample: Session) -> None:
    taken: Counter[tuple[int, date]] = Counter()
    for b in sample.scalars(
        select(Booking).where(Booking.source == "statement", Booking.status == "stay")
    ):
        if b.room_id is None:
            continue
        for night in range(b.nights):
            taken[(b.room_id, date.fromordinal(b.check_in.toordinal() + night))] += 1
    assert max(taken.values()) == 1


def test_demo_date_must_be_after_window() -> None:
    with pytest.raises(SeedError):
        resolve_demo_date(date(2026, 9, 30))
    assert resolve_demo_date(date(2026, 10, 1)) == date(2026, 10, 1)
    assert resolve_demo_date(None) > date(2026, 9, 30)


def test_cannot_seed_twice(sample: Session) -> None:
    with pytest.raises(SeedError):
        load_sample(sample, date(2026, 10, 13), with_statements=False)


def test_base_seed_has_no_statements(base_sample: Session) -> None:
    assert base_sample.scalars(select(Booking).where(Booking.source == "statement")).first() is None
    assert load_ledger(base_sample, 1).room_nights == 0
