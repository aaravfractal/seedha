"""WhatsApp Cloud API webhook: verification handshake and inbound STOP."""

from __future__ import annotations

import hmac
import json
from typing import Annotated

from fastapi import APIRouter, Header, Query, Request
from fastapi.responses import PlainTextResponse

from app.deps import SessionDep, SettingsDep
from app.errors import ApiError
from app.services.desk import utc_now
from app.services.messages import handle_inbound
from app.services.whatsapp import inbound_texts, valid_signature

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.get("/whatsapp", response_class=PlainTextResponse)
def verify(
    settings: SettingsDep,
    mode: Annotated[str, Query(alias="hub.mode")] = "",
    token: Annotated[str, Query(alias="hub.verify_token")] = "",
    challenge: Annotated[str, Query(alias="hub.challenge", max_length=200)] = "",
) -> str:
    """Meta's subscription check: echo the challenge for our verify token."""
    expected = settings.whatsapp_verify_token
    if not expected or mode != "subscribe" or not hmac.compare_digest(token, expected):
        raise ApiError(403, "verification_failed", "Webhook verification failed")
    return challenge


@router.post("/whatsapp")
async def inbound(
    request: Request,
    session: SessionDep,
    settings: SettingsDep,
    signature: Annotated[str | None, Header(alias="X-Hub-Signature-256")] = None,
) -> dict[str, int]:
    """Signed inbound messages. STOP withdraws consent (rule 5)."""
    if not settings.whatsapp_app_secret:
        raise ApiError(503, "webhook_not_configured", "WHATSAPP_APP_SECRET is not set")
    raw = await request.body()
    if not valid_signature(settings.whatsapp_app_secret, raw, signature):
        raise ApiError(401, "bad_signature", "Signature missing or wrong")
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ApiError(422, "invalid_json", "Body is not JSON") from exc
    withdrawn = 0
    for number, text in inbound_texts(payload):
        withdrawn += handle_inbound(session, number, text, "webhook", utc_now())
    return {"withdrawn": withdrawn}
