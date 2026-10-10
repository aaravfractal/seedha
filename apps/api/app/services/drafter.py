"""Win-back message drafts.

Every draft must contain the guest's perk code, the booking link and the exact
words "Reply STOP to opt out" (rule 5), and must not contain any money amount
or percentage (rule 1). Claude may word the message; if its wording breaks any
of these checks, or Claude is not configured, a fixed template is used.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Protocol

import anthropic

logger = logging.getLogger("seedha.drafter")

STOP_LINE = "Reply STOP to opt out."
MAX_LENGTH = 600
# ₹, "rs"/"inr"/"rupee", percentages, and (D6) any number of 3 or more
# digits, so a money figure cannot slip in without a currency sign.
MONEY_PATTERN = re.compile(
    r"(₹|\brs\.?\s*\d|\binr\b|\d\s*%|\brupees?\b|\d[\d,]*\d[\d,]*\d)", re.IGNORECASE
)


# Any web address. Guest messages may carry only the guest's own perk link
# (security review S2: no phishing links in owner-edited or away text).
WEB_ADDRESS = re.compile(
    r"(https?://\S+|www\.\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|in|net|org|co|io|app|me|"
    r"link|info|biz|xyz|ly|gl)\b\S*)",
    re.IGNORECASE,
)


@dataclass(frozen=True, slots=True)
class DraftFacts:
    """Everything a draft may mention. No amounts on purpose."""

    short_name: str
    hotel: str
    perk_promise: str
    code: str
    link: str


class Wording(Protocol):
    """Writes a draft from facts (Claude), or None when it cannot."""

    def word(self, facts: DraftFacts) -> str | None:
        """A candidate message body."""


def template(facts: DraftFacts) -> str:
    """The fixed wording, as in the prototype."""
    return (
        f"Namaste {facts.short_name}, thank you for staying at {facts.hotel}. Book your next "
        f"stay directly with us and {facts.perk_promise}. Code {facts.code}: {facts.link} "
        f"{STOP_LINE}"
    )


def acceptable(body: str, facts: DraftFacts) -> bool:
    """Claude's wording is used only if every rule holds."""
    without_link = body.replace(facts.link, "")
    return (
        len(body) <= MAX_LENGTH
        and facts.code in without_link
        and facts.link in body
        and body.rstrip().endswith(STOP_LINE)
        and MONEY_PATTERN.search(body.replace(facts.link, "").replace(facts.code, "")) is None
    )


def draft_body(facts: DraftFacts, wording: Wording | None) -> str:
    """Claude's wording when it passes the checks, else the template."""
    if wording is not None:
        candidate = wording.word(facts)
        if candidate and acceptable(candidate.strip(), facts):
            return candidate.strip()
        logger.info("Draft wording rejected or unavailable; using the template")
    return template(facts)


WORDING_SYSTEM = (
    "You write one short, warm WhatsApp message from a small Indian hill hotel to a guest "
    "who just checked out and agreed to receive offers. Use the guest's name as given. "
    "Mention the perk exactly as given, include the code and the link exactly as given, and "
    f"end with exactly: {STOP_LINE} Never mention prices, discounts, amounts or percentages. "
    "Plain text, no emojis, at most 60 words. Return only the message."
)


class ClaudeWording:
    """Wording by Claude; any failure returns None so the template is used."""

    def __init__(self, api_key: str, model: str, client: anthropic.Anthropic | None = None) -> None:
        self._client = client or anthropic.Anthropic(api_key=api_key, timeout=60.0, max_retries=2)
        self._model = model

    def word(self, facts: DraftFacts) -> str | None:
        """One candidate body, or None."""
        prompt = (
            f"Guest: {facts.short_name}\nHotel: {facts.hotel}\nPerk: {facts.perk_promise}\n"
            f"Code: {facts.code}\nLink: {facts.link}"
        )
        try:
            message = self._client.messages.create(
                model=self._model,
                max_tokens=1_000,
                system=WORDING_SYSTEM,
                messages=[{"role": "user", "content": prompt}],
            )
        except anthropic.APIError:
            logger.warning("Claude wording unavailable")
            return None
        if message.stop_reason != "end_turn":
            return None
        return next((b.text for b in message.content if b.type == "text"), None)
