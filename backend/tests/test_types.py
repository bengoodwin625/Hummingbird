"""The extra Speed quiz question types: true/false, which came first (pair) and put in order."""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker

from app.checking import check_order
from app.content import ContentError, load_day, parse_day
from app.scoring import banding_time, score_answer

from .conftest import FakeClock, sample_day


def day_with(slot6: dict[str, Any]) -> dict[str, Any]:
    day = sample_day()
    questions: list[dict[str, Any]] = day["questions"]  # type: ignore[assignment]
    questions[5] = {"slot": 6, "category": "general", **slot6}
    return day


ORDER = {
    "type": "order",
    "text": "Put these in order, earliest first",
    "items": ["Magna Carta", "Battle of Bosworth", "Great Fire of London", "Battle of Waterloo"],
}
TRUE_FALSE = {
    "type": "truefalse",
    "text": "The Great Wall of China is visible from the Moon.",
    "answer": False,
}
PAIR = {
    "type": "pair",
    "text": "Which came first?",
    "options": [{"text": "The telephone", "correct": True}, {"text": "The light bulb"}],
}


# ---------------------------------------------------------------- pure rules


def test_check_order_needs_every_item_in_place() -> None:
    assert check_order([3, 1, 2], [3, 1, 2]) is True
    assert check_order([1, 3, 2], [3, 1, 2]) is False
    assert check_order([3, 1], [3, 1, 2]) is None  # incomplete
    assert check_order([3, 3, 2], [3, 1, 2]) is None  # repeat
    assert check_order([3, 1, 9], [3, 1, 2]) is None  # unknown item


def test_new_types_get_the_right_allowance() -> None:
    assert banding_time(3_000, "truefalse") == 3_000
    assert banding_time(3_000, "pair") == 3_000
    assert banding_time(3_000, "order") == 500
    assert score_answer(True, 2_900, "order").band is not None
    with pytest.raises(ValueError):
        banding_time(1_000, "nonsense")


def test_content_rules_for_the_new_types() -> None:
    assert parse_day(day_with(ORDER), "2026-11-17.yaml").questions[5].type == "order"
    assert parse_day(day_with(TRUE_FALSE), "2026-11-17.yaml").questions[5].options[1].correct
    assert parse_day(day_with(PAIR), "2026-11-17.yaml").questions[5].options[0].correct
    for bad in (
        {**ORDER, "items": ORDER["items"][:3]},
        {**ORDER, "items": ["A", "B", "a", "C"]},
        {**TRUE_FALSE, "answer": "no"},
        {**PAIR, "options": PAIR["options"][:1]},
        {**PAIR, "options": [{"text": "A", "correct": True}, {"text": "B", "correct": True}]},
    ):
        with pytest.raises(ContentError):
            parse_day(day_with(bad), "2026-11-17.yaml")


# ---------------------------------------------------------------- through the API


def _to_slot6(
    client: TestClient,
    clock: FakeClock,
    session_factory: sessionmaker[Session],
    slot6: dict[str, Any],
) -> dict[str, Any]:
    with session_factory() as session:
        load_day(session, parse_day(day_with(slot6), "2026-11-17.yaml"))
        session.commit()
    for slot in range(1, 6):
        question = client.post("/api/play/ready").json()["question"]
        clock.advance(4)
        client.post(
            "/api/play/answer", json={"slot": slot, "option_id": question["options"][0]["id"]}
        )
    served = client.post("/api/play/ready").json()["question"]
    assert served["slot"] == 6
    clock.advance(4)
    return served  # type: ignore[no-any-return]


def test_order_question_scores_only_the_exact_order(
    client: TestClient, clock: FakeClock, session_factory: sessionmaker[Session]
) -> None:
    q = _to_slot6(client, clock, session_factory, ORDER)
    assert q["type"] == "order" and len(q["options"]) == 4
    shown = [o["text"] for o in q["options"]]
    assert shown != ORDER["items"]  # never shown already solved
    by_text = {o["text"]: o["id"] for o in q["options"]}
    assert (
        client.post(
            "/api/play/answer", json={"slot": 6, "order": [by_text["Magna Carta"]]}
        ).status_code
        == 422
    )
    right = [by_text[t] for t in ORDER["items"]]
    reveal = client.post("/api/play/answer", json={"slot": 6, "order": right}).json()
    assert reveal["outcome"] == "correct"
    assert reveal["correct_answer"] == " → ".join(ORDER["items"])
    assert reveal["your_answer"] == reveal["correct_answer"]


def test_true_false_keeps_true_first_and_checks_the_pick(
    client: TestClient, clock: FakeClock, session_factory: sessionmaker[Session]
) -> None:
    q = _to_slot6(client, clock, session_factory, TRUE_FALSE)
    assert [o["text"] for o in q["options"]] == ["True", "False"]
    reveal = client.post(
        "/api/play/answer", json={"slot": 6, "option_id": q["options"][0]["id"]}
    ).json()
    assert reveal["outcome"] == "wrong" and reveal["correct_answer"] == "False"


def test_pair_question_is_a_two_way_pick(
    client: TestClient, clock: FakeClock, session_factory: sessionmaker[Session]
) -> None:
    q = _to_slot6(client, clock, session_factory, PAIR)
    assert len(q["options"]) == 2
    first = next(o["id"] for o in q["options"] if o["text"] == "The telephone")
    assert (
        client.post("/api/play/answer", json={"slot": 6, "option_id": first}).json()["outcome"]
        == "correct"
    )
