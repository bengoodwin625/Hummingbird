"""Daily content files: parsing, validation and loading into the database."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

import yaml
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models
from .checking import normalise
from .daily import quiz_number
from .scoring import NUMBERS_QUESTIONS_PER_DAY, QUESTIONS_PER_DAY

QUESTION_TYPES = ("choice", "number", "text")
MIN_CHOICE_QUESTIONS = 5
OPTIONS_PER_CHOICE = 6


class ContentError(Exception):
    def __init__(self, source: str, problems: list[str]) -> None:
        super().__init__(f"{source}: " + "; ".join(problems))
        self.source = source
        self.problems = problems


@dataclass
class OptionSpec:
    text: str
    correct: bool


@dataclass
class TextAnswerSpec:
    canonical: str
    aliases: list[str] = field(default_factory=list)


@dataclass
class QuestionSpec:
    slot: int
    type: str
    category: str
    text: str
    options: list[OptionSpec] = field(default_factory=list)
    number: Decimal | None = None
    tolerance: Decimal = Decimal(0)
    answers: list[TextAnswerSpec] = field(default_factory=list)


@dataclass
class NumbersSpec:
    """One Numbers quiz question: guess an obscure number."""

    slot: int
    category: str
    text: str
    answer: Decimal
    spread: Decimal | None = None


@dataclass
class DaySpec:
    date: date
    questions: list[QuestionSpec]
    restart: int = 0
    numbers: list[NumbersSpec] = field(default_factory=list)


MIN_SPREAD, MAX_SPREAD = Decimal("0.1"), Decimal("3")


def _as_str(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def _as_decimal(value: Any) -> Decimal | None:
    if isinstance(value, bool) or value is None:
        return None
    try:
        return Decimal(str(value))
    except InvalidOperation:
        return None


def parse_day(data: Any, source: str) -> DaySpec:
    """Parse and validate one day's content. Raises ContentError listing every problem."""
    problems: list[str] = []
    if not isinstance(data, dict):
        raise ContentError(source, ["file must be a mapping with 'date' and 'questions'"])

    raw_date = data.get("date")
    day: date | None = None
    if isinstance(raw_date, date):
        day = raw_date
    elif isinstance(raw_date, str):
        try:
            day = date.fromisoformat(raw_date)
        except ValueError:
            problems.append(f"date {raw_date!r} is not YYYY-MM-DD")
    else:
        problems.append("missing 'date'")

    stem = Path(source).stem
    if day is not None:
        try:
            if date.fromisoformat(stem) != day:
                problems.append(f"date {day} doesn't match the file name {stem}")
        except ValueError:
            pass

    restart = data.get("restart", 0)
    if isinstance(restart, bool) or not isinstance(restart, int) or restart < 0:
        problems.append("restart must be a whole number, 0 or more")
        restart = 0

    raw_questions = data.get("questions")
    if not isinstance(raw_questions, list):
        raise ContentError(source, [*problems, "missing 'questions' list"])

    questions: list[QuestionSpec] = []
    for index, raw in enumerate(raw_questions, start=1):
        label = f"question {index}"
        if not isinstance(raw, dict):
            problems.append(f"{label} must be a mapping")
            continue
        slot = raw.get("slot")
        if isinstance(slot, int) and not isinstance(slot, bool):
            label = f"slot {slot}"
        else:
            problems.append(f"{label} has no integer slot")
            slot = -index
        qtype = _as_str(raw.get("type"))
        text = _as_str(raw.get("text"))
        category = _as_str(raw.get("category"))
        if qtype not in QUESTION_TYPES:
            problems.append(f"{label} has unknown type {qtype!r}")
        if not text:
            problems.append(f"{label} has no text")
        if not category:
            problems.append(f"{label} has no category")
        spec = QuestionSpec(slot=slot, type=qtype, category=category, text=text)

        if qtype == "choice":
            raw_options = raw.get("options")
            if not isinstance(raw_options, list):
                problems.append(f"{label} has no options list")
                raw_options = []
            for raw_option in raw_options:
                is_mapping = isinstance(raw_option, dict)
                option_text = _as_str(raw_option.get("text")) if is_mapping else ""
                if not option_text:
                    problems.append(f"{label} has an option with no text")
                    continue
                correct = bool(raw_option.get("correct", False))
                spec.options.append(OptionSpec(option_text, correct))
            if len(raw_options) != OPTIONS_PER_CHOICE:
                problems.append(f"{label} must have exactly {OPTIONS_PER_CHOICE} options")
            if sum(1 for option in spec.options if option.correct) != 1:
                problems.append(f"{label} must have exactly one correct option")
            seen = [normalise(option.text) for option in spec.options]
            if len(set(seen)) != len(seen):
                problems.append(f"{label} has duplicate options")
        elif qtype == "number":
            number = _as_decimal(raw.get("answer"))
            if number is None:
                problems.append(f"{label} has no numeric answer")
            spec.number = number
            tolerance = _as_decimal(raw.get("tolerance", 0))
            if tolerance is None or tolerance < 0:
                problems.append(f"{label} has an invalid or negative tolerance")
            else:
                spec.tolerance = tolerance
        elif qtype == "text":
            raw_answers = raw.get("answers")
            if not isinstance(raw_answers, list) or not raw_answers:
                problems.append(f"{label} has no answers")
                raw_answers = []
            forms: list[str] = []
            for raw_answer in raw_answers:
                canonical = (
                    _as_str(raw_answer.get("canonical")) if isinstance(raw_answer, dict) else ""
                )
                if not canonical or not normalise(canonical):
                    problems.append(f"{label} has an answer with no canonical form")
                    continue
                aliases_raw = raw_answer.get("aliases", [])
                aliases = [
                    a.strip() for a in aliases_raw if isinstance(a, str) and a.strip()
                ] if isinstance(aliases_raw, list) else []
                spec.answers.append(TextAnswerSpec(canonical, aliases))
                for value in (canonical, *aliases):
                    form = normalise(value)
                    if form in forms:
                        problems.append(f"{label} has duplicate normalised form {form!r}")
                    forms.append(form)
        questions.append(spec)

    slots = sorted(q.slot for q in questions)
    if len(questions) != QUESTIONS_PER_DAY or slots != list(range(1, QUESTIONS_PER_DAY + 1)):
        problems.append(f"a day must have exactly {QUESTIONS_PER_DAY} questions with slots 1-8")
    choice_count = sum(1 for q in questions if q.type == "choice")
    if choice_count < MIN_CHOICE_QUESTIONS:
        problems.append(
            f"at least {MIN_CHOICE_QUESTIONS} questions must be multiple choice "
            f"(found {choice_count})"
        )

    numbers = _parse_numbers(data.get("numbers"), problems)

    if problems or day is None:
        raise ContentError(source, problems or ["missing 'date'"])
    return DaySpec(
        date=day,
        questions=sorted(questions, key=lambda q: q.slot),
        restart=restart,
        numbers=sorted(numbers, key=lambda q: q.slot),
    )


def _parse_numbers(raw: Any, problems: list[str]) -> list[NumbersSpec]:
    """The optional Numbers quiz section: exactly five questions with positive answers."""
    if raw is None:
        return []
    if not isinstance(raw, list):
        problems.append("'numbers' must be a list")
        return []
    out: list[NumbersSpec] = []
    for index, item in enumerate(raw, start=1):
        label = f"numbers question {index}"
        if not isinstance(item, dict):
            problems.append(f"{label} must be a mapping")
            continue
        slot = item.get("slot")
        if not isinstance(slot, int) or isinstance(slot, bool):
            problems.append(f"{label} has no integer slot")
            continue
        label = f"numbers slot {slot}"
        text = _as_str(item.get("text"))
        category = _as_str(item.get("category"))
        answer = _as_decimal(item.get("answer"))
        spread = _as_decimal(item.get("spread")) if "spread" in item else None
        good_answer = answer is not None and answer.is_finite() and answer > 0
        if not text:
            problems.append(f"{label} has no text")
        if not category:
            problems.append(f"{label} has no category")
        if not good_answer:
            problems.append(f"{label} needs a positive numeric answer")
        if "spread" in item and (spread is None or not MIN_SPREAD <= spread <= MAX_SPREAD):
            problems.append(f"{label} spread must be between {MIN_SPREAD} and {MAX_SPREAD}")
        if text and category and good_answer and answer is not None:
            out.append(NumbersSpec(slot, category, text, answer, spread))
    slots = sorted(q.slot for q in out)
    expected = list(range(1, NUMBERS_QUESTIONS_PER_DAY + 1))
    if len(raw) != NUMBERS_QUESTIONS_PER_DAY or slots != expected:
        problems.append(
            f"'numbers' must have exactly {NUMBERS_QUESTIONS_PER_DAY} questions with slots 1-5"
        )
    return out


def read_day_file(path: Path) -> DaySpec:
    with path.open(encoding="utf-8") as handle:
        try:
            data = yaml.safe_load(handle)
        except yaml.YAMLError as error:
            raise ContentError(str(path), [f"invalid YAML: {error}"]) from error
    return parse_day(data, str(path))


def content_files(target: Path) -> list[Path]:
    if target.is_dir():
        return sorted(p for p in target.iterdir() if p.suffix in (".yaml", ".yml"))
    return [target]


class DayLockedError(Exception):
    """A day that already has plays can't be replaced, because scores are frozen."""


def load_day(session: Session, spec: DaySpec) -> list[str]:
    """Insert or replace one day's questions; returns the games ("speed", "numbers") loaded.

    Each game is locked once anyone has played it that day, because scores are frozen: its
    questions are kept as they are, while the other game's questions can still be added or
    changed. If nothing in the file can be loaded, DayLockedError is raised. The one way past a
    lock is a deliberate restart: raising the day's `restart` number in its content file above
    the stored one deletes all of that day's plays (everyone can play again) and loads it fresh.
    """
    existing = session.get(models.Day, spec.date)
    plays = list(session.scalars(select(models.Play).where(models.Play.date == spec.date)))
    if existing is not None and plays and spec.restart > existing.restart:
        for play in plays:
            session.delete(play)
        session.flush()
        plays = []
    locked = {play.mode for play in plays}

    wanted = ["speed"] + (["numbers"] if spec.numbers else [])
    loading = [mode for mode in wanted if mode not in locked]
    if existing is not None and not loading:
        raise DayLockedError(f"{spec.date} already has plays and can't be replaced")

    if existing is None:
        day = models.Day(date=spec.date, number=quiz_number(spec.date), restart=spec.restart)
        session.add(day)
    else:
        day = existing
        day.restart = max(day.restart, spec.restart)
        # Clear the games being loaded, and an unplayed numbers set the file no longer has.
        clear = set(loading)
        if not spec.numbers and "numbers" not in locked:
            clear.add("numbers")
        # Removing a question from the day deletes it (delete-orphan cascade).
        for question in [q for q in day.questions if q.mode in clear]:
            day.questions.remove(question)
        session.flush()

    if "speed" in loading:
        for q in spec.questions:
            day.questions.append(_speed_question(q))
    if "numbers" in loading:
        for n in spec.numbers:
            question = models.Question(
                mode="numbers", slot=n.slot, type="number", text=n.text, category=n.category
            )
            question.number_answer = models.NumberAnswer(
                value=n.answer, tolerance=Decimal(0), spread=n.spread
            )
            day.questions.append(question)
    session.flush()
    return loading


def _speed_question(q: QuestionSpec) -> models.Question:
    question = models.Question(
        mode="speed", slot=q.slot, type=q.type, text=q.text, category=q.category
    )
    if q.type == "choice":
        question.options = [
            models.ChoiceOption(position=i, text=o.text, is_correct=o.correct)
            for i, o in enumerate(q.options)
        ]
    elif q.type == "number":
        assert q.number is not None
        question.number_answer = models.NumberAnswer(value=q.number, tolerance=q.tolerance)
    else:
        for answer in q.answers:
            text_answer = models.TextAnswer(canonical=answer.canonical)
            alias_forms: list[str] = []
            for alias in answer.aliases:
                form = normalise(alias)
                if form and form != normalise(answer.canonical) and form not in alias_forms:
                    alias_forms.append(form)
            text_answer.aliases = [models.TextAlias(alias_normalised=f) for f in alias_forms]
            question.text_answers.append(text_answer)
    return question
