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

Two refinements (Hotel Site V2 review R1):
- a bucket can be keyed per client *and* per path value (`per`), so a script
  hammering one hotel's scan counter has its own small allowance per hotel;
- the web server's own cached server-side renders (a valid proxy proof and no
  visitor address forwarded, see app/proxy_trust.server_render) use their own
  larger bucket (`render`), so every hotel page render no longer shares one
  ordinary per-client allowance. Nobody without the proof can reach it.
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
from app.proxy_trust import server_render


@dataclass(frozen=True, slots=True)
class Limit:
    """At most `count` requests per `seconds` from one client. `ceiling` sets
    the all-client allowance when it is not `count` times GLOBAL_FACTOR."""

    count: int
    seconds: int
    ceiling: int | None = None


# Generous for a guest, tight for a script guessing tokens or codes.
LIMITS: dict[str, Limit] = {
    "consent": Limit(20, 60),
    # Statement parsing is CPU-heavy (final audit A1b-1).
    "statement_upload": Limit(10, 60),
    "link": Limit(30, 60),
    "link_book": Limit(10, 60),
    "data_deletion": Limit(5, 60),
    # Anyone signed in to the sample hotel can press reset (review S6).
    "demo_reset": Limit(2, 60),
    "site": Limit(60, 60),
    # The web server's own cached renders of hotel pages (proof, no visitor
    # address): one shared client, so a larger allowance (review R1-2).
    "site_ssr": Limit(600, 60),
    # Up to 8 photos per hotel page view (browsers cache them a day).
    "site_photo": Limit(240, 60),
    # A printed card's QR counts one scan per page load (Hotel Site V2). Per
    # client per hotel (a guest scans once); the all-client ceiling stays 600.
    "site_scan": Limit(10, 60, ceiling=600),
    # Owner card PDFs and QR downloads: CPU work, never needed in a loop (R1-11).
    "cards": Limit(20, 60),
    # Verified-guest rating links: a guest opens and submits once (mini-site).
    "rate": Limit(20, 60),
    # Card page: verifying a booking reference, per client and per client per
    # hotel (a script guessing references), rating once, private notes.
    "card_verify": Limit(10, 60),
    "card_verify_hotel": Limit(6, 60),
    "card_rate": Limit(10, 60),
    "card_feedback": Limit(5, 60),
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


def ceiling_of(limit: Limit) -> Limit:
    """The all-client allowance for a bucket."""
    return Limit(limit.ceiling or limit.count * GLOBAL_FACTOR, limit.seconds)


def rate_limited(
    bucket: str, *, per: str | None = None, render: str | None = None
) -> Callable[[Request], None]:
    """A route dependency that answers 429 when the client is over `bucket`'s limit.

    `per` names a path parameter (for example "slug"): the client's allowance
    is then counted per value of it, while the all-client ceiling stays one
    per bucket. `render` names the bucket for the web server's own
    server-side renders (valid proxy proof, no visitor address forwarded)."""
    limit = LIMITS[bucket]
    ceiling = ceiling_of(limit)
    render_limit = LIMITS[render] if render else None

    def dependency(request: Request) -> None:
        limiter: RateLimiter = request.app.state.rate_limiter
        client = request.client.host if request.client else "unknown"
        name, own, all_clients = bucket, limit, ceiling
        if render and render_limit and server_render(request.scope, request.app.state.settings):
            name, own, all_clients = render, render_limit, ceiling_of(render_limit)
        elif per is not None:
            client = f"{client}|{str(request.path_params.get(per, ''))[:80]}"
        wait = limiter.check(name, client, own) or limiter.check(name, ALL_CLIENTS, all_clients)
        if wait > 0:
            raise ApiError(
                429,
                "too_many_requests",
                "Too many tries. Please wait a minute and try again.",
                headers={"Retry-After": str(math.ceil(wait))},
            )

    return dependency
