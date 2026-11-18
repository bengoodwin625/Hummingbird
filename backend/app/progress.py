"""Pure rules for progress and social features: streaks, the field guide, weekly totals,
display names and share codes. No I/O, so every rule is easy to test."""

from __future__ import annotations

import re
import secrets
import unicodedata
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import date, timedelta

from .scoring import Band

# ---------------------------------------------------------------- streaks

ONE_DAY = timedelta(days=1)


@dataclass(frozen=True)
class Streaks:
    """Days in a row played, and days in a row with at least one Hummingbird."""

    current: int
    best: int
    hummingbird_current: int
    hummingbird_best: int


def _best_run(days: Iterable[date]) -> int:
    best = run = 0
    previous: date | None = None
    for day in sorted(set(days)):
        run = run + 1 if previous is not None and day - previous == ONE_DAY else 1
        best = max(best, run)
        previous = day
    return best


def _current_run(days: set[date], today: date) -> int:
    """A streak is still alive until a whole day is missed: it counts from today if today is
    played, otherwise from yesterday."""
    day = today if today in days else today - ONE_DAY
    run = 0
    while day in days:
        run += 1
        day -= ONE_DAY
    return run


def streaks(played: Iterable[date], hummingbird_days: Iterable[date], today: date) -> Streaks:
    played_set = set(played)
    hummingbird_set = set(hummingbird_days) & played_set
    return Streaks(
        current=_current_run(played_set, today),
        best=_best_run(played_set),
        hummingbird_current=_current_run(hummingbird_set, today),
        hummingbird_best=_best_run(hummingbird_set),
    )


# ---------------------------------------------------------------- field guide

GOLDEN_MS = 300
"""A Hummingbird answered in this real time or less is the rare golden hummingbird."""


@dataclass(frozen=True)
class Catch:
    band: str | None
    elapsed_ms: int | None


@dataclass
class FieldGuide:
    """Every animal a player has caught, plus the rare finds."""

    counts: dict[str, int] = field(default_factory=lambda: {b.value: 0 for b in Band})
    golden: int = 0
    perfect_days: int = 0


def field_guide(days: Iterable[Iterable[Catch]]) -> FieldGuide:
    """`days` holds each finished day's correct answers (one Catch per correct answer)."""
    guide = FieldGuide()
    for day in days:
        correct = 0
        for catch in day:
            if catch.band is None:
                continue
            correct += 1
            guide.counts[catch.band] = guide.counts.get(catch.band, 0) + 1
            if (
                catch.band == Band.HUMMINGBIRD.value
                and catch.elapsed_ms is not None
                and catch.elapsed_ms <= GOLDEN_MS
            ):
                guide.golden += 1
        if correct == 8:
            guide.perfect_days += 1
    return guide


# ---------------------------------------------------------------- weekly league

BEST_DAYS_PER_WEEK = 5


def week_start(day: date) -> date:
    """Weeks run Monday to Sunday."""
    return day - timedelta(days=day.weekday())


def weekly_total(daily_scores: Iterable[int]) -> int:
    """A week's score is the sum of its best five days, so missing a day or two isn't fatal."""
    return sum(sorted(daily_scores, reverse=True)[:BEST_DAYS_PER_WEEK])


# ---------------------------------------------------------------- names and codes

NAME_MIN, NAME_MAX = 2, 20
LEAGUE_NAME_MIN, LEAGUE_NAME_MAX = 2, 30
_NAME_ALLOWED = re.compile(r"^[\w .'\-]+$")


def _clean(raw: str, low: int, high: int, what: str) -> str:
    text = unicodedata.normalize("NFKC", raw)
    text = "".join(ch for ch in text if unicodedata.category(ch)[0] != "C")
    text = " ".join(text.split())
    if len(text) < low or len(text) > high:
        raise ValueError(f"{what} must be {low} to {high} characters")
    if not _NAME_ALLOWED.match(text):
        raise ValueError(f"{what} can only use letters, numbers, spaces and . ' - _")
    return text


def clean_display_name(raw: str) -> str:
    return _clean(raw, NAME_MIN, NAME_MAX, "Your name")


def clean_league_name(raw: str) -> str:
    return _clean(raw, LEAGUE_NAME_MIN, LEAGUE_NAME_MAX, "The league name")


_ANON = ("hummingbird", "jaguar", "toucan", "tree frog", "sloth", "macaw", "tapir", "ocelot")


def anon_name(player_id: str) -> str:
    """A stable stand-in for a player who hasn't chosen a name."""
    return f"Anonymous {_ANON[sum(map(ord, player_id)) % len(_ANON)]}"


CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
"""No 0/O or 1/I, so codes survive being read out or typed from a screenshot."""


def new_code(length: int) -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(length))


def normalise_code(raw: str) -> str:
    """Codes are matched without case, spaces or dashes."""
    return re.sub(r"[^A-Z0-9]", "", raw.upper())


# ---------------------------------------------------------------- combined daily score

SPEED_TO_COMBINED = 8
"""The Speed quiz (up to 8,000) is divided by this so both games weigh about the same."""


def combined_score(speed: int | None, close: int | None) -> int:
    """One number for the day across both games: Speed / 8 plus How Close."""
    return round((speed or 0) / SPEED_TO_COMBINED) + (close or 0)
