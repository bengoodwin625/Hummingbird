"""Day boundaries. The quiz resets at 00:00 Europe/London."""

from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

LONDON = ZoneInfo("Europe/London")
LAUNCH_DATE = date(2026, 11, 17)


def quiz_date(now: datetime) -> date:
    """The quiz date in UK time for an aware datetime."""
    if now.tzinfo is None:
        raise ValueError("now must be timezone-aware")
    return now.astimezone(LONDON).date()


def quiz_number(day: date) -> int:
    """Quiz numbers count from the launch date, which is #1."""
    return (day - LAUNCH_DATE).days + 1


def next_unlock(now: datetime) -> datetime:
    """The next 00:00 Europe/London as an aware UTC datetime."""
    tomorrow = quiz_date(now) + timedelta(days=1)
    return datetime.combine(tomorrow, time(0, 0), tzinfo=LONDON).astimezone(UTC)
