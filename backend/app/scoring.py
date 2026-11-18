"""Pure scoring rules: answer timing, speed bands and points. No I/O."""

from __future__ import annotations

import math
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


def elapsed_ms(answer_open_ms: int, received_ms: int, limit_ms: int = ANSWER_LIMIT_MS) -> int:
    """Server-measured answer time, with the latency allowance, floored at 0 and capped."""
    raw = received_ms - answer_open_ms - LATENCY_ALLOWANCE_MS
    return max(0, min(raw, limit_ms))


def is_too_early(answer_open_ms: int, received_ms: int) -> bool:
    """An answer before the answer phase opens is invalid and doesn't use the player's go."""
    return received_ms < answer_open_ms


def is_timed_out(answer_open_ms: int, now_ms: int, limit_ms: int = ANSWER_LIMIT_MS) -> bool:
    """True once the answer limit plus the grace second has passed."""
    return now_ms - answer_open_ms > limit_ms + TIMEOUT_GRACE_MS


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


DISTRIBUTION_BUCKET = 500
"""Width, in points, of each bucket in the day's score distribution (16 buckets up to 8,000)."""


def score_distribution(
    scores: list[int], bucket: int = DISTRIBUTION_BUCKET, max_score: int = MAX_POINTS_PER_DAY
) -> list[int]:
    """Count of daily totals in each bucket from 0 to the daily maximum.

    Bucket i covers [i * bucket, (i + 1) * bucket); a perfect score falls in the last bucket.
    """
    buckets = max_score // bucket
    counts = [0] * buckets
    for score in scores:
        index = min(max(score, 0) // bucket, buckets - 1)
        counts[index] += 1
    return counts


# ---------------------------------------------------------------- the Numbers quiz
#
# Five questions whose answers are obscure numbers. A guess earns a closeness score from 100
# (spot on) down to 0, and the answer's speed animal multiplies it. Typing a considered guess
# takes longer than tapping, so the answer window and the animal timings are longer.

NUMBERS_QUESTIONS_PER_DAY = 5
NUMBERS_ANSWER_LIMIT_MS = 30_000
NUMBERS_DEFAULT_SPREAD = 0.6
"""How far off, as a power of ten, a guess can be before it scores nothing: 0.6 is about 4x."""


@dataclass(frozen=True)
class NumbersBandRule:
    band: Band
    max_ms: int | None
    multiplier: float


NUMBERS_BAND_RULES: tuple[NumbersBandRule, ...] = (
    NumbersBandRule(Band.HUMMINGBIRD, 4_000, 2.0),
    NumbersBandRule(Band.JAGUAR, 7_000, 1.7),
    NumbersBandRule(Band.TOUCAN, 11_000, 1.45),
    NumbersBandRule(Band.TREE_FROG, 17_000, 1.2),
    NumbersBandRule(Band.SLOTH, None, 1.0),
)

NUMBERS_MAX_PER_QUESTION = round(100 * NUMBERS_BAND_RULES[0].multiplier)
NUMBERS_MAX_PER_DAY = NUMBERS_MAX_PER_QUESTION * NUMBERS_QUESTIONS_PER_DAY


@dataclass(frozen=True)
class NumbersScore:
    outcome: Outcome
    elapsed_ms: int | None
    closeness: int
    band: Band | None
    multiplier: float
    points: int


def closeness(guess: float, answer: float, spread: float = NUMBERS_DEFAULT_SPREAD) -> int:
    """How close a guess is, from 100 (exact) to 0, judged by ratio so it is fair for both
    small and huge answers: 10% off scores about 93, double or half about 50, and anything
    out by a factor of 10**spread (about 4x by default) or more scores 0."""
    if spread <= 0:
        raise ValueError("spread must be positive")
    if guess <= 0 or answer <= 0:
        return 0
    error = abs(math.log10(guess / answer))
    return max(0, round(100 * (1 - error / spread)))


def numbers_band_for(elapsed: int) -> NumbersBandRule:
    if elapsed < 0:
        raise ValueError("elapsed must not be negative")
    for rule in NUMBERS_BAND_RULES:
        if rule.max_ms is None or elapsed <= rule.max_ms:
            return rule
    raise AssertionError("unreachable: the last band has no upper bound")


def score_numbers(
    guess: float, answer: float, elapsed: int, spread: float = NUMBERS_DEFAULT_SPREAD
) -> NumbersScore:
    """Closeness times the speed animal's multiplier. A guess that scores no closeness earns
    no animal and no points."""
    close = closeness(guess, answer, spread)
    if close == 0:
        return NumbersScore(Outcome.WRONG, elapsed, 0, None, 0.0, 0)
    rule = numbers_band_for(elapsed)
    points = round(close * rule.multiplier)
    return NumbersScore(Outcome.CORRECT, elapsed, close, rule.band, rule.multiplier, points)


def score_numbers_timeout() -> NumbersScore:
    return NumbersScore(Outcome.TIMEOUT, None, 0, None, 0.0, 0)

NUMBERS_DISTRIBUTION_BUCKET = 50
"""Width, in points, of each bucket in the How Close quiz's score curve (20 buckets to 1,000)."""
