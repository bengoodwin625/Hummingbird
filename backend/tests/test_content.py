import copy
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy.orm import Session, sessionmaker

from app import models
from app.content import ContentError, DayLockedError, load_day, parse_day, read_day_file

from .conftest import REPO_ROOT, sample_day


def _problems(data: Any) -> list[str]:
    with pytest.raises(ContentError) as info:
        parse_day(data, "2026-11-17.yaml")
    return info.value.problems


def test_sample_day_is_valid() -> None:
    spec = parse_day(sample_day(), "2026-11-17.yaml")
    assert [q.slot for q in spec.questions] == list(range(1, 9))


def test_requires_exactly_eight_questions() -> None:
    data = sample_day()
    data["questions"] = data["questions"][:7]  # type: ignore[index]
    assert any("exactly 8 questions" in p for p in _problems(data))


def test_requires_five_choice_questions() -> None:
    data = sample_day()
    questions: list[dict[str, Any]] = data["questions"]  # type: ignore[assignment]
    for q in questions[:2]:
        q.clear()
        q.update({"slot": questions.index(q) + 1, "type": "number", "category": "x",
                  "text": "How many?", "answer": 3})
    assert any("at least 5" in p for p in _problems(data))


def test_choice_needs_six_options_and_one_correct() -> None:
    data = sample_day()
    q = data["questions"][0]  # type: ignore[index]
    q["options"] = q["options"][:5]
    q["options"][1]["correct"] = True
    problems = _problems(data)
    assert any("exactly 6 options" in p for p in problems)
    assert any("exactly one correct" in p for p in problems)


def test_number_needs_answer_and_non_negative_tolerance() -> None:
    data = sample_day()
    q = data["questions"][6]  # type: ignore[index]
    q["answer"] = "lots"
    q["tolerance"] = -1
    problems = _problems(data)
    assert any("no numeric answer" in p for p in problems)
    assert any("negative tolerance" in p for p in problems)


def test_text_needs_canonical_and_unique_forms() -> None:
    data = sample_day()
    q = data["questions"][7]  # type: ignore[index]
    q["answers"] = [{"canonical": "Radiohead", "aliases": ["RADIOHEAD!"]}]
    assert any("duplicate normalised form" in p for p in _problems(data))
    q["answers"] = [{"aliases": ["x"]}]
    assert any("no canonical form" in p for p in _problems(data))


def test_unknown_type_and_date_mismatch() -> None:
    data = sample_day()
    data["questions"][0]["type"] = "ordering"  # type: ignore[index]
    assert any("unknown type" in p for p in _problems(data))
    with pytest.raises(ContentError) as info:
        parse_day(sample_day("2026-11-18"), "2026-11-17.yaml")
    assert any("doesn't match the file name" in p for p in info.value.problems)


def test_repository_content_is_valid() -> None:
    files = sorted((REPO_ROOT / "content").glob("*.yaml"))
    assert files, "expected at least one content file"
    for path in files:
        read_day_file(path)


def test_load_replaces_a_day_without_plays_but_not_one_with_plays(
    session_factory: sessionmaker[Session], tmp_path: Path
) -> None:
    spec = parse_day(sample_day(), "2026-11-17.yaml")
    with session_factory() as session:
        load_day(session, spec)
        session.commit()
        changed = copy.deepcopy(spec)
        changed.questions[0].text = "Changed?"
        load_day(session, changed)
        session.commit()
        day = session.get(models.Day, spec.date)
        assert day is not None and day.number == 1
        assert day.questions[0].text == "Changed?"

        from datetime import UTC, datetime

        player = models.Player(id="00000000-0000-4000-8000-000000000001",
                               created_at=datetime.now(UTC))
        session.add(player)
        session.add(models.Play(player_id=player.id, date=spec.date,
                                started_at=datetime.now(UTC), total_score=0))
        session.commit()
        with pytest.raises(DayLockedError):
            load_day(session, spec)
