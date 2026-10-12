"""Per-client rate limits for the routes anyone can call without a login.

An in-memory sliding window per (bucket, client address). It lives on
`app.state`, so each app instance (and each test) starts clean. One process
is enough for the prototype; a multi-process deployment needs a shared store
(see docs/decisions.md D-071).

The client address is `request.client.host`. Behind the web app's BFF that is
the guest's own address: uvicorn rewrites it from `X-Forwarded-For` when the
connection comes from a trusted proxy (FORWARDED_ALLOW_IPS, loopback by
default), and the BFF sets that header. A client can only fake its address if
no proxy in front of the web app overwrites that header, so every bucket also
has a ceiling across all clients.
"""

from __future__ import annotations

import math
import threading
import time
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass

from fastapi import Request

from app.errors import ApiError


@dataclass(frozen=True, slots=True)
class Limit:
    """At most `count` requests per `seconds` from one client."""

    count: int
    seconds: int


# Generous for a guest, tight for a script guessing tokens or codes.
LIMITS: dict[str, Limit] = {
    "consent": Limit(20, 60),
    "link": Limit(30, 60),
    "link_book": Limit(10, 60),
    "data_deletion": Limit(5, 60),
    # Anyone signed in to the sample hotel can press reset (review S6).
    "demo_reset": Limit(2, 60),
    "site": Limit(60, 60),
    # Up to 8 photos per hotel page view (browsers cache them a day).
    "site_photo": Limit(240, 60),
    # The public website loads the sample figures once per page view.
    "public_sample": Limit(60, 60),
}


# Every client together may make this many times one client's allowance, so
# rotating a spoofed X-Forwarded-For cannot lift the limit entirely.
GLOBAL_FACTOR = 20
ALL_CLIENTS = "*"
MAX_TRACKED_KEYS = 10_000


class RateLimiter:
    """Sliding-window counter keyed by (bucket, client)."""

    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None:
        self._clock = clock
        self._hits: dict[tuple[str, str], deque[float]] = {}
        self._lock = threading.Lock()

    def check(self, bucket: str, client: str, limit: Limit) -> float:
        """Record a hit. Returns 0 if allowed, else seconds until the next slot."""
        now = self._clock()
        with self._lock:
            hits = self._hits.setdefault((bucket, client), deque())
            while hits and hits[0] <= now - limit.seconds:
                hits.popleft()
            if len(hits) >= limit.count:
                return hits[0] + limit.seconds - now
            hits.append(now)
            if len(self._hits) > MAX_TRACKED_KEYS:
                self._prune(now)
            return 0.0

    def _prune(self, now: float) -> None:
        """Drop clients with no hit in the longest window, to bound memory."""
        longest = max(limit.seconds for limit in LIMITS.values())
        stale = [key for key, hits in self._hits.items() if not hits or hits[-1] <= now - longest]
        for key in stale:
            del self._hits[key]


def rate_limited(bucket: str) -> Callable[[Request], None]:
    """A route dependency that answers 429 when the client is over `bucket`'s limit."""
    limit = LIMITS[bucket]
    ceiling = Limit(limit.count * GLOBAL_FACTOR, limit.seconds)

    def dependency(request: Request) -> None:
        limiter: RateLimiter = request.app.state.rate_limiter
        client = request.client.host if request.client else "unknown"
        wait = limiter.check(bucket, client, limit) or limiter.check(bucket, ALL_CLIENTS, ceiling)
        if wait > 0:
            raise ApiError(
                429,
                "too_many_requests",
                "Too many tries. Please wait a minute and try again.",
                headers={"Retry-After": str(math.ceil(wait))},
            )

    return dependency
