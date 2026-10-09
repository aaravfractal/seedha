"""Public routes are rate limited per client (M11 security pass)."""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi import Request
from fastapi.testclient import TestClient

from app import ratelimit
from app.errors import ApiError
from app.ratelimit import LIMITS, Limit, RateLimiter, rate_limited


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def test_window_allows_the_limit_then_refuses_until_the_oldest_hit_expires() -> None:
    clock = FakeClock()
    limiter = RateLimiter(clock)
    limit = Limit(3, 60)
    assert [limiter.check("b", "1.2.3.4", limit) for _ in range(3)] == [0, 0, 0]
    assert limiter.check("b", "1.2.3.4", limit) == 60
    clock.now += 20
    assert limiter.check("b", "1.2.3.4", limit) == 40
    assert limiter.check("b", "5.6.7.8", limit) == 0, "another client has its own window"
    assert limiter.check("other", "1.2.3.4", limit) == 0, "another bucket has its own window"
    clock.now += 40
    assert limiter.check("b", "1.2.3.4", limit) == 0


def test_refused_hits_do_not_extend_the_wait() -> None:
    clock = FakeClock()
    limiter = RateLimiter(clock)
    limit = Limit(1, 60)
    limiter.check("b", "c", limit)
    for _ in range(50):
        limiter.check("b", "c", limit)
    clock.now += 60
    assert limiter.check("b", "c", limit) == 0


def test_idle_clients_are_pruned(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(ratelimit, "MAX_TRACKED_KEYS", 2)
    clock = FakeClock()
    limiter = RateLimiter(clock)
    limit = Limit(5, 60)
    limiter.check("b", "old", limit)
    clock.now += 3600
    limiter.check("b", "x", limit)
    limiter.check("b", "y", limit)
    assert ("b", "old") not in limiter._hits  # noqa: SLF001
    assert ("b", "y") in limiter._hits  # noqa: SLF001


def hammer(
    client: TestClient, method: str, path: str, times: int, body: object = None
) -> list[int]:
    return [client.request(method, path, json=body).status_code for _ in range(times)]


@pytest.mark.usefixtures("sample")
@pytest.mark.parametrize(
    ("bucket", "method", "path", "body"),
    [
        ("consent", "GET", "/public/consent/not-a-token", None),
        (
            "consent",
            "POST",
            "/public/consent/not-a-token",
            {"agree": True, "whatsapp": "9876543210"},
        ),
        ("link", "GET", "/public/link?code=NOPE-0000", None),
        ("link_book", "POST", "/public/link/book", {"bad": "body"}),
        (
            "data_deletion",
            "POST",
            "/public/data-deletion",
            {"booking_ref": "NOPE", "phone": "9876543210"},
        ),
    ],
)
def test_public_route_answers_429_with_retry_after_once_over_its_limit(
    client: TestClient, bucket: str, method: str, path: str, body: object
) -> None:
    limit = LIMITS[bucket].count
    codes = hammer(client, method, path, limit, body)
    assert 429 not in codes
    res = client.request(method, path, json=body)
    assert res.status_code == 429
    assert res.json()["error"]["code"] == "too_many_requests"
    assert 0 < int(res.headers["retry-after"]) <= LIMITS[bucket].seconds


@pytest.mark.usefixtures("sample")
def test_owner_routes_are_not_rate_limited(client: TestClient, owner: dict[str, str]) -> None:
    codes = {client.get("/property", headers=owner).status_code for _ in range(60)}
    assert codes == {200}


def test_rotating_client_addresses_still_hits_the_global_ceiling(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(ratelimit, "GLOBAL_FACTOR", 2)
    monkeypatch.setitem(LIMITS, "data_deletion", Limit(2, 60))
    check = rate_limited("data_deletion")
    app = SimpleNamespace(state=SimpleNamespace(rate_limiter=RateLimiter()))
    outcomes = []
    for i in range(6):
        request = Request({"type": "http", "app": app, "client": (f"10.0.0.{i}", 1)})
        try:
            check(request)
            outcomes.append(200)
        except ApiError as exc:
            outcomes.append(exc.status)
    assert outcomes == [200, 200, 200, 200, 429, 429]
