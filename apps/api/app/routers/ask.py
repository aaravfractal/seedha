"""Ask: six fixed questions, answered by code from the owner's own data."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from app.deps import OwnerDep, PropertyDep, SessionDep, SettingsDep
from app.errors import ApiError
from app.services.ask import (
    QUESTION_BY_KEY,
    QUESTIONS,
    ClaudePhraser,
    Phraser,
    compute_answer,
    phrased,
)
from app.services.desk import business_date, utc_now

router = APIRouter(prefix="/ask", tags=["ask"])


class QuestionOut(BaseModel):
    """A question chip."""

    key: str
    hi: str
    en: str


class AnswerOut(BaseModel):
    """The answer in Hindi (possibly reworded) and English, plus its figures."""

    key: str
    question: str
    answer: str
    answer_en: str
    figures: list[str]
    source: str


def get_phraser(request: Request, settings: SettingsDep) -> Phraser | None:
    """Claude phrasing, overridable in tests via app.state.phraser."""
    override: Phraser | None = getattr(request.app.state, "phraser", None)
    if override is not None:
        return override
    if not settings.llm_enabled:
        return None
    return ClaudePhraser(settings.anthropic_api_key, settings.claude_model)


PhraserDep = Annotated[Phraser | None, Depends(get_phraser)]


@router.get("", response_model=list[QuestionOut])
def list_questions(_owner: OwnerDep) -> list[QuestionOut]:
    """The six questions, in the prototype's order."""
    return [QuestionOut(key=q.key, hi=q.hi, en=q.en) for q in QUESTIONS]


@router.post("/{key}", response_model=AnswerOut)
def ask(
    key: str, _owner: OwnerDep, session: SessionDep, prop: PropertyDep, phraser: PhraserDep
) -> AnswerOut:
    """Compute the answer; Claude may only reword it with the same numbers."""
    question = QUESTION_BY_KEY.get(key)
    if question is None:
        raise ApiError(404, "no_such_question", "Choose one of the six questions")
    day = business_date(session, prop.id, utc_now().date())
    answer = compute_answer(session, prop, key, day)
    return AnswerOut(
        key=key,
        question=question.hi,
        answer=phrased(answer, question.hi, phraser),
        answer_en=answer.en,
        figures=list(answer.figures),
        source="From your statements",
    )
