"""SQLAlchemy models."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


def _new_uuid() -> str:
    return str(uuid.uuid4())


class Player(Base):
    __tablename__ = "players"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    display_name: Mapped[str | None] = mapped_column(String(40), nullable=True)
    # A secret code that moves this player to another device (optional "account" sync).
    sync_code: Mapped[str | None] = mapped_column(String(16), unique=True, nullable=True)


class Day(Base):
    __tablename__ = "days"

    date: Mapped[date] = mapped_column(Date, primary_key=True)
    number: Mapped[int] = mapped_column(Integer, unique=True)
    # Raised in a content file to restart a day that has already been played (see content.py).
    restart: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    questions: Mapped[list[Question]] = relationship(
        back_populates="day", order_by="Question.slot", cascade="all, delete-orphan"
    )


class Question(Base):
    __tablename__ = "questions"
    __table_args__ = (
        UniqueConstraint("date", "mode", "slot", name="uq_questions_date_mode_slot"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    date: Mapped[date] = mapped_column(ForeignKey("days.date", ondelete="CASCADE"), index=True)
    # Which game the question belongs to: "speed" (the eight a day) or "numbers" (five guesses).
    mode: Mapped[str] = mapped_column(String(10), default="speed", server_default="speed")
    slot: Mapped[int] = mapped_column(Integer)
    type: Mapped[str] = mapped_column(String(10))
    text: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(40))

    day: Mapped[Day] = relationship(back_populates="questions")
    options: Mapped[list[ChoiceOption]] = relationship(
        back_populates="question", order_by="ChoiceOption.position", cascade="all, delete-orphan"
    )
    number_answer: Mapped[NumberAnswer | None] = relationship(
        back_populates="question", cascade="all, delete-orphan", uselist=False
    )
    text_answers: Mapped[list[TextAnswer]] = relationship(
        back_populates="question", order_by="TextAnswer.id", cascade="all, delete-orphan"
    )


class ChoiceOption(Base):
    __tablename__ = "choice_options"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    question_id: Mapped[int] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(String(200))
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False)

    question: Mapped[Question] = relationship(back_populates="options")


class NumberAnswer(Base):
    __tablename__ = "number_answers"

    question_id: Mapped[int] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), primary_key=True
    )
    value: Mapped[Decimal] = mapped_column(Numeric(20, 6))
    tolerance: Mapped[Decimal] = mapped_column(Numeric(20, 6), default=Decimal(0))
    # Numbers quiz only: how far off (a power of ten) a guess can be before it scores nothing.
    spread: Mapped[Decimal | None] = mapped_column(Numeric(8, 4), nullable=True)

    question: Mapped[Question] = relationship(back_populates="number_answer")


class TextAnswer(Base):
    __tablename__ = "text_answers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    question_id: Mapped[int] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), index=True
    )
    canonical: Mapped[str] = mapped_column(String(200))

    question: Mapped[Question] = relationship(back_populates="text_answers")
    aliases: Mapped[list[TextAlias]] = relationship(
        back_populates="text_answer", cascade="all, delete-orphan"
    )


class TextAlias(Base):
    __tablename__ = "text_aliases"

    text_answer_id: Mapped[int] = mapped_column(
        ForeignKey("text_answers.id", ondelete="CASCADE"), primary_key=True
    )
    alias_normalised: Mapped[str] = mapped_column(String(200), primary_key=True)

    text_answer: Mapped[TextAnswer] = relationship(back_populates="aliases")


class Play(Base):
    __tablename__ = "plays"
    __table_args__ = (
        UniqueConstraint("player_id", "date", "mode", name="uq_plays_player_date_mode"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    player_id: Mapped[str] = mapped_column(ForeignKey("players.id"), index=True)
    date: Mapped[date] = mapped_column(ForeignKey("days.date"), index=True)
    mode: Mapped[str] = mapped_column(String(10), default="speed", server_default="speed")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    total_score: Mapped[int] = mapped_column(Integer, default=0)
    # Made on first request for results; a friend opening ?c=<code> is challenged to beat it.
    challenge_code: Mapped[str | None] = mapped_column(String(12), unique=True, nullable=True)

    submissions: Mapped[list[Submission]] = relationship(
        back_populates="play", order_by="Submission.slot", cascade="all, delete-orphan"
    )


class Submission(Base):
    """Created when a question is served; resolved when it is answered or times out."""

    __tablename__ = "submissions"
    __table_args__ = (UniqueConstraint("play_id", "slot", name="uq_submissions_play_slot"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    play_id: Mapped[int] = mapped_column(ForeignKey("plays.id", ondelete="CASCADE"), index=True)
    slot: Mapped[int] = mapped_column(Integer)
    served_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    answer_open_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    raw_input: Mapped[str | None] = mapped_column(String(200), nullable=True)
    choice_option_id: Mapped[int | None] = mapped_column(
        ForeignKey("choice_options.id"), nullable=True
    )
    outcome: Mapped[str | None] = mapped_column(String(10), nullable=True)
    correct: Mapped[bool] = mapped_column(Boolean, default=False)
    elapsed_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    speed_band: Mapped[str | None] = mapped_column(String(12), nullable=True)
    points: Mapped[int] = mapped_column(Integer, default=0)
    # How Close only: Bullseye bonus points included in `points` (0 for everything else).
    bonus: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    play: Mapped[Play] = relationship(back_populates="submissions")


class League(Base):
    """A private league: friends who join with its code see each other's scores."""

    __tablename__ = "leagues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(12), unique=True)
    name: Mapped[str] = mapped_column(String(40))
    owner_id: Mapped[str] = mapped_column(ForeignKey("players.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    members: Mapped[list[LeagueMember]] = relationship(
        back_populates="league", cascade="all, delete-orphan"
    )


class LeagueMember(Base):
    __tablename__ = "league_members"

    league_id: Mapped[int] = mapped_column(
        ForeignKey("leagues.id", ondelete="CASCADE"), primary_key=True
    )
    player_id: Mapped[str] = mapped_column(ForeignKey("players.id"), primary_key=True, index=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    league: Mapped[League] = relationship(back_populates="members")
