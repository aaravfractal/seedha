"""Repeat-guest matching: who came back through an OTA after an earlier stay.

Business rules:
* A return booking is an OTA stay inside the ledger range; the earlier stay can
  be any channel, before it.
* "Commission paid twice" is commission + GST on commission of the return
  booking (decision C).
* Scores come from names and cities only. Claude is asked only when the score
  is between 0.6 and 0.8, and only to say same / different / unsure.
* A match is a suggestion until the owner confirms it, at any confidence
  (ruling 7). Matching never touches consent, so a matched guest can never be
  messaged because of it (rule 4).
"""

from __future__ import annotations

import re
from collections import defaultdict
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import date
from typing import Protocol

from rapidfuzz.distance import JaroWinkler

SUGGEST_THRESHOLD = 0.60
TIE_BREAK_UPPER = 0.80
HONORIFICS = frozenset({"mr", "mrs", "ms", "miss", "dr", "shri", "smt", "kumari", "sri"})
GROUP_WORDS = frozenset({"family", "group", "and", "party", "couple", "plus"})
CITY_ALIASES = {"gurgaon": "gurugram", "bombay": "mumbai", "bangalore": "bengaluru",
                "calcutta": "kolkata", "new delhi": "delhi", "allahabad": "prayagraj"}  # fmt: skip
INITIAL_SURNAME_FACTOR = 0.7
INITIAL_FIRST_NAME_SCORE = 0.5
SURNAME_WEIGHT = 0.6
FIRST_NAME_WEIGHT = 0.4
SAME_CITY_BONUS = 0.10
OTHER_CITY_PENALTY = 0.15
MIN_SURNAME_SIMILARITY = 0.90
MIN_FIRST_NAME_SIMILARITY = 0.92


class TieBreaker(Protocol):
    """Answers whether two OTA guest records are the same person."""

    def same_person(self, a: GuestKey, b: GuestKey) -> str:
        """'same', 'different' or 'unsure'."""


@dataclass(frozen=True, slots=True)
class GuestKey:
    """A guest as printed on a statement line."""

    name: str
    city: str | None


@dataclass(frozen=True, slots=True)
class StayRef:
    """A booking reduced to what matching needs."""

    booking_id: int
    check_in: date
    guest: GuestKey


@dataclass(frozen=True, slots=True)
class Candidate:
    """A suggested repeat: the return booking and its best earlier stay."""

    return_booking_id: int
    earlier_booking_id: int
    confidence: float
    llm_opinion: str | None = None


def normalise_tokens(name: str) -> list[str]:
    """Lower-case name tokens without honorifics, group words or punctuation."""
    words = re.sub(r"[^a-z\s.]", " ", name.lower()).replace(".", ". ").split()
    tokens = [w.rstrip(".") for w in words]
    return [t for t in tokens if t and t not in HONORIFICS and t not in GROUP_WORDS]


def normalise_city(city: str | None) -> str | None:
    """Canonical city name, folding old and new names together."""
    if not city:
        return None
    clean = " ".join(city.lower().split())
    return CITY_ALIASES.get(clean, clean)


def _part_similarity(a: str, b: str, initial_score: float) -> float:
    """Similarity of two name parts; a single letter matches its full name."""
    if len(a) == 1 or len(b) == 1:
        return initial_score if a[0] == b[0] else 0.0
    return float(JaroWinkler.normalized_similarity(a, b))


def name_score(a: str, b: str) -> float:
    """0..1 similarity of two guest names, surname weighted most."""
    ta, tb = normalise_tokens(a), normalise_tokens(b)
    if not ta or not tb:
        return 0.0
    surname = _part_similarity(ta[-1], tb[-1], INITIAL_SURNAME_FACTOR)
    full_surnames = len(ta[-1]) > 1 and len(tb[-1]) > 1
    if surname == 0.0 or (full_surnames and surname < MIN_SURNAME_SIMILARITY):
        return 0.0  # different family name: a different person
    if len(ta) == 1 or len(tb) == 1:
        return SURNAME_WEIGHT * surname
    first = _part_similarity(ta[0], tb[0], INITIAL_FIRST_NAME_SCORE)
    both_full = len(ta[0]) > 1 and len(tb[0]) > 1
    if (both_full and first < MIN_FIRST_NAME_SIMILARITY) or first == 0.0:
        return 0.0  # same surname, different first name: a different person
    return SURNAME_WEIGHT * surname + FIRST_NAME_WEIGHT * first


def score(a: GuestKey, b: GuestKey) -> float:
    """Name similarity adjusted for city: same city up, different city down."""
    base = name_score(a.name, b.name)
    if base == 0.0:
        return 0.0
    ca, cb = normalise_city(a.city), normalise_city(b.city)
    if ca and cb:
        base += SAME_CITY_BONUS if ca == cb else -OTHER_CITY_PENALTY
    return max(0.0, min(1.0, base))


def blocking_key(guest: GuestKey) -> str:
    """First letter of the surname, so only plausible pairs are compared."""
    tokens = normalise_tokens(guest.name)
    return tokens[-1][0] if tokens else ""


def best_earlier(ret: StayRef, pool: Iterable[StayRef]) -> tuple[StayRef | None, float]:
    """The highest-scoring stay before `ret`, and its score."""
    best: StayRef | None = None
    best_score = 0.0
    for prior in pool:
        if prior.check_in >= ret.check_in or prior.booking_id == ret.booking_id:
            continue
        value = score(ret.guest, prior.guest)
        if best is None or value > best_score:
            best, best_score = prior, value
    return best, best_score


def find_candidates(
    returns: Sequence[StayRef],
    earlier: Iterable[StayRef],
    tie_breaker: TieBreaker | None = None,
) -> list[Candidate]:
    """Best earlier stay for each return booking, above the threshold."""
    blocks: dict[str, list[StayRef]] = defaultdict(list)
    for stay in earlier:
        blocks[blocking_key(stay.guest)].append(stay)
    found: list[Candidate] = []
    for ret in returns:
        prior, value = best_earlier(ret, blocks.get(blocking_key(ret.guest), []))
        if prior is None or value < SUGGEST_THRESHOLD:
            continue
        opinion = None
        if tie_breaker is not None and value < TIE_BREAK_UPPER:
            opinion = tie_breaker.same_person(ret.guest, prior.guest)
            if opinion == "different":
                continue
        found.append(Candidate(ret.booking_id, prior.booking_id, value, opinion))
    return found


def as_percent(confidence: float) -> int:
    """Confidence 0..1 as a whole percent for display (not money)."""
    return int(confidence * 100 + 0.5)
