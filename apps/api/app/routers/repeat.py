"""Repeat guests: guests who came back through an OTA after an earlier stay.

For the owner's eyes only. A match is a suggestion until the owner confirms
it, and it never makes a guest messageable (rule 4, ruling 7).
"""

from __future__ import annotations

from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from app.deps import OwnerDep, PropertyDep, SessionDep, SettingsDep
from app.errors import ApiError
from app.routers.pipeline import record_step
from app.services.llm import tie_breaker
from app.services.matcher import TieBreaker
from app.services.repeats import RepeatRow, decide, list_matches, scan

router = APIRouter(prefix="/repeat", tags=["repeat"])


class StayOut(BaseModel):
    """One side of a match."""

    channel: str
    check_in: date
    guest_name: str
    city: str | None


class MatchOut(BaseModel):
    """A repeat guest. Money in paise."""

    id: int
    guest_name: str
    city: str | None
    first: StayOut
    returned: StayOut
    confidence: int
    status: str
    llm_opinion: str | None
    paid_twice: int
    not_new_demand: bool


class RepeatOut(BaseModel):
    """Repeat guests and the commission paid twice on them."""

    count: int
    confirmed: int
    paid_twice_total: int
    matches: list[MatchOut]


class DecisionIn(BaseModel):
    """Owner decision on a suggested match."""

    decision: Literal["confirm", "dismiss"]


def get_tie_breaker(request: Request, settings: SettingsDep) -> TieBreaker | None:
    """Claude tie-breaker, overridable in tests via app.state.tie_breaker."""
    override: TieBreaker | None = getattr(request.app.state, "tie_breaker", None)
    return override if override is not None else tie_breaker(settings)


TieBreakerDep = Annotated[TieBreaker | None, Depends(get_tie_breaker)]


def match_out(row: RepeatRow) -> MatchOut:
    """Shape one stored match for the screen."""
    r, e = row.returned, row.earlier
    return MatchOut(
        id=row.match.id,
        guest_name=r.guest_name,
        city=r.guest_city,
        first=StayOut(
            channel=row.earlier_channel,
            check_in=e.check_in,
            guest_name=e.guest_name,
            city=e.guest_city,
        ),  # fmt: skip
        returned=StayOut(
            channel=row.returned_channel,
            check_in=r.check_in,
            guest_name=r.guest_name,
            city=r.guest_city,
        ),  # fmt: skip
        confidence=row.match.confidence,
        status=row.match.status,
        llm_opinion=row.match.llm_opinion,
        paid_twice=row.paid_twice,
        not_new_demand=True,
    )


def summary(rows: list[RepeatRow]) -> RepeatOut:
    """Totals over suggested and confirmed matches."""
    return RepeatOut(
        count=len(rows),
        confirmed=sum(1 for r in rows if r.match.status == "confirmed"),
        paid_twice_total=sum(r.paid_twice for r in rows),
        matches=[match_out(r) for r in rows],
    )


@router.get("", response_model=RepeatOut)
def get_repeats(
    _owner: OwnerDep, session: SessionDep, prop: PropertyDep, breaker: TieBreakerDep
) -> RepeatOut:
    """Scan for new repeats (idempotent) and list them."""
    scan(session, prop.id, breaker)
    rows = list_matches(session, prop.id)
    if rows:
        record_step(session, "rep")
    return summary(rows)


@router.post("/{match_id}", response_model=RepeatOut)
def decide_match(
    match_id: int, body: DecisionIn, _owner: OwnerDep, session: SessionDep, prop: PropertyDep
) -> RepeatOut:
    """Owner confirms or dismisses a suggested match."""
    if decide(session, prop.id, match_id, body.decision) is None:
        raise ApiError(404, "no_such_match", "No repeat-guest match with that id")
    return summary(list_matches(session, prop.id))
