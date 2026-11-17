from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient

from app import main

from .conftest import FakeClock


def _ready(client: TestClient) -> dict[str, Any]:
    response = client.post("/api/play/ready")
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


def _correct_option(client: TestClient, question: dict[str, Any]) -> int:
    for option in question["options"]:
        if option["text"].startswith("Right"):
            return int(option["id"])
    raise AssertionError("no correct option")


def _wrong_option(question: dict[str, Any]) -> int:
    for option in question["options"]:
        if not option["text"].startswith("Right"):
            return int(option["id"])
    raise AssertionError("no wrong option")


def test_today_before_playing(client: TestClient) -> None:
    body = client.get("/api/today").json()
    assert body["status"] == "not_started"
    assert body["number"] == 1
    assert body["next_slot"] == 1
    assert body["max_score"] == 8000
    assert main.PLAYER_COOKIE in client.cookies


def test_question_never_includes_the_answer(client: TestClient) -> None:
    served = _ready(client)
    question = served["question"]
    assert served["kind"] == "question"
    assert question["read_remaining_ms"] == 3000
    assert {"id", "text"} == set(question["options"][0])
    assert "correct" not in str(served).lower().replace("correct_", "")


def test_full_play_scores_by_animal(client: TestClient, clock: FakeClock) -> None:
    total = 0
    expected_points = {1: 1000, 2: 700, 3: 450, 4: 250, 5: 100, 6: 0}
    answer_after = {1: 0.6, 2: 1.3, 3: 2.3, 4: 3.8, 5: 6.3, 6: 2.0}
    for slot in range(1, 7):
        question = _ready(client)["question"]
        assert question["slot"] == slot
        clock.advance(3 + answer_after[slot])
        option = _correct_option(client, question) if slot != 6 else _wrong_option(question)
        reveal = client.post("/api/play/answer", json={"slot": slot, "option_id": option}).json()
        total += expected_points[slot]
        assert reveal["points"] == expected_points[slot]
        assert reveal["total_score"] == total
        assert reveal["correct_answer"] == f"Right {slot}"
        assert reveal["elapsed_ms"] == round(answer_after[slot] * 1000) - 300

    question = _ready(client)["question"]
    assert question["type"] == "number" and question["options"] == []
    clock.advance(4)
    blank = client.post("/api/play/answer", json={"slot": 7, "value": "  "})
    assert blank.status_code == 422 and blank.json()["code"] == "blank"
    words = client.post("/api/play/answer", json={"slot": 7, "value": "lots"})
    assert words.json()["code"] == "not_a_number"
    reveal = client.post("/api/play/answer", json={"slot": 7, "value": "206"}).json()
    assert reveal["outcome"] == "correct" and reveal["band"] == "hummingbird"
    total += 1000

    _ready(client)
    clock.advance(3 + 5.8)
    reveal = client.post("/api/play/answer", json={"slot": 8, "value": "radiohaed"}).json()
    # 7.7 s typed, minus the 2.5 s typing allowance, is banded as 5.2 s.
    assert reveal["outcome"] == "correct" and reveal["band"] == "tree_frog"
    assert reveal["elapsed_ms"] == 5_500
    total += 250
    assert reveal["finished"] is True
    assert reveal["total_score"] == total

    today = client.get("/api/today").json()
    assert today["status"] == "finished" and today["total_score"] == total
    assert client.post("/api/play/ready").json()["code"] == "finished"

    results = client.get("/api/results").json()
    assert results["total_score"] == total
    assert results["correct_count"] == 7
    assert [q["band"] for q in results["questions"]][:6] == [
        "hummingbird", "jaguar", "toucan", "tree_frog", "sloth", None
    ]
    assert results["questions"][5]["percent_correct"] == 0
    assert results["questions"][0]["percent_correct"] == 100
    assert results["speed"]["faster_than_percent"] is None
    assert results["speed"]["players"] == 1
    assert results["speed"]["fastest_ms"] == 300
    assert results["speed"]["everyone_avg_ms"] == results["avg_correct_elapsed_ms"]
    assert results["standing"] == {
        "rank": 1,
        "players": 1,
        "better_than_percent": None,
        "average_score": total,
    }


def test_answer_before_reading_time_is_not_counted(client: TestClient, clock: FakeClock) -> None:
    question = _ready(client)["question"]
    clock.advance(2.9)
    early = client.post(
        "/api/play/answer", json={"slot": 1, "option_id": _correct_option(client, question)}
    )
    assert early.status_code == 409 and early.json()["code"] == "too_early"
    clock.advance(0.2)
    ok = client.post(
        "/api/play/answer", json={"slot": 1, "option_id": _correct_option(client, question)}
    )
    assert ok.json()["outcome"] == "correct"


def test_one_go_only_and_retries_get_the_stored_result(
    client: TestClient, clock: FakeClock
) -> None:
    question = _ready(client)["question"]
    clock.advance(4)
    first = client.post("/api/play/answer", json={"slot": 1, "option_id": _wrong_option(question)})
    assert first.json()["outcome"] == "wrong"
    clock.advance(1)
    second = client.post(
        "/api/play/answer", json={"slot": 1, "option_id": _correct_option(client, question)}
    )
    assert second.json() == first.json()


def test_invalid_option_is_rejected(client: TestClient, clock: FakeClock) -> None:
    _ready(client)
    clock.advance(4)
    bad = client.post("/api/play/answer", json={"slot": 1, "option_id": 999_999})
    assert bad.status_code == 422 and bad.json()["code"] == "invalid_option"


def test_timeout_only_after_the_limit(client: TestClient, clock: FakeClock) -> None:
    _ready(client)
    clock.advance(3 + 15.5)
    early = client.post("/api/play/timeout", json={"slot": 1})
    assert early.status_code == 409 and early.json()["code"] == "not_yet"
    assert early.json()["retry_after_ms"] > 0
    clock.advance(1)
    reveal = client.post("/api/play/timeout", json={"slot": 1}).json()
    assert reveal["outcome"] == "timeout" and reveal["points"] == 0
    assert reveal["correct_answer"] == "Right 1"


def test_late_answer_is_a_timeout(client: TestClient, clock: FakeClock) -> None:
    question = _ready(client)["question"]
    clock.advance(3 + 17)
    reveal = client.post(
        "/api/play/answer", json={"slot": 1, "option_id": _correct_option(client, question)}
    ).json()
    assert reveal["outcome"] == "timeout"


def test_answer_inside_grace_second_counts_as_sloth(client: TestClient, clock: FakeClock) -> None:
    question = _ready(client)["question"]
    clock.advance(3 + 15.8)
    reveal = client.post(
        "/api/play/answer", json={"slot": 1, "option_id": _correct_option(client, question)}
    ).json()
    assert reveal["outcome"] == "correct"
    assert reveal["band"] == "sloth" and reveal["elapsed_ms"] == 15_000


def test_reload_mid_question_keeps_the_original_clock(
    client: TestClient, clock: FakeClock
) -> None:
    _ready(client)
    clock.advance(5)
    today = client.get("/api/today").json()
    assert today["question_live"] is True and today["next_slot"] == 1
    again = _ready(client)
    assert again["kind"] == "question" and again["question"]["slot"] == 1
    assert again["question"]["read_remaining_ms"] == 0


def test_reload_after_the_limit_reveals_a_timeout(client: TestClient, clock: FakeClock) -> None:
    _ready(client)
    clock.advance(30)
    served = _ready(client)
    assert served["kind"] == "reveal"
    assert served["reveal"]["outcome"] == "timeout"
    assert _ready(client)["question"]["slot"] == 2


def test_backup_header_restores_the_player(client: TestClient, clock: FakeClock) -> None:
    player_id = client.get("/api/today").json()["player_id"]
    _ready(client)
    client.cookies.clear()
    restored = client.get("/api/today", headers={main.PLAYER_HEADER: player_id}).json()
    assert restored["player_id"] == player_id
    assert restored["status"] == "in_progress"


def test_results_need_a_finished_play(client: TestClient) -> None:
    response = client.get("/api/results")
    assert response.status_code == 409


def test_rate_limit(client: TestClient) -> None:
    main.app.state.rate_limiter = main._RateLimiter(2, 10.0)
    client.post("/api/play/ready")
    client.post("/api/play/ready")
    assert client.post("/api/play/ready").status_code == 429


def test_no_quiz_day(client: TestClient, clock: FakeClock) -> None:
    clock.advance(60 * 60 * 24 * 3)
    assert client.get("/api/today").json()["status"] == "no_quiz"
    assert client.post("/api/play/ready").json()["code"] == "no_quiz"


def test_speed_comparison_between_players(client: TestClient, clock: FakeClock) -> None:
    def play_all(seconds: float) -> None:
        for slot in range(1, 9):
            question = _ready(client)["question"]
            clock.advance(3 + seconds)
            if question["type"] == "choice":
                payload: dict[str, Any] = {
                    "slot": slot, "option_id": _correct_option(client, question)
                }
            elif question["type"] == "number":
                payload = {"slot": slot, "value": "206"}
            else:
                payload = {"slot": slot, "value": "Radiohead"}
            client.post("/api/play/answer", json=payload)

    play_all(6.0)
    client.cookies.clear()
    play_all(2.0)
    results = client.get("/api/results").json()
    assert results["speed"]["faster_than_percent"] == 100
    assert results["speed"]["players"] == 2
    # Averages of 5.7 s and 1.7 s give an everyone-average of 3.7 s.
    assert results["speed"]["everyone_avg_ms"] == 3_700
    assert results["speed"]["fastest_ms"] == 1_700
    # Both players got everything right, so the faster one scores more and ranks first.
    standing = results["standing"]
    assert standing["rank"] == 1 and standing["players"] == 2
    assert standing["better_than_percent"] == 100
