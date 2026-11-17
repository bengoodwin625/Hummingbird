import pytest

from app.db import database_url, normalise_database_url


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("postgres://u:p@host:5432/db", "postgresql+psycopg://u:p@host:5432/db"),
        ("postgresql://u:p@host/db", "postgresql+psycopg://u:p@host/db"),
        ("postgresql+psycopg://u:p@host/db", "postgresql+psycopg://u:p@host/db"),
        ("sqlite:///local.db", "sqlite:///local.db"),
    ],
)
def test_normalise_database_url(raw: str, expected: str) -> None:
    assert normalise_database_url(raw) == expected


def test_database_url_defaults_to_local_sqlite(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    assert database_url().startswith("sqlite:///")
    monkeypatch.setenv("DATABASE_URL", "postgres://u:p@h/d")
    assert database_url() == "postgresql+psycopg://u:p@h/d"
