from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient

from .conftest import FakeClock


def _play_all(client: TestClient, clock: FakeClock, seconds: float = 1.0) -> dict[str, Any]:
    """Answer all eight questions correctly, `seconds` after each opens. Returns the results."""
    for slot in range(1, 9):
        question = client.post("/api/play/ready").json()["question"]
        clock.advance(3 + seconds)
        if question["type"] == "choice":
            option = next(o for o in question["options"] if o["text"].startswith("Right"))
            payload: dict[str, Any] = {"slot": slot, "option_id": option["id"]}
        elif question["type"] == "number":
            payload = {"slot": slot, "value": "206"}
        else:
            payload = {"slot": slot, "value": "Radiohead"}
        assert client.post("/api/play/answer", json=payload).status_code == 200
    results: dict[str, Any] = client.get("/api/results").json()
    return results


def test_me_starts_empty_then_counts_a_finished_day(client: TestClient, clock: FakeClock) -> None:
    me = client.get("/api/me").json()
    assert me["display_name"] is None
    assert me["streak"]["current"] == 0 and me["days_played"] == 0
    assert all(n == 0 for n in me["guide"]["counts"].values())

    _play_all(client, clock, seconds=0.5)
    me = client.get("/api/me").json()
    assert me["streak"]["current"] == 1 and me["streak"]["best"] == 1
    assert me["days_played"] == 1
    assert sum(me["guide"]["counts"].values()) == 8
    assert me["guide"]["perfect_days"] == 1


def test_names_are_validated(client: TestClient) -> None:
    assert client.put("/api/me/name", json={"display_name": "x"}).status_code == 400
    response = client.put("/api/me/name", json={"display_name": "  Ben  "})
    assert response.status_code == 200 and response.json()["display_name"] == "Ben"
    assert client.get("/api/me").json()["display_name"] == "Ben"


def test_sync_code_moves_a_player_to_another_device(client: TestClient) -> None:
    client.put("/api/me/name", json={"display_name": "Ben"})
    code = client.post("/api/me/sync-code").json()["code"]
    assert code == client.post("/api/me/sync-code").json()["code"]  # stable once made
    assert len(code.replace("-", "")) == 10

    client.cookies.clear()  # a new device
    assert client.get("/api/me").json()["display_name"] is None
    assert client.post("/api/me/sync", json={"code": "WRONGCODE2"}).status_code == 404
    assert client.post("/api/me/sync", json={"code": "short"}).status_code == 400
    response = client.post("/api/me/sync", json={"code": code.lower()})
    assert response.status_code == 200
    assert client.get("/api/me").json()["display_name"] == "Ben"


def test_leagues_need_a_name_then_share_scores(client: TestClient, clock: FakeClock) -> None:
    assert client.post("/api/leagues", json={"name": "Office"}).json()["code"] == "name_required"
    client.put("/api/me/name", json={"display_name": "Ben"})
    league = client.post("/api/leagues", json={"name": "Office"}).json()
    assert league["owner"] and league["name"] == "Office" and len(league["code"]) == 6
    _play_all(client, clock, seconds=0.5)

    client.cookies.clear()  # a friend
    assert client.post("/api/leagues/join", json={"code": league["code"]}).status_code == 409
    client.put("/api/me/name", json={"display_name": "Sam"})
    assert client.post("/api/leagues/join", json={"code": "ZZZZZZ"}).status_code == 404
    joined = client.post("/api/leagues/join", json={"code": league["code"].lower()}).json()
    names = [m["name"] for m in joined["members"]]
    assert names == ["Ben", "Sam"]  # Ben has played today, so he's listed first
    ben = joined["members"][0]
    assert ben["today"] == 8000 and len(ben["today_bands"]) == 8
    # The week and today's total are combined scores: Speed / 8 plus How Close.
    assert ben["today_total"] == 1000 and ben["week"] == 1000 and ben["today_close"] is None
    assert joined["members"][1]["today"] is None and not joined["owner"]

    assert len(client.get("/api/leagues").json()) == 1
    assert client.post(f"/api/leagues/{league['id']}/leave").status_code == 200
    assert client.get("/api/leagues").json() == []
    assert client.post(f"/api/leagues/{league['id']}/leave").status_code == 404


def test_weekly_league_ranks_by_best_five_days(client: TestClient, clock: FakeClock) -> None:
    client.put("/api/me/name", json={"display_name": "Ben"})
    _play_all(client, clock, seconds=0.5)
    client.cookies.clear()
    _play_all(client, clock, seconds=3.0)
    week = client.get("/api/week").json()
    assert week["week_start"] == "2026-11-16"
    assert [row["name"] for row in week["top"]][0] == "Ben"
    assert week["top"][0]["total"] == 8000
    assert week["you"]["rank"] == 2 and week["you"]["name"].startswith("Anonymous")


def test_challenge_links_share_the_score_but_never_the_answers(
    client: TestClient, clock: FakeClock
) -> None:
    client.put("/api/me/name", json={"display_name": "Ben"})
    results = _play_all(client, clock, seconds=0.5)
    code = results["challenge_code"]
    assert code == client.get("/api/results").json()["challenge_code"]

    client.cookies.clear()
    challenge = client.get(f"/api/challenge/{code}").json()
    assert challenge["name"] == "Ben" and challenge["total_score"] == 8000
    assert challenge["is_today"] and challenge["number"] == 1
    assert len(challenge["bands"]) == 8
    assert "Right" not in str(challenge) and "Radiohead" not in str(challenge)
    assert client.get("/api/challenge/NOPE1234").status_code == 404


def _play_close(client: TestClient, clock: FakeClock, guess: str = "50") -> None:
    for slot in range(1, 6):
        client.post("/api/numbers/ready")
        clock.advance(4)
        client.post("/api/numbers/answer", json={"slot": slot, "value": guess})


def _with_numbers(session_factory: Any) -> None:
    from app.content import load_day, parse_day

    from .test_numbers import numbers_day

    with session_factory() as session:
        load_day(session, parse_day(numbers_day(), "2026-11-17.yaml"))
        session.commit()


def test_leagues_show_both_games_and_a_combined_total(
    client: TestClient, clock: FakeClock, session_factory: Any
) -> None:
    _with_numbers(session_factory)
    client.put("/api/me/name", json={"display_name": "Ben"})
    league = client.post("/api/leagues", json={"name": "Office"}).json()
    _play_all(client, clock, seconds=0.5)  # 8,000
    _play_close(client, clock)  # only slot 1 is right (50); the rest score by closeness
    me = client.get("/api/me").json()
    close = me["today"]["close"]
    assert me["today"]["speed"] == 8000 and close > 0
    assert me["today"]["combined"] == 1000 + close
    assert me["guide"]["bullseyes"] >= 1
    member = client.get("/api/leagues").json()[0]["members"][0]
    assert (member["today"], member["today_close"]) == (8000, close)
    assert member["today_total"] == 1000 + close and member["week"] == 1000 + close
    assert league["code"]


def test_weekly_table_for_each_game(
    client: TestClient, clock: FakeClock, session_factory: Any
) -> None:
    _with_numbers(session_factory)
    client.put("/api/me/name", json={"display_name": "Ben"})
    _play_close(client, clock)
    close = client.get("/api/me").json()["today"]["close"]
    assert client.get("/api/week").json()["top"] == []  # no speed quiz played yet
    by_close = client.get("/api/week?game=close").json()
    assert by_close["game"] == "close" and by_close["top"][0]["total"] == close
    assert client.get("/api/week?game=combined").json()["top"][0]["total"] == close
    assert client.get("/api/week?game=nonsense").status_code == 422
