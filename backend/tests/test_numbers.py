from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker

from app.content import ContentError, DayLockedError, load_day, parse_day

from .conftest import FakeClock, sample_day

ANSWERS = [50, 1_500, 7, 365, 22]


def numbers_day() -> dict[str, Any]:
    day = sample_day()
    day["numbers"] = [
        {"slot": i, "category": "general", "text": f"Guess {i}?", "answer": a}
        for i, a in enumerate(ANSWERS, start=1)
    ]
    day["numbers"][4]["spread"] = 1.2
    return day


@pytest.fixture
def numbers_client(client: TestClient, session_factory: sessionmaker[Session]) -> TestClient:
    with session_factory() as session:
        load_day(session, parse_day(numbers_day(), "2026-11-17.yaml"))
        session.commit()
    return client


def _guess(
    client: TestClient, clock: FakeClock, slot: int, value: str, seconds: float
) -> dict[str, Any]:
    served = client.post("/api/numbers/ready").json()
    assert served["kind"] == "question" and served["question"]["slot"] == slot
    assert "answer" not in served["question"]  # the answer is never sent before the guess
    clock.advance(3 + seconds)
    response = client.post("/api/numbers/answer", json={"slot": slot, "value": value})
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


def test_content_validates_the_numbers_section() -> None:
    assert len(parse_day(numbers_day(), "2026-11-17.yaml").numbers) == 5
    bad = numbers_day()
    bad["numbers"] = bad["numbers"][:4]
    with pytest.raises(ContentError):
        parse_day(bad, "2026-11-17.yaml")
    bad = numbers_day()
    bad["numbers"][0]["answer"] = -3
    with pytest.raises(ContentError):
        parse_day(bad, "2026-11-17.yaml")
    bad = numbers_day()
    bad["numbers"][0]["spread"] = 9
    with pytest.raises(ContentError):
        parse_day(bad, "2026-11-17.yaml")


def test_no_numbers_quiz_without_numbers_content(client: TestClient) -> None:
    assert client.get("/api/numbers/today").json()["status"] == "no_quiz"
    assert client.post("/api/numbers/ready").status_code == 404


def test_full_numbers_play(numbers_client: TestClient, clock: FakeClock) -> None:
    client = numbers_client
    today = client.get("/api/numbers/today").json()
    assert today["status"] == "not_started" and today["total_questions"] == 5
    assert today["max_score"] == 1100

    exact = _guess(client, clock, 1, "50", 2.0)  # Hummingbird: 100 x 2, plus the Bullseye
    assert (exact["closeness"], exact["band"], exact["points"]) == (100, "hummingbird", 220)
    assert exact["bullseye"] and exact["bonus"] == 20
    assert exact["answer"] == "50"
    close = _guess(client, clock, 2, "1,650", 5.0)  # 10% high, Jaguar
    assert (close["closeness"], close["band"], close["points"]) == (93, "jaguar", 158)
    miss = _guess(client, clock, 3, "1000", 1.0)  # way off: nothing
    assert (miss["outcome"], miss["band"], miss["points"]) == ("wrong", None, 0)
    slow = _guess(client, clock, 4, "365", 25.0)  # Sloth: 100 x 1, plus the Bullseye
    assert (slow["band"], slow["points"]) == ("sloth", 120)
    loose = _guess(client, clock, 5, "44", 9.0)  # double, but a spread of 1.2: 75 x 1.45
    assert (loose["closeness"], loose["band"], loose["points"]) == (75, "toucan", 109)
    assert not loose["bullseye"]
    assert loose["finished"] and loose["total_score"] == 220 + 158 + 0 + 120 + 109

    results = client.get("/api/numbers/results").json()
    assert results["total_score"] == 607 and len(results["questions"]) == 5
    assert [q["bullseye"] for q in results["questions"]] == [True, False, False, True, False]
    assert results["avg_closeness"] == round((100 + 93 + 0 + 100 + 75) / 5)
    assert results["better_than_percent"] is None
    assert results["others"] is False and results["everyone_avg_ms"] is None
    assert len(results["distribution"]) == 22 and sum(results["distribution"]) == 1
    assert results["distribution"][607 // 50] == 1
    # Average time over the four answered guesses: 2, 5, 1, 25 and 9 s minus 0.3 s each.
    assert results["avg_elapsed_ms"] == round((1_700 + 4_700 + 700 + 24_700 + 8_700) / 5)
    # The speed quiz is untouched by a Numbers play.
    assert client.get("/api/today").json()["status"] == "not_started"


def test_bad_guesses_dont_use_the_go(numbers_client: TestClient, clock: FakeClock) -> None:
    client = numbers_client
    client.post("/api/numbers/ready")
    early = client.post("/api/numbers/answer", json={"slot": 1, "value": "50"})
    assert early.status_code == 409
    clock.advance(4)
    assert client.post("/api/numbers/answer", json={"slot": 1, "value": "  "}).status_code == 422
    assert client.post("/api/numbers/answer", json={"slot": 1, "value": "lots"}).status_code == 422
    assert client.post("/api/numbers/answer", json={"slot": 1, "value": "50"}).json()["points"] > 0


def test_the_longer_answer_window_and_timeouts(
    numbers_client: TestClient, clock: FakeClock
) -> None:
    client = numbers_client
    client.post("/api/numbers/ready")
    clock.advance(3 + 20)  # past the speed quiz's 15 s, inside the Numbers 30 s
    assert client.post("/api/numbers/timeout", json={"slot": 1}).status_code == 409
    clock.advance(12)
    timed_out = client.post("/api/numbers/timeout", json={"slot": 1}).json()
    assert timed_out["outcome"] == "timeout" and timed_out["points"] == 0
    assert timed_out["answer"] == "50"


def test_numbers_can_be_added_to_a_day_whose_speed_quiz_was_played(
    client: TestClient, session_factory: sessionmaker[Session], clock: FakeClock
) -> None:
    # Someone plays the speed quiz first...
    client.post("/api/play/ready")
    with session_factory() as session:
        # ...then numbers questions are added to the same file: they still load.
        assert load_day(session, parse_day(numbers_day(), "2026-11-17.yaml")) == ["numbers"]
        session.commit()
        # Once both games are played, the day is fully locked.
    client.post("/api/numbers/ready")
    with session_factory() as session, pytest.raises(DayLockedError):
        load_day(session, parse_day(numbers_day(), "2026-11-17.yaml"))
