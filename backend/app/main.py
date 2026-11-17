"""FastAPI routes for the Hummingbird daily speed quiz."""

from __future__ import annotations

import os
import random
import time
import uuid
from collections import defaultdict, deque
from collections.abc import Callable
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import models
from .checking import build_text_answer, check_number, check_text, is_blank, parse_number
from .daily import next_unlock, quiz_date
from .db import get_session
from .scoring import (
    ANSWER_LIMIT_MS,
    MAX_POINTS_PER_DAY,
    QUESTIONS_PER_DAY,
    READ_PHASE_MS,
    TIMEOUT_GRACE_MS,
    Outcome,
    Score,
    elapsed_ms,
    is_timed_out,
    is_too_early,
    score_answer,
    score_timeout,
)

PLAYER_COOKIE = "rq_pid"
PLAYER_HEADER = "X-RapidQ-Player"
COOKIE_MAX_AGE = 60 * 60 * 24 * 730
RATE_LIMIT_REQUESTS = 30
RATE_LIMIT_WINDOW_S = 10.0

app = FastAPI(title="Hummingbird", version="0.1.0")
app.state.clock = lambda: datetime.now(UTC)


# ---------------------------------------------------------------- helpers


class ApiError(HTTPException):
    def __init__(self, status: int, code: str, message: str, **extra: object) -> None:
        super().__init__(status_code=status, detail={"code": code, "message": message, **extra})


@app.exception_handler(ApiError)
async def _api_error_handler(_request: Request, exc: ApiError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content=exc.detail)


def get_clock(request: Request) -> Callable[[], datetime]:
    clock: Callable[[], datetime] = request.app.state.clock
    return clock


def _aware(value: datetime) -> datetime:
    """SQLite returns naive datetimes; everything is stored in UTC."""
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def _ms(value: datetime) -> int:
    return int(_aware(value).timestamp() * 1000)


class _RateLimiter:
    def __init__(self, limit: int, window_s: float) -> None:
        self.limit = limit
        self.window_s = window_s
        self.hits: defaultdict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> None:
        now = time.monotonic()
        hits = self.hits[key]
        while hits and now - hits[0] > self.window_s:
            hits.popleft()
        if len(hits) >= self.limit:
            raise ApiError(429, "rate_limited", "Too many requests. Wait a moment and try again.")
        hits.append(now)


app.state.rate_limiter = _RateLimiter(RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW_S)

SessionDep = Annotated[Session, Depends(get_session)]
ClockDep = Annotated[Callable[[], datetime], Depends(get_clock)]


def _valid_uuid(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return str(uuid.UUID(value))
    except ValueError:
        return None


def current_player(
    request: Request, response: Response, session: SessionDep, clock: ClockDep
) -> models.Player:
    """Identify the player from the cookie, or the localStorage backup header; else create one."""
    for candidate in (request.cookies.get(PLAYER_COOKIE), request.headers.get(PLAYER_HEADER)):
        player_id = _valid_uuid(candidate)
        if player_id is None:
            continue
        player = session.get(models.Player, player_id)
        if player is not None:
            break
    else:
        player = models.Player(id=str(uuid.uuid4()), created_at=clock())
        session.add(player)
        session.commit()
    response.set_cookie(
        PLAYER_COOKIE,
        player.id,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=request.url.scheme == "https",
    )
    return player


PlayerDep = Annotated[models.Player, Depends(current_player)]


def rate_limited_player(request: Request, player: PlayerDep) -> models.Player:
    limiter: _RateLimiter = request.app.state.rate_limiter
    limiter.check(player.id)
    return player


LimitedPlayerDep = Annotated[models.Player, Depends(rate_limited_player)]


# ---------------------------------------------------------------- schemas


class OptionOut(BaseModel):
    id: int
    text: str


class QuestionOut(BaseModel):
    slot: int
    total: int
    type: Literal["choice", "number", "text"]
    category: str
    text: str
    options: list[OptionOut]
    read_remaining_ms: int


class RevealOut(BaseModel):
    slot: int
    outcome: Literal["correct", "wrong", "timeout"]
    elapsed_ms: int | None
    band: str | None
    points: int
    total_score: int
    correct_answer: str
    correct_option_id: int | None
    chosen_option_id: int | None
    your_answer: str | None
    finished: bool


class ServeOut(BaseModel):
    kind: Literal["question", "reveal"]
    question: QuestionOut | None = None
    reveal: RevealOut | None = None


class SlotResultOut(BaseModel):
    slot: int
    outcome: Literal["correct", "wrong", "timeout"]
    band: str | None
    points: int
    elapsed_ms: int | None


class TodayOut(BaseModel):
    date: date
    number: int | None
    has_quiz: bool
    status: Literal["no_quiz", "not_started", "in_progress", "finished"]
    total_score: int
    answered: list[SlotResultOut]
    next_slot: int | None
    question_live: bool
    total_questions: int
    max_score: int
    next_unlock_at: datetime
    player_id: str


class AnswerIn(BaseModel):
    slot: int
    option_id: int | None = None
    value: str | None = None


class SlotIn(BaseModel):
    slot: int


class ResultQuestionOut(BaseModel):
    slot: int
    text: str
    category: str
    type: str
    your_answer: str | None
    correct_answer: str
    outcome: Literal["correct", "wrong", "timeout"]
    elapsed_ms: int | None
    band: str | None
    points: int
    percent_correct: int


class SpeedComparisonOut(BaseModel):
    """How the player's average time on correct answers compares with today's other players."""

    faster_than_percent: int | None
    players: int
    everyone_avg_ms: int | None
    fastest_ms: int | None


class StandingOut(BaseModel):
    """Where the player's total score ranks among everyone who has finished today."""

    rank: int
    players: int
    better_than_percent: int | None
    average_score: int


class ResultsOut(BaseModel):
    date: date
    number: int
    total_score: int
    max_score: int
    correct_count: int
    avg_correct_elapsed_ms: int | None
    questions: list[ResultQuestionOut]
    speed: SpeedComparisonOut
    standing: StandingOut
    next_unlock_at: datetime


# ---------------------------------------------------------------- queries


def _today(session: Session, clock: Callable[[], datetime]) -> tuple[date, models.Day | None]:
    today = quiz_date(clock())
    return today, session.get(models.Day, today)


def _play_for(session: Session, player: models.Player, day: date) -> models.Play | None:
    return session.scalar(
        select(models.Play).where(models.Play.player_id == player.id, models.Play.date == day)
    )


def _question(day: models.Day, slot: int) -> models.Question:
    for question in day.questions:
        if question.slot == slot:
            return question
    raise ApiError(500, "missing_question", f"Question {slot} is missing for {day.date}.")


def _shuffled_options(question: models.Question) -> list[models.ChoiceOption]:
    options = list(question.options)
    random.Random(f"{question.date.isoformat()}:{question.slot}").shuffle(options)
    return options


def _format_number(value: Decimal) -> str:
    normalised = value.normalize()
    if normalised == normalised.to_integral_value():
        return f"{int(normalised):,}"
    return f"{normalised:,f}"


def _correct_answer(question: models.Question) -> tuple[str, int | None]:
    if question.type == "choice":
        for option in question.options:
            if option.is_correct:
                return option.text, option.id
        raise ApiError(500, "bad_content", "Choice question has no correct option.")
    if question.type == "number":
        assert question.number_answer is not None
        return _format_number(Decimal(question.number_answer.value)), None
    return question.text_answers[0].canonical, None


def _your_answer(question: models.Question, sub: models.Submission) -> str | None:
    if sub.choice_option_id is not None:
        for option in question.options:
            if option.id == sub.choice_option_id:
                return option.text
    return sub.raw_input


def _reveal(question: models.Question, sub: models.Submission, play: models.Play) -> RevealOut:
    correct_text, correct_option_id = _correct_answer(question)
    assert sub.outcome is not None
    return RevealOut(
        slot=sub.slot,
        outcome=sub.outcome,  # type: ignore[arg-type]
        elapsed_ms=sub.elapsed_ms,
        band=sub.speed_band,
        points=sub.points,
        total_score=play.total_score,
        correct_answer=correct_text,
        correct_option_id=correct_option_id,
        chosen_option_id=sub.choice_option_id,
        your_answer=_your_answer(question, sub),
        finished=play.finished_at is not None,
    )


def _resolve(
    session: Session, play: models.Play, sub: models.Submission, score: Score, now: datetime
) -> None:
    sub.outcome = score.outcome.value
    sub.correct = score.outcome == Outcome.CORRECT
    sub.elapsed_ms = score.elapsed_ms
    sub.speed_band = score.band.value if score.band else None
    sub.points = score.points
    if sub.received_at is None and score.outcome != Outcome.TIMEOUT:
        sub.received_at = now
    play.total_score += score.points
    if sub.slot >= QUESTIONS_PER_DAY:
        play.finished_at = now
    session.commit()


def _question_out(question: models.Question, sub: models.Submission, now: datetime) -> QuestionOut:
    options = (
        [OptionOut(id=o.id, text=o.text) for o in _shuffled_options(question)]
        if question.type == "choice"
        else []
    )
    return QuestionOut(
        slot=question.slot,
        total=QUESTIONS_PER_DAY,
        type=question.type,  # type: ignore[arg-type]
        category=question.category,
        text=question.text,
        options=options,
        read_remaining_ms=max(0, _ms(sub.answer_open_at) - _ms(now)),
    )


def _open_submission(play: models.Play) -> models.Submission | None:
    for sub in play.submissions:
        if sub.outcome is None:
            return sub
    return None


def _require_day(session: Session, clock: Callable[[], datetime]) -> models.Day:
    _, day = _today(session, clock)
    if day is None:
        raise ApiError(404, "no_quiz", "There's no quiz today yet. Check back soon.")
    return day


def _submission_for(play: models.Play, slot: int) -> models.Submission:
    for sub in play.submissions:
        if sub.slot == slot:
            return sub
    raise ApiError(409, "not_served", "That question hasn't been served yet.")


# ---------------------------------------------------------------- routes


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/today", response_model=TodayOut)
def today(session: SessionDep, player: PlayerDep, clock: ClockDep) -> TodayOut:
    now = clock()
    day_date, day = _today(session, clock)
    play = _play_for(session, player, day_date) if day is not None else None
    answered = []
    question_live = False
    if play is not None:
        open_sub = _open_submission(play)
        if open_sub is not None and is_timed_out(_ms(open_sub.answer_open_at), _ms(now)):
            _resolve(session, play, open_sub, score_timeout(), now)
            open_sub = None
        question_live = open_sub is not None
        answered = [
            SlotResultOut(
                slot=s.slot,
                outcome=s.outcome,  # type: ignore[arg-type]
                band=s.speed_band,
                points=s.points,
                elapsed_ms=s.elapsed_ms,
            )
            for s in play.submissions
            if s.outcome is not None
        ]

    if day is None:
        status: Literal["no_quiz", "not_started", "in_progress", "finished"] = "no_quiz"
    elif play is None:
        status = "not_started"
    elif play.finished_at is not None:
        status = "finished"
    else:
        status = "in_progress"

    next_slot = None
    if day is not None and status != "finished":
        next_slot = (len(play.submissions) if play else 0) + (0 if question_live else 1)

    return TodayOut(
        date=day_date,
        number=day.number if day else None,
        has_quiz=day is not None,
        status=status,
        total_score=play.total_score if play else 0,
        answered=answered,
        next_slot=next_slot,
        question_live=question_live,
        total_questions=QUESTIONS_PER_DAY,
        max_score=MAX_POINTS_PER_DAY,
        next_unlock_at=next_unlock(now),
        player_id=player.id,
    )


@app.post("/api/play/ready", response_model=ServeOut)
def ready(session: SessionDep, player: LimitedPlayerDep, clock: ClockDep) -> ServeOut:
    """The player is ready: serve the next question (or the live one after a reload)."""
    now = clock()
    day = _require_day(session, clock)
    play = _play_for(session, player, day.date)
    if play is None:
        play = models.Play(player_id=player.id, date=day.date, started_at=now, total_score=0)
        session.add(play)
        session.flush()
    if play.finished_at is not None:
        raise ApiError(409, "finished", "You've already played today's quiz.")

    open_sub = _open_submission(play)
    if open_sub is not None:
        question = _question(day, open_sub.slot)
        if is_timed_out(_ms(open_sub.answer_open_at), _ms(now)):
            _resolve(session, play, open_sub, score_timeout(), now)
            return ServeOut(kind="reveal", reveal=_reveal(question, open_sub, play))
        session.commit()
        return ServeOut(kind="question", question=_question_out(question, open_sub, now))

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
    return ServeOut(kind="question", question=_question_out(question, sub, now))


@app.post("/api/play/answer", response_model=RevealOut)
def answer(
    body: AnswerIn, session: SessionDep, player: LimitedPlayerDep, clock: ClockDep
) -> RevealOut:
    now = clock()
    day = _require_day(session, clock)
    play = _play_for(session, player, day.date)
    if play is None:
        raise ApiError(409, "not_started", "Start today's quiz first.")
    sub = _submission_for(play, body.slot)
    question = _question(day, body.slot)
    if sub.outcome is not None:
        # A retry after a lost response gets the stored result; the first answer stands.
        return _reveal(question, sub, play)

    open_ms, now_ms = _ms(sub.answer_open_at), _ms(now)
    if is_too_early(open_ms, now_ms):
        raise ApiError(409, "too_early", "Answers open after the reading time.")
    if is_timed_out(open_ms, now_ms):
        _resolve(session, play, sub, score_timeout(), now)
        return _reveal(question, sub, play)

    correct: bool
    if question.type == "choice":
        if body.option_id is None or body.option_id not in {o.id for o in question.options}:
            raise ApiError(422, "invalid_option", "Pick one of the four answers.")
        sub.choice_option_id = body.option_id
        correct = any(o.id == body.option_id and o.is_correct for o in question.options)
    elif question.type == "number":
        raw = (body.value or "").strip()
        if is_blank(raw):
            raise ApiError(422, "blank", "Type an answer.")
        assert question.number_answer is not None
        result = check_number(
            raw, Decimal(question.number_answer.value), Decimal(question.number_answer.tolerance)
        )
        if result is None or parse_number(raw) is None:
            raise ApiError(422, "not_a_number", "Type a number, like 42 or 1,000.")
        sub.raw_input = raw[:200]
        correct = result
    else:
        raw = (body.value or "").strip()
        if is_blank(raw):
            raise ApiError(422, "blank", "Type an answer.")
        answers = [
            build_text_answer(a.id, a.canonical, [alias.alias_normalised for alias in a.aliases])
            for a in question.text_answers
        ]
        sub.raw_input = raw[:200]
        correct = check_text(raw, answers) is not None

    sub.received_at = now
    score = score_answer(correct, elapsed_ms(open_ms, now_ms), question.type)
    _resolve(session, play, sub, score, now)
    return _reveal(question, sub, play)


@app.post("/api/play/timeout", response_model=RevealOut)
def timeout(
    body: SlotIn, session: SessionDep, player: LimitedPlayerDep, clock: ClockDep
) -> RevealOut:
    """Resolve a question as out of time, but only once the server's limit has really passed."""
    now = clock()
    day = _require_day(session, clock)
    play = _play_for(session, player, day.date)
    if play is None:
        raise ApiError(409, "not_started", "Start today's quiz first.")
    sub = _submission_for(play, body.slot)
    question = _question(day, body.slot)
    if sub.outcome is None:
        open_ms, now_ms = _ms(sub.answer_open_at), _ms(now)
        if not is_timed_out(open_ms, now_ms):
            retry = open_ms + ANSWER_LIMIT_MS + TIMEOUT_GRACE_MS - now_ms + 1
            raise ApiError(409, "not_yet", "There's still time.", retry_after_ms=max(1, retry))
        _resolve(session, play, sub, score_timeout(), now)
    return _reveal(question, sub, play)


@app.get("/api/results", response_model=ResultsOut)
def results(session: SessionDep, player: PlayerDep, clock: ClockDep) -> ResultsOut:
    now = clock()
    day = _require_day(session, clock)
    play = _play_for(session, player, day.date)
    if play is None or play.finished_at is None:
        raise ApiError(409, "not_finished", "Finish today's quiz to see the results.")

    totals: dict[int, int] = {
        slot: count
        for slot, count in session.execute(
            select(models.Submission.slot, func.count())
            .join(models.Play)
            .where(models.Play.date == day.date, models.Submission.outcome.is_not(None))
            .group_by(models.Submission.slot)
        )
    }
    corrects: dict[int, int] = {
        slot: count
        for slot, count in session.execute(
            select(models.Submission.slot, func.count())
            .join(models.Play)
            .where(models.Play.date == day.date, models.Submission.correct.is_(True))
            .group_by(models.Submission.slot)
        )
    }

    questions: list[ResultQuestionOut] = []
    for sub in play.submissions:
        question = _question(day, sub.slot)
        correct_text, _ = _correct_answer(question)
        total = totals.get(sub.slot, 0)
        questions.append(
            ResultQuestionOut(
                slot=sub.slot,
                text=question.text,
                category=question.category,
                type=question.type,
                your_answer=_your_answer(question, sub),
                correct_answer=correct_text,
                outcome=sub.outcome,  # type: ignore[arg-type]
                elapsed_ms=sub.elapsed_ms,
                band=sub.speed_band,
                points=sub.points,
                percent_correct=round(100 * corrects.get(sub.slot, 0) / total) if total else 0,
            )
        )

    correct_times = [
        s.elapsed_ms for s in play.submissions if s.correct and s.elapsed_ms is not None
    ]
    my_avg = round(sum(correct_times) / len(correct_times)) if correct_times else None

    averages = session.execute(
        select(models.Play.id, func.avg(models.Submission.elapsed_ms))
        .join(models.Submission)
        .where(
            models.Play.date == day.date,
            models.Play.finished_at.is_not(None),
            models.Submission.correct.is_(True),
        )
        .group_by(models.Play.id)
    )
    all_avgs = [(play_id, float(avg)) for play_id, avg in averages if avg is not None]
    others = [avg for play_id, avg in all_avgs if play_id != play.id]
    faster_than = None
    if my_avg is not None and others:
        faster_than = round(100 * sum(1 for avg in others if avg > my_avg) / len(others))
    everyone_avg = round(sum(avg for _, avg in all_avgs) / len(all_avgs)) if all_avgs else None

    finished_scores = session.execute(
        select(models.Play.id, models.Play.total_score).where(
            models.Play.date == day.date, models.Play.finished_at.is_not(None)
        )
    )
    other_scores = [score for play_id, score in finished_scores if play_id != play.id]
    all_scores = [*other_scores, play.total_score]
    beaten = sum(1 for score in other_scores if score < play.total_score)
    better_than = round(100 * beaten / len(other_scores)) if other_scores else None

    return ResultsOut(
        date=day.date,
        number=day.number,
        total_score=play.total_score,
        max_score=MAX_POINTS_PER_DAY,
        correct_count=sum(1 for s in play.submissions if s.correct),
        avg_correct_elapsed_ms=my_avg,
        questions=questions,
        speed=SpeedComparisonOut(
            faster_than_percent=faster_than,
            players=len(others) + (1 if my_avg is not None else 0),
            everyone_avg_ms=everyone_avg,
            fastest_ms=min(correct_times) if correct_times else None,
        ),
        standing=StandingOut(
            rank=1 + sum(1 for score in other_scores if score > play.total_score),
            players=len(all_scores),
            better_than_percent=better_than,
            average_score=round(sum(all_scores) / len(all_scores)),
        ),
        next_unlock_at=next_unlock(now),
    )


_FRONTEND_DIST = Path(
    os.environ.get("RAPIDQ_FRONTEND_DIST", Path(__file__).resolve().parents[2] / "frontend/dist")
)
if _FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=_FRONTEND_DIST, html=True), name="frontend")
