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
"""

from __future__ import annotations

import hashlib
import hmac

from starlette.types import ASGIApp, Receive, Scope, Send

PROOF_HEADER = b"x-seedha-proxy"
PROOF_LABEL = b"seedha-proxy"


def proxy_proof(owner_token: str) -> str:
    """The value the web server sends; empty without a token."""
    if not owner_token:
        return ""
    return hmac.new(owner_token.encode(), PROOF_LABEL, hashlib.sha256).hexdigest()


def last_hop(forwarded: list[bytes]) -> str | None:
    """The right-most address across every X-Forwarded-For header, or None."""
    hops = [h.strip() for value in forwarded for h in value.decode("latin-1").split(",")]
    hops = [h for h in hops if h]
    return hops[-1] if hops else None


class ProxyTrustMiddleware:
    """Replace the client address with the proxy-recorded hop unless the
    request carries the web server's proof."""

    def __init__(self, app: ASGIApp, owner_token: str) -> None:
        self.app = app
        self.proof = proxy_proof(owner_token).encode()

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            headers: list[tuple[bytes, bytes]] = scope.get("headers", [])
            given = next((v for k, v in headers if k.lower() == PROOF_HEADER), b"")
            if not (self.proof and hmac.compare_digest(given, self.proof)):
                hop = last_hop([v for k, v in headers if k.lower() == b"x-forwarded-for"])
                if hop is not None:
                    scope = dict(scope)
                    scope["client"] = (hop, 0)
        await self.app(scope, receive, send)
