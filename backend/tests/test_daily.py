from datetime import UTC, date, datetime

import pytest

from app.daily import next_unlock, quiz_date, quiz_number


def test_quiz_date_follows_uk_time_in_summer() -> None:
    # 23:30 UTC on 30 June is 00:30 BST on 1 July.
    assert quiz_date(datetime(2027, 6, 30, 23, 30, tzinfo=UTC)) == date(2027, 7, 1)


def test_quiz_date_in_winter_matches_utc() -> None:
    assert quiz_date(datetime(2026, 11, 17, 23, 59, tzinfo=UTC)) == date(2026, 11, 17)


def test_naive_datetimes_are_refused() -> None:
    with pytest.raises(ValueError):
        quiz_date(datetime(2026, 11, 17, 12, 0))


def test_quiz_numbers_start_at_launch() -> None:
    assert quiz_number(date(2026, 11, 17)) == 1
    assert quiz_number(date(2026, 11, 18)) == 2


def test_next_unlock_is_uk_midnight() -> None:
    assert next_unlock(datetime(2026, 11, 17, 9, 0, tzinfo=UTC)) == datetime(
        2026, 11, 18, 0, 0, tzinfo=UTC
    )
    assert next_unlock(datetime(2027, 6, 30, 12, 0, tzinfo=UTC)) == datetime(
        2027, 6, 30, 23, 0, tzinfo=UTC
    )
