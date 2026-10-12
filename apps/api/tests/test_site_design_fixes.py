"""Fixes from the site real-mode design review (V3): two first loads of the
Build screen at once must not fail on the site content row's unique key (M6)."""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from app.models import Property, SiteContent
from app.services import site_gen as gen


def content_rows(session: Session, property_id: int) -> int:
    query = select(func.count()).select_from(SiteContent)
    return int(session.scalar(query.where(SiteContent.property_id == property_id)) or 0)


@pytest.mark.usefixtures("base_sample")
def test_site_content_survives_a_create_race(
    factory: sessionmaker[Session], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Request B looks for the row and misses; request A then creates and
    commits it; B's insert hits the unique key and B reads A's row instead."""
    with factory() as first, factory() as second:
        property_id = int(first.scalar(select(Property.id).order_by(Property.id).limit(1)) or 0)
        assert content_rows(first, property_id) == 0
        original = Session.scalar
        state = {"raced": False}

        def winner_commits_after_the_miss(self: Session, *args: Any, **kwargs: Any) -> Any:
            found = original(self, *args, **kwargs)
            if self is second and not state["raced"]:
                state["raced"] = True
                assert found is None
                gen.get_content(first, property_id)
                first.commit()
            return found

        monkeypatch.setattr(Session, "scalar", winner_commits_after_the_miss)
        loser = gen.get_content(second, property_id)
        monkeypatch.undo()
        second.commit()
        mine = select(SiteContent).where(SiteContent.property_id == property_id)
        winner = first.scalars(mine).one()
        assert state["raced"]
        assert loser.id == winner.id
        assert content_rows(second, property_id) == 1


@pytest.mark.usefixtures("base_sample")
def test_build_loads_twice_on_a_fresh_hotel(client: TestClient, owner: dict[str, str]) -> None:
    """The owner screen's double first load: both reads succeed, one row."""
    first = client.get("/site/build", headers=owner)
    second = client.get("/site/build", headers=owner)
    assert (first.status_code, second.status_code) == (200, 200)
    assert first.json() == second.json()
