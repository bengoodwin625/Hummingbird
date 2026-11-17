"""Pure scoring rules: answer timing, speed bands and points. No I/O."""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

READ_PHASE_MS = 3_000
ANSWER_LIMIT_MS = 15_000
TIMEOUT_GRACE_MS = 1_000
LATENCY_ALLOWANCE_MS = 300
QUESTIONS_PER_DAY = 8


class Band(StrEnum):
    HUMMINGBIRD = "hummingbird"
    JAGUAR = "jaguar"
    TOUCAN = "toucan"
    TREE_FROG = "tree_frog"
    SLOTH = "sloth"


@dataclass(frozen=True)
class BandRule:
    band: Band
    max_ms: int | None  # inclusive upper bound; None means no upper bound
    points: int


# Tuned so a perfect day is rare: a Hummingbird is an achievement that needs a correct answer
# within 0.5 s of the options appearing, and the points fall away steeply, so most totals land
# in the middle.
BAND_RULES: tuple[BandRule, ...] = (
    BandRule(Band.HUMMINGBIRD, 500, 1_000),
    BandRule(Band.JAGUAR, 1_200, 700),
    BandRule(Band.TOUCAN, 2_500, 450),
    BandRule(Band.TREE_FROG, 4_500, 250),
    BandRule(Band.SLOTH, None, 100),
)

# Typing takes longer than tapping, so typed answers get this much time off before banding.
# The time shown to the player is always the real time.
TYPING_ALLOWANCE_MS: dict[str, int] = {"choice": 0, "number": 1_500, "text": 2_500}

MAX_POINTS_PER_QUESTION = BAND_RULES[0].points
MAX_POINTS_PER_DAY = MAX_POINTS_PER_QUESTION * QUESTIONS_PER_DAY


class Outcome(StrEnum):
    CORRECT = "correct"
    WRONG = "wrong"
    TIMEOUT = "timeout"


@dataclass(frozen=True)
class Score:
    outcome: Outcome
    elapsed_ms: int | None
    band: Band | None
    points: int


def elapsed_ms(answer_open_ms: int, received_ms: int) -> int:
    """Server-measured answer time, with the latency allowance, floored at 0 and capped."""
    raw = received_ms - answer_open_ms - LATENCY_ALLOWANCE_MS
    return max(0, min(raw, ANSWER_LIMIT_MS))


def is_too_early(answer_open_ms: int, received_ms: int) -> bool:
    """An answer before the answer phase opens is invalid and doesn't use the player's go."""
    return received_ms < answer_open_ms


def is_timed_out(answer_open_ms: int, now_ms: int) -> bool:
    """True once the answer limit plus the grace second has passed."""
    return now_ms - answer_open_ms > ANSWER_LIMIT_MS + TIMEOUT_GRACE_MS


def band_for(elapsed: int) -> Band:
    """Speed band for a correct answer. Boundaries belong to the faster band."""
    if elapsed < 0:
        raise ValueError("elapsed must not be negative")
    for rule in BAND_RULES:
        if rule.max_ms is None or elapsed <= rule.max_ms:
            return rule.band
    raise AssertionError("unreachable: the last band has no upper bound")


def points_for(band: Band) -> int:
    for rule in BAND_RULES:
        if rule.band == band:
            return rule.points
    raise ValueError(f"unknown band {band!r}")


def banding_time(elapsed: int, question_type: str = "choice") -> int:
    """The time used to pick a band: the real time minus the typing allowance, floored at 0."""
    if question_type not in TYPING_ALLOWANCE_MS:
        raise ValueError(f"unknown question type {question_type!r}")
    return max(0, elapsed - TYPING_ALLOWANCE_MS[question_type])


def score_answer(correct: bool, elapsed: int, question_type: str = "choice") -> Score:
    """Score one answered question. Points come only from the speed band.

    `elapsed` is the real answer time and is what gets stored and shown; typed questions are
    banded on `banding_time`, which allows for typing.
    """
    if not correct:
        return Score(Outcome.WRONG, elapsed, None, 0)
    band = band_for(banding_time(elapsed, question_type))
    return Score(Outcome.CORRECT, elapsed, band, points_for(band))


def score_timeout() -> Score:
    return Score(Outcome.TIMEOUT, None, None, 0)
