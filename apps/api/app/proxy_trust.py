"""Hosted only: trust the client address the web server forwards, and only
from the web server (hosting security review S-H1).

uvicorn runs with --forwarded-allow-ips='*' behind Railway, so it takes the
left-most X-Forwarded-For entry, which the web server's proxy sets to the
real visitor. A direct caller of the API's public URL could put any address
there and get a fresh rate-limit bucket each time. The web server proves
itself with X-Seedha-Proxy (HMAC-SHA256 of a fixed label keyed by
OWNER_API_TOKEN); without a valid proof the client becomes the right-most
X-Forwarded-For hop, which Railway's own proxy adds and the caller cannot
choose.

`server_render` tells the rate limiter when a request is the web server's own
cached server-side fetch of a hotel page (review R1-2): it carries the valid
proof but no visitor address. The web server's proxy always forwards the
visitor's address (lib/bff.ts, app/api/[...path]/route.ts, proxy.ts), while
its cached render (app/h/[slug]/data.ts) cannot, because one cached render
serves every visitor. So X-Forwarded-For then holds only what the hosting
proxy itself appends: HOSTING_HOPS (one, Railway's) in production, none when
the web server calls the API directly (local runs).
"""

from __future__ import annotations

import hashlib
import hmac
from typing import Any

from starlette.types import ASGIApp, Receive, Scope, Send

from app.config import Settings

PROOF_HEADER = b"x-seedha-proxy"
PROOF_LABEL = b"seedha-proxy"
FORWARDED_HEADER = b"x-forwarded-for"
# X-Forwarded-For hops the hosting proxy appends in production (Railway: one).
HOSTING_HOPS = 1


def proxy_proof(owner_token: str) -> str:
    """The value the web server sends; empty without a token."""
    if not owner_token:
        return ""
    return hmac.new(owner_token.encode(), PROOF_LABEL, hashlib.sha256).hexdigest()


def last_hop(forwarded: list[bytes]) -> str | None:
    """The right-most address across every X-Forwarded-For header, or None."""
    found = hops(forwarded)
    return found[-1] if found else None


def hops(forwarded: list[bytes]) -> list[str]:
    """Every X-Forwarded-For address, left to right."""
    found = [h.strip() for value in forwarded for h in value.decode("latin-1").split(",")]
    return [h for h in found if h]


def has_proof(headers: list[tuple[bytes, bytes]], proof: bytes) -> bool:
    """The request carries the web server's valid proof."""
    given = next((v for k, v in headers if k.lower() == PROOF_HEADER), b"")
    return bool(proof) and hmac.compare_digest(given, proof)


def server_render(scope: Any, settings: Settings) -> bool:
    """The web server's own server-side fetch: valid proof and no visitor
    address forwarded (only the hops the hosting proxy appends)."""
    headers: list[tuple[bytes, bytes]] = scope.get("headers", [])
    if not has_proof(headers, proxy_proof(settings.owner_api_token).encode()):
        return False
    allowed = HOSTING_HOPS if settings.production else 0
    return len(hops([v for k, v in headers if k.lower() == FORWARDED_HEADER])) <= allowed


class ProxyTrustMiddleware:
    """Replace the client address with the proxy-recorded hop unless the
    request carries the web server's proof."""

    def __init__(self, app: ASGIApp, owner_token: str) -> None:
        self.app = app
        self.proof = proxy_proof(owner_token).encode()

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            headers: list[tuple[bytes, bytes]] = scope.get("headers", [])
            if not has_proof(headers, self.proof):
                hop = last_hop([v for k, v in headers if k.lower() == FORWARDED_HEADER])
                if hop is not None:
                    scope = dict(scope)
                    scope["client"] = (hop, 0)
        await self.app(scope, receive, send)
