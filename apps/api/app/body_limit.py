"""Refuse oversized request bodies before any route parses them (security review V1-M1).

FastAPI reads a multipart body to the end before it resolves a route's
dependencies, so without this an anonymous caller could stream any amount of
data to the API's disk before auth or rate limits run. Here a declared
Content-Length above the limit gets 413 at once, and a body without one
(chunked) is counted as it arrives and cut off at the limit. The per-route
10 MB checks (statements, site photos) stay as they are.
"""

from __future__ import annotations

import json

from starlette.types import ASGIApp, Message, Receive, Scope, Send

MAX_BODY_BYTES = 11 * 1024 * 1024
TOO_LARGE = json.dumps(
    {"error": {"code": "file_too_large", "message": "Files must be 10 MB or smaller"}}
).encode()


class BodyTooLargeError(Exception):
    """The body went over the limit while it was being read."""


def declared_length(scope: Scope) -> int | None:
    """The Content-Length header as a number, or None when absent or not a number."""
    for key, value in scope.get("headers", []):
        if key.lower() == b"content-length":
            raw = value.decode("latin-1").strip()
            return int(raw) if raw.isdigit() else None
    return None


async def send_413(send: Send) -> None:
    """The shared JSON error shape, status 413, connection closed."""
    await send({
        "type": "http.response.start",
        "status": 413,
        "headers": [(b"content-type", b"application/json"),
                    (b"content-length", str(len(TOO_LARGE)).encode()),
                    (b"connection", b"close")],
    })  # fmt: skip
    await send({"type": "http.response.body", "body": TOO_LARGE})


class BodyLimitMiddleware:
    """413 for any HTTP request body over `max_bytes`, declared or streamed."""

    def __init__(self, app: ASGIApp, max_bytes: int = MAX_BODY_BYTES) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        length = declared_length(scope)
        if length is not None and length > self.max_bytes:
            await send_413(send)
            return
        received = 0
        over = False
        started = False

        async def counted_receive() -> Message:
            nonlocal received, over
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    over = True
                    raise BodyTooLargeError
            return message

        async def guarded_send(message: Message) -> None:
            nonlocal started
            if over:  # the route's own reply to the cut-off body is dropped
                return
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, counted_receive, guarded_send)
        # The cut-off body may surface as any parse error; anything else is re-raised.
        except Exception:  # pylint: disable=broad-exception-caught
            if not over:
                raise
        if over and not started:
            await send_413(send)
