from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app import main, models
from app.content import load_day, parse_day
from app.db import get_session

REPO_ROOT = Path(__file__).resolve().parents[2]


class FakeClock:
    def __init__(self, start: datetime) -> None:
        self.now = start

    def __call__(self) -> datetime:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += timedelta(seconds=seconds)


def sample_day(day: str = "2026-11-17") -> dict[str, object]:
    """A valid day: 6 choice, 1 number, 1 text."""
    questions: list[dict[str, object]] = []
    for slot in range(1, 7):
        questions.append(
            {
                "slot": slot,
                "type": "choice",
                "category": "general",
                "text": f"Choice question {slot}?",
                "options": [
                    {"text": f"Right {slot}", "correct": True},
                    {"text": f"Wrong A{slot}"},
                    {"text": f"Wrong B{slot}"},
                    {"text": f"Wrong C{slot}"},
                    {"text": f"Wrong D{slot}"},
                    {"text": f"Wrong E{slot}"},
                ],
            }
        )
    questions.append(
        {
            "slot": 7,
            "type": "number",
            "category": "science",
            "text": "How many bones are in the adult human body?",
            "answer": 206,
            "tolerance": 0,
        }
    )
    questions.append(
        {
            "slot": 8,
            "type": "text",
            "category": "music",
            "text": "Which band released the album 'OK Computer'?",
            "answers": [{"canonical": "Radiohead", "aliases": ["radio head"]}],
        }
    )
    return {"date": day, "questions": questions}


@pytest.fixture
def session_factory() -> Iterator[sessionmaker[Session]]:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    models.Base.metadata.create_all(engine)
    yield sessionmaker(bind=engine, expire_on_commit=False)
    engine.dispose()


@pytest.fixture
def clock() -> FakeClock:
    # 09:00 UK time on 17 November 2026 (GMT, so the same as UTC).
    return FakeClock(datetime(2026, 11, 17, 9, 0, tzinfo=UTC))


@pytest.fixture
def client(session_factory: sessionmaker[Session], clock: FakeClock) -> Iterator[TestClient]:
    with session_factory() as session:
        load_day(session, parse_day(sample_day(), "2026-11-17.yaml"))
        session.commit()

    def _session() -> Iterator[Session]:
        with session_factory() as session:
            yield session

    main.app.dependency_overrides[get_session] = _session
    original_clock = main.app.state.clock
    original_limiter = main.app.state.rate_limiter
    main.app.state.clock = clock
    main.app.state.rate_limiter = main._RateLimiter(1000, 10.0)
    with TestClient(main.app) as test_client:
        yield test_client
    main.app.dependency_overrides.clear()
    main.app.state.clock = original_clock
    main.app.state.rate_limiter = original_limiter
