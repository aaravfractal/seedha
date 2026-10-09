"""Sending WhatsApp messages and reading inbound webhooks.

Live mode uses the Meta WhatsApp Cloud API:
POST https://graph.facebook.com/{version}/{phone-number-id}/messages
Without keys every send is SIMULATED: recorded on the message and logged
without the phone number. Inbound webhooks are accepted only when signed with
WHATSAPP_APP_SECRET (X-Hub-Signature-256).
"""

from __future__ import annotations

import hashlib
import hmac
import logging
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Protocol

import httpx

from app.config import Settings

logger = logging.getLogger("seedha.whatsapp")
GRAPH_BASE = "https://graph.facebook.com"
STOP_WORDS = frozenset({"stop", "unsubscribe", "opt out", "optout", "stop all"})


@dataclass(frozen=True, slots=True)
class SendResult:
    """Outcome of one send."""

    ok: bool
    transport: str
    provider_id: str | None = None
    error: str | None = None


class Sender(Protocol):
    """Sends a text message to an E.164 number."""

    def send(self, to: str, body: str, message_id: int) -> SendResult:
        """Deliver or simulate one message."""


class SimulatedSender:
    """No WhatsApp keys: record the send, never contact anyone."""

    def send(self, to: str, body: str, message_id: int) -> SendResult:
        """Log without the number or the text."""
        _ = (to, body)  # deliberately unused: nothing leaves the server
        logger.warning("SIMULATED WhatsApp send for message %s (no keys configured)", message_id)
        return SendResult(ok=True, transport="simulated", provider_id=f"sim-{message_id}")


class CloudApiSender:
    """Meta WhatsApp Cloud API text message."""

    def __init__(self, settings: Settings, client: httpx.Client | None = None) -> None:
        self._settings = settings
        self._client = client or httpx.Client(timeout=15.0)

    def send(self, to: str, body: str, message_id: int) -> SendResult:
        """POST /{version}/{phone-number-id}/messages."""
        s = self._settings
        url = f"{GRAPH_BASE}/{s.whatsapp_api_version}/{s.whatsapp_phone_number_id}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to.lstrip("+"),
            "type": "text",
            "text": {"body": body},
        }
        try:
            response = self._client.post(
                url, json=payload, headers={"Authorization": f"Bearer {s.whatsapp_token}"}
            )
        except httpx.HTTPError:
            logger.warning("WhatsApp send for message %s failed: network", message_id)
            return SendResult(ok=False, transport="whatsapp", error="WhatsApp could not be reached")
        if response.status_code >= 400:  # noqa: PLR2004
            logger.warning(
                "WhatsApp send for message %s failed: %s", message_id, response.status_code
            )
            return SendResult(ok=False, transport="whatsapp", error="WhatsApp refused the message")
        messages = response.json().get("messages") or [{}]
        return SendResult(ok=True, transport="whatsapp", provider_id=messages[0].get("id"))


def sender_for(settings: Settings) -> Sender:
    """Live sender when configured, else the simulated one."""
    return CloudApiSender(settings) if settings.whatsapp_enabled else SimulatedSender()


def valid_signature(app_secret: str, body: bytes, header: str | None) -> bool:
    """X-Hub-Signature-256 = 'sha256=' + HMAC-SHA256(app secret, raw body)."""
    if not app_secret or not header or not header.startswith("sha256="):
        return False
    expected = hmac.new(app_secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header.removeprefix("sha256="))


def is_stop(text: str) -> bool:
    """STOP and its common variants, case and spacing ignored."""
    return " ".join(text.lower().split()).strip(" .!") in STOP_WORDS


def inbound_texts(payload: object) -> Iterator[tuple[str, str]]:
    """(from number, text) for each inbound text message in a webhook body."""
    if not isinstance(payload, dict):
        return
    for entry in payload.get("entry") or []:
        for change in (entry or {}).get("changes") or []:
            value = (change or {}).get("value") or {}
            for message in value.get("messages") or []:
                text = ((message or {}).get("text") or {}).get("body")
                sender = (message or {}).get("from")
                if isinstance(text, str) and isinstance(sender, str):
                    yield sender, text
