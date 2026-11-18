"""The Numbers quiz: five questions a day whose answers are obscure numbers.

A guess scores 0–100 for closeness (by ratio, so it's fair to small and huge answers), and the
speed animal multiplies it (up to 2x). It shares the speed quiz's day, clock, read phase and
anti-cheat rules, with a longer answer window, and keeps its plays apart (mode "numbers").
The server holds the answers: none is sent until that question is answered or timed out.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models
from .checking import is_blank, parse_number
from .daily import next_unlock, quiz_date
from .main import (
    ApiError,
    ClockDep,
    LimitedPlayerDep,
    PlayerDep,
    SessionDep,
    _format_number,
    _ms,
)
from .scoring import (
    NUMBERS_ANSWER_LIMIT_MS,
    NUMBERS_BAND_RULES,
    NUMBERS_DEFAULT_SPREAD,
    NUMBERS_DISTRIBUTION_BUCKET,
    NUMBERS_MAX_PER_DAY,
    NUMBERS_QUESTIONS_PER_DAY,
    READ_PHASE_MS,
    TIMEOUT_GRACE_MS,
    NumbersScore,
    Outcome,
    closeness,
    elapsed_ms,
    is_timed_out,
    is_too_early,
    score_distribution,
    score_numbers,
    score_numbers_timeout,
)

router = APIRouter(prefix="/api/numbers")

MODE = "numbers"
MULTIPLIERS = {rule.band.value: rule.multiplier for rule in NUMBERS_BAND_RULES}

Status = Literal["no_quiz", "not_started", "in_progress", "finished"]


# ---------------------------------------------------------------- schemas


class NumbersQuestionOut(BaseModel):
    slot: int
    total: int
    category: str
    text: str
    read_remaining_ms: int
    answer_limit_ms: int


class NumbersRevealOut(BaseModel):
    slot: int
    outcome: Literal["correct", "wrong", "timeout"]
    your_guess: str | None
    answer: str
    closeness: int
    band: str | None
    multiplier: float
    points: int
    bullseye: bool
    bonus: int
    elapsed_ms: int | None
    total_score: int
    finished: bool


class NumbersServeOut(BaseModel):
    kind: Literal["question", "reveal"]
    question: NumbersQuestionOut | None = None
    reveal: NumbersRevealOut | None = None


class NumbersSlotOut(BaseModel):
    slot: int
    band: str | None
    closeness: int
    points: int


class NumbersTodayOut(BaseModel):
    date: date
    number: int | None
    status: Status
    total_score: int
    answered: list[NumbersSlotOut]
    next_slot: int | None
    question_live: bool
    total_questions: int
    max_score: int
    next_unlock_at: datetime


class GuessIn(BaseModel):
    slot: int
    value: str


class SlotIn(BaseModel):
    slot: int


class NumbersResultOut(BaseModel):
    slot: int
    category: str
    text: str
    your_guess: str | None
    answer: str
    closeness: int
    band: str | None
    multiplier: float
    points: int
    bullseye: bool
    bonus: int
    elapsed_ms: int | None
    outcome: Literal["correct", "wrong", "timeout"]


class NumbersResultsOut(BaseModel):
    date: date
    number: int
    total_score: int
    max_score: int
    avg_closeness: int
    questions: list[NumbersResultOut]
    better_than_percent: int | None
    average_score: int | None
    others: bool
    """Whether anyone else has finished today (never how many)."""
    distribution: list[int]
    bucket_size: int
    avg_elapsed_ms: int | None
    everyone_avg_ms: int | None
    next_unlock_at: datetime


# ---------------------------------------------------------------- helpers


def _day(session: Session, clock: Callable[[], datetime]) -> models.Day | None:
    """Today's day, if it has a Numbers quiz."""
    day = session.get(models.Day, quiz_date(clock()))
    if day is None or not any(q.mode == MODE for q in day.questions):
        return None
    return day


def _require_day(session: Session, clock: Callable[[], datetime]) -> models.Day:
    day = _day(session, clock)
    if day is None:
        raise ApiError(404, "no_quiz", "There's no Numbers quiz today. Check back tomorrow.")
    return day


def _play(session: Session, player: models.Player, day: date) -> models.Play | None:
    return session.scalar(
        select(models.Play).where(
            models.Play.player_id == player.id, models.Play.date == day, models.Play.mode == MODE
        )
    )


def _question(day: models.Day, slot: int) -> models.Question:
    for question in day.questions:
        if question.mode == MODE and question.slot == slot:
            return question
    raise ApiError(500, "missing_question", f"Numbers question {slot} is missing.")


def _answer(question: models.Question) -> tuple[Decimal, float]:
    assert question.number_answer is not None
    spread = question.number_answer.spread
    return Decimal(question.number_answer.value), float(
        spread
    ) if spread else NUMBERS_DEFAULT_SPREAD


def _closeness(question: models.Question, sub: models.Submission) -> int:
    """Recomputed from the stored guess; content is locked once played, so it never drifts."""
    if sub.raw_input is None or sub.outcome == Outcome.TIMEOUT:
        return 0
    guess = parse_number(sub.raw_input)
    if guess is None:
        return 0
    answer, spread = _answer(question)
    return closeness(float(guess), float(answer), spread)


def _open(play: models.Play) -> models.Submission | None:
    return next((s for s in play.submissions if s.outcome is None), None)


def _submission(play: models.Play, slot: int) -> models.Submission:
    for sub in play.submissions:
        if sub.slot == slot:
            return sub
    raise ApiError(409, "not_served", "That question hasn't been served yet.")


def _resolve(
    session: Session, play: models.Play, sub: models.Submission, score: NumbersScore, now: datetime
) -> None:
    sub.outcome = score.outcome.value
    sub.correct = score.outcome == Outcome.CORRECT
    sub.elapsed_ms = score.elapsed_ms
    sub.speed_band = score.band.value if score.band else None
    sub.points = score.points
    sub.bonus = score.bonus
    if sub.received_at is None and score.outcome != Outcome.TIMEOUT:
        sub.received_at = now
    play.total_score += score.points
    if sub.slot >= NUMBERS_QUESTIONS_PER_DAY:
        play.finished_at = now
    session.commit()


def _reveal(
    question: models.Question, sub: models.Submission, play: models.Play
) -> NumbersRevealOut:
    answer, _ = _answer(question)
    return NumbersRevealOut(
        slot=sub.slot,
        outcome=sub.outcome,  # type: ignore[arg-type]
        your_guess=sub.raw_input,
        answer=_format_number(answer),
        closeness=_closeness(question, sub),
        band=sub.speed_band,
        multiplier=MULTIPLIERS.get(sub.speed_band or "", 0.0),
        points=sub.points,
        bullseye=sub.bonus > 0,
        bonus=sub.bonus,
        elapsed_ms=sub.elapsed_ms,
        total_score=play.total_score,
        finished=play.finished_at is not None,
    )


def _question_out(
    question: models.Question, sub: models.Submission, now: datetime
) -> NumbersQuestionOut:
    return NumbersQuestionOut(
        slot=question.slot,
        total=NUMBERS_QUESTIONS_PER_DAY,
        category=question.category,
        text=question.text,
        read_remaining_ms=max(0, _ms(sub.answer_open_at) - _ms(now)),
        answer_limit_ms=NUMBERS_ANSWER_LIMIT_MS,
    )


def _timed_out(sub: models.Submission, now: datetime) -> bool:
    return is_timed_out(_ms(sub.answer_open_at), _ms(now), NUMBERS_ANSWER_LIMIT_MS)


# ---------------------------------------------------------------- routes


@router.get("/today", response_model=NumbersTodayOut)
def today(session: SessionDep, player: PlayerDep, clock: ClockDep) -> NumbersTodayOut:
    now = clock()
    day_date = quiz_date(now)
    day = _day(session, clock)
    play = _play(session, player, day_date) if day is not None else None
    live = False
    answered: list[NumbersSlotOut] = []
    if play is not None and day is not None:
        open_sub = _open(play)
        if open_sub is not None and _timed_out(open_sub, now):
            _resolve(session, play, open_sub, score_numbers_timeout(), now)
            open_sub = None
        live = open_sub is not None
        answered = [
            NumbersSlotOut(
                slot=s.slot,
                band=s.speed_band,
                closeness=_closeness(_question(day, s.slot), s),
                points=s.points,
            )
            for s in play.submissions
            if s.outcome is not None
        ]
    if day is None:
        status: Status = "no_quiz"
    elif play is None:
        status = "not_started"
    elif play.finished_at is not None:
        status = "finished"
    else:
        status = "in_progress"
    next_slot = None
    if day is not None and status != "finished":
        next_slot = (len(play.submissions) if play else 0) + (0 if live else 1)
    return NumbersTodayOut(
        date=day_date,
        number=day.number if day else None,
        status=status,
        total_score=play.total_score if play else 0,
        answered=answered,
        next_slot=next_slot,
        question_live=live,
        total_questions=NUMBERS_QUESTIONS_PER_DAY,
        max_score=NUMBERS_MAX_PER_DAY,
        next_unlock_at=next_unlock(now),
    )


@router.post("/ready", response_model=NumbersServeOut)
def ready(session: SessionDep, player: LimitedPlayerDep, clock: ClockDep) -> NumbersServeOut:
    """Serve the next question (or the live one after a reload)."""
    now = clock()
    day = _require_day(session, clock)
    play = _play(session, player, day.date)
    if play is None:
        play = models.Play(
            player_id=player.id, date=day.date, mode=MODE, started_at=now, total_score=0
        )
        session.add(play)
        session.flush()
    if play.finished_at is not None:
        raise ApiError(409, "finished", "You've already played today's Numbers quiz.")
    open_sub = _open(play)
    if open_sub is not None:
        question = _question(day, open_sub.slot)
        if _timed_out(open_sub, now):
            _resolve(session, play, open_sub, score_numbers_timeout(), now)
            return NumbersServeOut(kind="reveal", reveal=_reveal(question, open_sub, play))
        session.commit()
        return NumbersServeOut(kind="question", question=_question_out(question, open_sub, now))
    slot = len(play.submissions) + 1
    question = _question(day, slot)
    sub = models.Submission(
        play_id=play.id,
        slot=slot,
        served_at=now,
        answer_open_at=now + timedelta(milliseconds=READ_PHASE_MS),
        points=0,
        correct=False,
    )
    play.submissions.append(sub)
    session.commit()
    return NumbersServeOut(kind="question", question=_question_out(question, sub, now))


@router.post("/answer", response_model=NumbersRevealOut)
def answer(
    body: GuessIn, session: SessionDep, player: LimitedPlayerDep, clock: ClockDep
) -> NumbersRevealOut:
    now = clock()
    day = _require_day(session, clock)
    play = _play(session, player, day.date)
    if play is None:
        raise ApiError(409, "not_started", "Start today's Numbers quiz first.")
    sub = _submission(play, body.slot)
    question = _question(day, body.slot)
    if sub.outcome is not None:
        return _reveal(question, sub, play)
    open_ms, now_ms = _ms(sub.answer_open_at), _ms(now)
    if is_too_early(open_ms, now_ms):
        raise ApiError(409, "too_early", "Answers open after the reading time.")
    if _timed_out(sub, now):
        _resolve(session, play, sub, score_numbers_timeout(), now)
        return _reveal(question, sub, play)
    raw = body.value.strip()
    if is_blank(raw):
        raise ApiError(422, "blank", "Type a guess.")
    guess = parse_number(raw)
    if guess is None:
        raise ApiError(422, "not_a_number", "Type a number, like 42 or 1,000.")
    sub.raw_input = raw[:200]
    sub.received_at = now
    target, spread = _answer(question)
    score = score_numbers(
        float(guess), float(target), elapsed_ms(open_ms, now_ms, NUMBERS_ANSWER_LIMIT_MS), spread
    )
    _resolve(session, play, sub, score, now)
    return _reveal(question, sub, play)


@router.post("/timeout", response_model=NumbersRevealOut)
def timeout(
    body: SlotIn, session: SessionDep, player: LimitedPlayerDep, clock: ClockDep
) -> NumbersRevealOut:
    """Resolve as out of time, but only once the server's limit has really passed."""
    now = clock()
    day = _require_day(session, clock)
    play = _play(session, player, day.date)
    if play is None:
        raise ApiError(409, "not_started", "Start today's Numbers quiz first.")
    sub = _submission(play, body.slot)
    question = _question(day, body.slot)
    if sub.outcome is None:
        if not _timed_out(sub, now):
            retry = (
                _ms(sub.answer_open_at) + NUMBERS_ANSWER_LIMIT_MS + TIMEOUT_GRACE_MS - _ms(now) + 1
            )
            raise ApiError(409, "not_yet", "There's still time.", retry_after_ms=max(1, retry))
        _resolve(session, play, sub, score_numbers_timeout(), now)
    return _reveal(question, sub, play)


@router.get("/results", response_model=NumbersResultsOut)
def results(session: SessionDep, player: PlayerDep, clock: ClockDep) -> NumbersResultsOut:
    now = clock()
    day = _require_day(session, clock)
    play = _play(session, player, day.date)
    if play is None or play.finished_at is None:
        raise ApiError(409, "not_finished", "Finish today's Numbers quiz to see the results.")
    rows = []
    for sub in sorted(play.submissions, key=lambda s: s.slot):
        question = _question(day, sub.slot)
        answer_value, _ = _answer(question)
        rows.append(
            NumbersResultOut(
                slot=sub.slot,
                category=question.category,
                text=question.text,
                your_guess=sub.raw_input,
                answer=_format_number(answer_value),
                closeness=_closeness(question, sub),
                band=sub.speed_band,
                multiplier=MULTIPLIERS.get(sub.speed_band or "", 0.0),
                points=sub.points,
                bullseye=sub.bonus > 0,
                bonus=sub.bonus,
                elapsed_ms=sub.elapsed_ms,
                outcome=sub.outcome,  # type: ignore[arg-type]
            )
        )
    finished = list(
        session.scalars(
            select(models.Play).where(
                models.Play.date == day.date,
                models.Play.mode == MODE,
                models.Play.finished_at.is_not(None),
            )
        )
    )
    others = [p.total_score for p in finished if p.id != play.id]
    everyone = [*others, play.total_score]

    def avg_time(p: models.Play) -> float | None:
        times = [
            s.elapsed_ms
            for s in p.submissions
            if s.outcome != "timeout" and s.elapsed_ms is not None
        ]
        return sum(times) / len(times) if times else None

    mine = avg_time(play)
    all_times = [t for t in (avg_time(p) for p in finished) if t is not None]
    return NumbersResultsOut(
        date=day.date,
        number=day.number,
        total_score=play.total_score,
        max_score=NUMBERS_MAX_PER_DAY,
        avg_closeness=round(sum(r.closeness for r in rows) / len(rows)) if rows else 0,
        questions=rows,
        better_than_percent=(
            round(100 * sum(1 for s in others if s < play.total_score) / len(others))
            if others
            else None
        ),
        average_score=round(sum(everyone) / len(everyone)) if others else None,
        others=bool(others),
        distribution=score_distribution(everyone, NUMBERS_DISTRIBUTION_BUCKET, NUMBERS_MAX_PER_DAY),
        bucket_size=NUMBERS_DISTRIBUTION_BUCKET,
        avg_elapsed_ms=round(mine) if mine is not None else None,
        everyone_avg_ms=round(sum(all_times) / len(all_times)) if others and all_times else None,
        next_unlock_at=next_unlock(now),
    )
