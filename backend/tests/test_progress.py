from datetime import date, timedelta

import pytest

from app.progress import (
    GOLDEN_MS,
    Catch,
    anon_name,
    clean_display_name,
    clean_league_name,
    field_guide,
    new_code,
    normalise_code,
    streaks,
    week_start,
    weekly_total,
)

TODAY = date(2026, 11, 20)


def days_back(*offsets: int) -> list[date]:
    return [TODAY - timedelta(days=n) for n in offsets]


def test_streak_counts_today_and_the_days_before() -> None:
    s = streaks(days_back(0, 1, 2), [], TODAY)
    assert (s.current, s.best) == (3, 3)


def test_streak_survives_until_a_whole_day_is_missed() -> None:
    # Played yesterday and the day before, not yet today: still alive.
    assert streaks(days_back(1, 2), [], TODAY).current == 2
    # Missed yesterday: gone, but the best run is remembered.
    s = streaks(days_back(2, 3, 4, 5), [], TODAY)
    assert (s.current, s.best) == (0, 4)


def test_hummingbird_streak_only_counts_played_days_with_a_hummingbird() -> None:
    s = streaks(days_back(0, 1, 2, 3), days_back(0, 1, 3, 9), TODAY)
    assert (s.hummingbird_current, s.hummingbird_best) == (2, 2)


def test_no_plays_means_no_streak() -> None:
    s = streaks([], [], TODAY)
    assert (s.current, s.best, s.hummingbird_current, s.hummingbird_best) == (0, 0, 0, 0)


def test_field_guide_counts_animals_golden_and_perfect_days() -> None:
    perfect_day = [Catch("hummingbird", GOLDEN_MS)] + [Catch("toucan", 2000)] * 7
    other_day = [Catch("hummingbird", GOLDEN_MS + 1), Catch("sloth", 6000), Catch(None, None)]
    guide = field_guide([perfect_day, other_day])
    assert guide.counts["hummingbird"] == 2
    assert guide.counts["toucan"] == 7
    assert guide.counts["sloth"] == 1
    assert guide.counts["jaguar"] == 0
    assert guide.golden == 1
    assert guide.perfect_days == 1


def test_weeks_start_on_monday_and_count_the_best_five_days() -> None:
    assert week_start(date(2026, 11, 22)) == date(2026, 11, 16)  # Sunday → Monday
    assert week_start(date(2026, 11, 16)) == date(2026, 11, 16)
    assert weekly_total([100, 900, 500, 700, 300, 800, 200]) == 900 + 800 + 700 + 500 + 300
    assert weekly_total([400, 600]) == 1000
    assert weekly_total([]) == 0


def test_display_names_are_tidied_and_checked() -> None:
    assert clean_display_name("  Ben   G  ") == "Ben G"
    assert clean_display_name("Zoë-Ann") == "Zoë-Ann"
    for bad in ["a", "x" * 21, "<script>", "hi\x00there!", "   "]:
        with pytest.raises(ValueError):
            clean_display_name(bad)
    assert clean_league_name("The Office Quiz Crew") == "The Office Quiz Crew"


def test_anonymous_names_are_stable() -> None:
    assert anon_name("abc").startswith("Anonymous ")
    assert anon_name("abc") == anon_name("abc")


def test_codes_avoid_lookalike_characters_and_normalise() -> None:
    code = new_code(10)
    assert len(code) == 10 and not set(code) & set("01IO")
    assert normalise_code(" ab3d-e f ") == "AB3DEF"
