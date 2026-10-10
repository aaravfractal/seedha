"""Seedha Assistant: questions answered only from computed ledger figures."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from app.deps import OwnerDep, PropertyDep, SessionDep, SettingsDep
from app.routers.scenario import DEFAULT_ROOMS, latest_decision
from app.services.ask import Phraser
from app.services.assistant import ClaudeAssistantPhraser, ask_assistant, chips_after
from app.services.desk import business_date, utc_now

router = APIRouter(prefix="/assistant", tags=["assistant"])

READING = ("Money kept", "Repeat guests", "Savings", "Saturday move", "Payouts", "Desk close")
FOOTER = "From your statements"


class SourceOut(BaseModel):
    """Which figures an answer used, and the screen that shows them."""

    label: str
    href: str


class IntroOut(BaseModel):
    """The opening line, what the Assistant reads, and suggestion chips."""

    greeting: str
    reading: list[str]
    suggestions: list[str]


class AskIn(BaseModel):
    """A free-text owner question (matched to a fixed intent)."""

    question: str = Field(min_length=1, max_length=300)


class ReplyOut(BaseModel):
    """An answer whose numbers were all inserted by code."""

    question: str
    intent: str
    answer: str
    figures: list[str]
    sources: list[SourceOut]
    suggestions: list[str]
    worded_by: str
    footer: str


def get_assistant_phraser(request: Request, settings: SettingsDep) -> Phraser | None:
    """Claude rewording, overridable in tests via app.state.assistant_phraser."""
    override: Phraser | None = getattr(request.app.state, "assistant_phraser", None)
    if override is not None:
        return override
    if not settings.llm_enabled:
        return None
    return ClaudeAssistantPhraser(settings.anthropic_api_key, settings.claude_model)


AssistantPhraserDep = Annotated[Phraser | None, Depends(get_assistant_phraser)]


@router.get("", response_model=IntroOut)
def intro(_owner: OwnerDep, prop: PropertyDep) -> IntroOut:
    """Greeting and suggestion chips."""
    return IntroOut(
        greeting=(f"Namaste {prop.owner_name} ji. I have read your statements, repeat guests, "
                  "savings and the Saturday move. Ask about any number."),
        reading=list(READING),
        suggestions=list(chips_after(None)),
    )  # fmt: skip


@router.post("", response_model=ReplyOut)
def ask(
    body: AskIn, _owner: OwnerDep, session: SessionDep, prop: PropertyDep,
    phraser: AssistantPhraserDep,
) -> ReplyOut:  # fmt: skip
    """Match the question to a fixed intent and answer with computed numbers."""
    day = business_date(session, prop.id, utc_now().date())
    last = latest_decision(session, prop.id)
    rooms = min(last.rooms if last else DEFAULT_ROOMS, prop.rooms_count)
    reply = ask_assistant(session, prop, body.question, day, rooms, phraser)
    return ReplyOut(
        question=body.question,
        intent=reply.intent,
        answer=reply.answer,
        figures=list(reply.figures),
        sources=[SourceOut(label=s.label, href=s.href) for s in reply.sources],
        suggestions=list(reply.suggestions),
        worded_by=reply.worded_by,
        footer=FOOTER,
    )
