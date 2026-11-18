"""Progress and social routes: your profile (name, streaks, field guide, device sync), the
weekly league, private leagues and head-to-head challenges.

Nothing here can reveal a question's answer: only totals, animals and times are shared.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Callable
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import models
from .daily import quiz_date, quiz_number
from .main import (
    COOKIE_MAX_AGE,
    PLAYER_COOKIE,
    ApiError,
    ClockDep,
    LimitedPlayerDep,
    PlayerDep,
    SessionDep,
)
from .progress import (
    Catch,
    anon_name,
    clean_display_name,
    clean_league_name,
    field_guide,
    new_code,
    normalise_code,
    streaks,
    week_start,
    weekly_total,
)

router = APIRouter(prefix="/api")

SYNC_CODE_LENGTH = 10
LEAGUE_CODE_LENGTH = 6
CHALLENGE_CODE_LENGTH = 8
MAX_LEAGUES_PER_PLAYER = 20
MAX_LEAGUE_MEMBERS = 50
WEEKLY_TOP = 10


# ---------------------------------------------------------------- schemas


class StreakOut(BaseModel):
    current: int
    best: int
    hummingbird_current: int
    hummingbird_best: int


class GuideOut(BaseModel):
    counts: dict[str, int]
    golden: int
    perfect_days: int


class MeOut(BaseModel):
    display_name: str | None
    streak: StreakOut
    guide: GuideOut
    days_played: int


class NameIn(BaseModel):
    display_name: str


class NameOut(BaseModel):
    display_name: str


class SyncCodeOut(BaseModel):
    code: str


class SyncIn(BaseModel):
    code: str


class SyncOut(BaseModel):
    player_id: str
    display_name: str | None


class WeekRowOut(BaseModel):
    rank: int
    name: str
    total: int
    days: int
    you: bool


class WeekOut(BaseModel):
    week_start: date
    best_days: int
    top: list[WeekRowOut]
    you: WeekRowOut | None


class LeagueIn(BaseModel):
    name: str


class JoinIn(BaseModel):
    code: str


class MemberOut(BaseModel):
    name: str
    you: bool
    today: int | None
    today_bands: list[str | None] | None
    week: int


class LeagueOut(BaseModel):
    id: int
    code: str
    name: str
    owner: bool
    members: list[MemberOut]


class ChallengeOut(BaseModel):
    name: str
    number: int
    date: date
    total_score: int
    bands: list[str | None]
    is_today: bool


# ---------------------------------------------------------------- helpers


def _today(clock: Callable[[], datetime]) -> date:
    return quiz_date(clock())


def _name(player: models.Player) -> str:
    return player.display_name or anon_name(player.id)


def _finished_plays(
    session: Session, player_ids: list[str], since: date | None = None
) -> list[models.Play]:
    if not player_ids:
        return []
    # Streaks, the field guide, leagues and the weekly table are all about the speed quiz.
    query = select(models.Play).where(
        models.Play.player_id.in_(player_ids),
        models.Play.mode == "speed",
        models.Play.finished_at.is_not(None),
    )
    if since is not None:
        query = query.where(models.Play.date >= since)
    return list(session.scalars(query))


def _bands(play: models.Play) -> list[str | None]:
    return [
        s.speed_band if s.correct else None for s in sorted(play.submissions, key=lambda s: s.slot)
    ]


def _unique_code(session: Session, length: int, column: Any) -> str:
    """A fresh random code for `column` (a model attribute), retrying on the rare clash."""
    for _ in range(20):
        code = new_code(length)
        if session.scalar(select(column).where(column == code)) is None:
            return code
    raise ApiError(503, "busy", "Couldn't make a code just now. Please try again.")


def _require_name(player: models.Player) -> None:
    if not player.display_name:
        raise ApiError(409, "name_required", "Choose a name first, so friends know it's you.")


def _league_out(
    session: Session, league: models.League, me: models.Player, today: date
) -> LeagueOut:
    ids = [m.player_id for m in league.members]
    players = {
        p.id: p for p in session.scalars(select(models.Player).where(models.Player.id.in_(ids)))
    }
    monday = week_start(today)
    plays = _finished_plays(session, ids, since=monday)
    week: dict[str, list[int]] = defaultdict(list)
    today_play: dict[str, models.Play] = {}
    for play in plays:
        if play.date > today:
            continue
        week[play.player_id].append(play.total_score)
        if play.date == today:
            today_play[play.player_id] = play
    members = []
    for pid in ids:
        player = players.get(pid)
        if player is None:
            continue
        tp = today_play.get(pid)
        members.append(
            MemberOut(
                name=_name(player),
                you=pid == me.id,
                today=tp.total_score if tp else None,
                today_bands=_bands(tp) if tp else None,
                week=weekly_total(week[pid]),
            )
        )
    members.sort(key=lambda m: (m.today is None, -(m.today or 0), -m.week, m.name.lower()))
    return LeagueOut(
        id=league.id,
        code=league.code,
        name=league.name,
        owner=league.owner_id == me.id,
        members=members,
    )


# ---------------------------------------------------------------- profile


@router.get("/me", response_model=MeOut)
def me(session: SessionDep, player: PlayerDep, clock: ClockDep) -> MeOut:
    plays = _finished_plays(session, [player.id])
    played = [p.date for p in plays]
    hummingbird_days = [
        p.date
        for p in plays
        if any(s.correct and s.speed_band == "hummingbird" for s in p.submissions)
    ]
    s = streaks(played, hummingbird_days, _today(clock))
    guide = field_guide(
        [Catch(sub.speed_band, sub.elapsed_ms) for sub in p.submissions if sub.correct]
        for p in plays
    )
    return MeOut(
        display_name=player.display_name,
        streak=StreakOut(
            current=s.current,
            best=s.best,
            hummingbird_current=s.hummingbird_current,
            hummingbird_best=s.hummingbird_best,
        ),
        guide=GuideOut(counts=guide.counts, golden=guide.golden, perfect_days=guide.perfect_days),
        days_played=len(set(played)),
    )


@router.put("/me/name", response_model=NameOut)
def set_name(body: NameIn, session: SessionDep, player: LimitedPlayerDep) -> NameOut:
    try:
        name = clean_display_name(body.display_name)
    except ValueError as error:
        raise ApiError(400, "bad_name", str(error)) from error
    player.display_name = name
    session.commit()
    return NameOut(display_name=name)


@router.post("/me/sync-code", response_model=SyncCodeOut)
def sync_code(session: SessionDep, player: LimitedPlayerDep) -> SyncCodeOut:
    """Your private code for playing as you on another device. Made once, then reused."""
    if not player.sync_code:
        player.sync_code = _unique_code(session, SYNC_CODE_LENGTH, models.Player.sync_code)
        session.commit()
    code = player.sync_code
    return SyncCodeOut(code=f"{code[:5]}-{code[5:]}")


@router.post("/me/sync", response_model=SyncOut)
def use_sync_code(
    body: SyncIn,
    request: Request,
    response: Response,
    session: SessionDep,
    player: LimitedPlayerDep,
) -> SyncOut:
    """Switch this device to the player who owns the code."""
    code = normalise_code(body.code)
    if len(code) != SYNC_CODE_LENGTH:
        raise ApiError(
            400, "bad_code", "That code doesn't look right. It has 10 letters and numbers."
        )
    owner = session.scalar(select(models.Player).where(models.Player.sync_code == code))
    if owner is None:
        raise ApiError(404, "unknown_code", "No player has that code. Check it and try again.")
    response.set_cookie(
        PLAYER_COOKIE,
        owner.id,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=request.url.scheme == "https",
    )
    return SyncOut(player_id=owner.id, display_name=owner.display_name)


# ---------------------------------------------------------------- weekly league


@router.get("/week", response_model=WeekOut)
def week(session: SessionDep, player: PlayerDep, clock: ClockDep) -> WeekOut:
    today = _today(clock)
    monday = week_start(today)
    plays = [
        p
        for p in session.scalars(
            select(models.Play).where(
                models.Play.finished_at.is_not(None),
                models.Play.mode == "speed",
                models.Play.date >= monday,
                models.Play.date <= today,
            )
        )
    ]
    scores: dict[str, list[int]] = defaultdict(list)
    for play in plays:
        scores[play.player_id].append(play.total_score)
    totals = sorted(
        ((weekly_total(v), len(v), pid) for pid, v in scores.items()), key=lambda t: (-t[0], -t[1])
    )
    names = {
        p.id: _name(p)
        for p in session.scalars(
            select(models.Player).where(models.Player.id.in_([t[2] for t in totals]))
        )
    }
    rows: list[WeekRowOut] = []
    you: WeekRowOut | None = None
    rank = 0
    previous: int | None = None
    for index, (total, days, pid) in enumerate(totals, start=1):
        if total != previous:
            rank, previous = index, total
        row = WeekRowOut(
            rank=rank, name=names.get(pid, "Player"), total=total, days=days, you=pid == player.id
        )
        if row.you:
            you = row
        if index <= WEEKLY_TOP:
            rows.append(row)
    return WeekOut(week_start=monday, best_days=5, top=rows, you=you)


# ---------------------------------------------------------------- private leagues


@router.get("/leagues", response_model=list[LeagueOut])
def my_leagues(session: SessionDep, player: PlayerDep, clock: ClockDep) -> list[LeagueOut]:
    today = _today(clock)
    leagues = session.scalars(
        select(models.League)
        .join(models.LeagueMember)
        .where(models.LeagueMember.player_id == player.id)
        .order_by(models.League.created_at)
    )
    return [_league_out(session, league, player, today) for league in leagues]


@router.post("/leagues", response_model=LeagueOut)
def create_league(
    body: LeagueIn, session: SessionDep, player: LimitedPlayerDep, clock: ClockDep
) -> LeagueOut:
    _require_name(player)
    try:
        name = clean_league_name(body.name)
    except ValueError as error:
        raise ApiError(400, "bad_name", str(error)) from error
    count = len(
        list(
            session.scalars(
                select(models.LeagueMember).where(models.LeagueMember.player_id == player.id)
            )
        )
    )
    if count >= MAX_LEAGUES_PER_PLAYER:
        raise ApiError(409, "too_many", f"You can be in up to {MAX_LEAGUES_PER_PLAYER} leagues.")
    now = clock()
    league = models.League(
        code=_unique_code(session, LEAGUE_CODE_LENGTH, models.League.code),
        name=name,
        owner_id=player.id,
        created_at=now,
    )
    league.members.append(models.LeagueMember(player_id=player.id, joined_at=now))
    session.add(league)
    session.commit()
    return _league_out(session, league, player, _today(clock))


@router.post("/leagues/join", response_model=LeagueOut)
def join_league(
    body: JoinIn, session: SessionDep, player: LimitedPlayerDep, clock: ClockDep
) -> LeagueOut:
    _require_name(player)
    code = normalise_code(body.code)
    league = session.scalar(select(models.League).where(models.League.code == code))
    if league is None:
        raise ApiError(404, "unknown_code", "No league has that code. Check it and try again.")
    if not any(m.player_id == player.id for m in league.members):
        if len(league.members) >= MAX_LEAGUE_MEMBERS:
            raise ApiError(
                409, "league_full", f"That league is full ({MAX_LEAGUE_MEMBERS} players)."
            )
        league.members.append(models.LeagueMember(player_id=player.id, joined_at=clock()))
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
    return _league_out(session, league, player, _today(clock))


@router.post("/leagues/{league_id}/leave")
def leave_league(league_id: int, session: SessionDep, player: LimitedPlayerDep) -> dict[str, bool]:
    member = session.get(models.LeagueMember, (league_id, player.id))
    if member is None:
        raise ApiError(404, "not_member", "You're not in that league.")
    league = member.league
    session.delete(member)
    session.flush()
    # The last one out closes the league.
    if not league.members or all(m.player_id == player.id for m in league.members):
        session.delete(league)
    session.commit()
    return {"left": True}


# ---------------------------------------------------------------- challenges


def ensure_challenge_code(session: Session, play: models.Play) -> str:
    """The share code for a finished play, made the first time it is asked for."""
    if not play.challenge_code:
        play.challenge_code = _unique_code(
            session, CHALLENGE_CODE_LENGTH, models.Play.challenge_code
        )
        session.commit()
    return play.challenge_code


@router.get("/challenge/{code}", response_model=ChallengeOut)
def challenge(code: str, session: SessionDep, clock: ClockDep) -> ChallengeOut:
    play = session.scalar(
        select(models.Play).where(models.Play.challenge_code == normalise_code(code))
    )
    if play is None or play.finished_at is None:
        raise ApiError(404, "unknown_challenge", "That challenge link doesn't work any more.")
    owner = session.get(models.Player, play.player_id)
    return ChallengeOut(
        name=_name(owner) if owner else "A friend",
        number=quiz_number(play.date),
        date=play.date,
        total_score=play.total_score,
        bands=_bands(play),
        is_today=play.date == _today(clock),
    )
