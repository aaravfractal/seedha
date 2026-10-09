"""Claude, used only for reading and wording (CLAUDE.md section 3).

Claude never produces a rupee value shown to the owner (rule 1): statement
rows it reads are grounded against the source and math-checked, and any
sentence it writes is built around numbers computed by plain code.
Without ANTHROPIC_API_KEY every caller gets None and uses its fallback.
"""

from __future__ import annotations

import json
import logging

import anthropic

from app.config import Settings
from app.services.parser import ReaderUnavailableError, StatementReader

logger = logging.getLogger("seedha.llm")

ROW_SCHEMA: dict[str, object] = {
    "type": "object",
    "properties": {
        "channel": {
            "type": "string",
            "description": "MakeMyTrip, Booking.com, Agoda, Travel agent, Walk-in or Direct",
        },
        "rows": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "ref": {"type": "string"},
                    "guest_name": {"type": "string"},
                    "guest_city": {"type": "string"},
                    "check_in": {"type": "string", "description": "YYYY-MM-DD"},
                    "nights": {"type": "integer"},
                    "status": {"type": "string", "enum": ["stay", "cancelled"]},
                    "list_amount": {"type": "string"},
                    "discount": {"type": "string"},
                    "commission": {"type": "string"},
                    "gst_on_commission": {"type": "string"},
                    "fees": {"type": "string"},
                    "tds": {"type": "string"},
                    "tcs": {"type": "string"},
                    "payout": {"type": "string"},
                },
                "required": [
                    "ref",
                    "guest_name",
                    "guest_city",
                    "check_in",
                    "nights",
                    "status",
                    "list_amount",
                    "discount",
                    "commission",
                    "gst_on_commission",
                    "fees",
                    "tds",
                    "tcs",
                    "payout",
                ],  # fmt: skip
                "additionalProperties": False,
            },
        },
    },
    "required": ["channel", "rows"],
    "additionalProperties": False,
}

EXTRACT_SYSTEM = (
    "You read hotel booking-channel payout statements and registers. Return one row per "
    "booking, cancellation or adjustment line. Copy every amount exactly as printed in the "
    "file (keep commas and decimals); never calculate, round or infer an amount. Use '0' "
    "only when the line has no such column. status is 'cancelled' for cancelled lines, else "
    "'stay'. check_in must be YYYY-MM-DD. Skip headers, totals and summary lines."
)


class ClaudeStatementReader:
    """StatementReader backed by the Anthropic Messages API."""

    def __init__(self, api_key: str, model: str, client: anthropic.Anthropic | None = None) -> None:
        self._client = client or anthropic.Anthropic(api_key=api_key, timeout=600.0, max_retries=2)
        self._model = model

    def extract(self, text: str, filename: str) -> dict[str, object]:
        """Stream a structured extraction so long statements do not time out."""
        try:
            with self._client.messages.stream(
                model=self._model,
                max_tokens=64_000,
                system=EXTRACT_SYSTEM,
                messages=[{
                    "role": "user",
                    "content": f"File name: {filename}\n\n<statement>\n{text}\n</statement>",
                }],
                output_config={"format": {"type": "json_schema", "schema": ROW_SCHEMA}},
            ) as stream:  # fmt: skip
                message = stream.get_final_message()
        except anthropic.APIConnectionError as exc:
            raise ReaderUnavailableError("Claude could not be reached. Try again.") from exc
        except anthropic.RateLimitError as exc:
            raise ReaderUnavailableError("Claude is busy right now. Try again shortly.") from exc
        except anthropic.APIStatusError as exc:
            logger.warning("Claude extraction failed with status %s", exc.status_code)
            raise ReaderUnavailableError("Claude could not read this file.") from exc
        if message.stop_reason != "end_turn":
            logger.warning("Claude extraction stopped: %s", message.stop_reason)
            raise ReaderUnavailableError("Claude could not finish reading this file.")
        text_block = next((b.text for b in message.content if b.type == "text"), "")
        try:
            payload = json.loads(text_block)
        except json.JSONDecodeError as exc:
            raise ReaderUnavailableError("Claude returned an unreadable answer.") from exc
        if not isinstance(payload, dict):
            raise ReaderUnavailableError("Claude returned an unreadable answer.")
        return payload


def statement_reader(settings: Settings) -> StatementReader | None:
    """The configured reader, or None in simulated mode."""
    if not settings.llm_enabled:
        return None
    return ClaudeStatementReader(settings.anthropic_api_key, settings.claude_model)
