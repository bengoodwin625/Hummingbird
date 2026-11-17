import pytest

from app.scoring import (
    ANSWER_LIMIT_MS,
    LATENCY_ALLOWANCE_MS,
    MAX_POINTS_PER_DAY,
    Band,
    Outcome,
    band_for,
    banding_time,
    elapsed_ms,
    is_timed_out,
    is_too_early,
    points_for,
    score_answer,
    score_timeout,
)


@pytest.mark.parametrize(
    ("elapsed", "band"),
    [
        (0, Band.HUMMINGBIRD),
        (500, Band.HUMMINGBIRD),
        (501, Band.JAGUAR),
        (1_200, Band.JAGUAR),
        (1_201, Band.TOUCAN),
        (2_500, Band.TOUCAN),
        (2_501, Band.TREE_FROG),
        (4_500, Band.TREE_FROG),
        (4_501, Band.SLOTH),
        (15_000, Band.SLOTH),
    ],
)
def test_band_boundaries_belong_to_the_faster_band(elapsed: int, band: Band) -> None:
    assert band_for(elapsed) == band


def test_band_rejects_negative_time() -> None:
    with pytest.raises(ValueError):
        band_for(-1)


def test_points_come_only_from_the_band_and_fall_steeply() -> None:
    assert [points_for(b) for b in Band] == [1_000, 700, 450, 250, 100]
    # Two different times in the same band score the same.
    assert score_answer(True, 600).points == score_answer(True, 1_100).points == 700
    assert MAX_POINTS_PER_DAY == 8_000


def test_correct_answer_records_time_band_and_points() -> None:
    score = score_answer(True, 1_000)
    assert score.outcome == Outcome.CORRECT
    assert score.elapsed_ms == 1_000
    assert score.band == Band.JAGUAR
    assert score.points == 700


def test_typed_answers_get_a_typing_allowance_but_keep_their_real_time() -> None:
    assert banding_time(2_000, "choice") == 2_000
    assert banding_time(2_000, "number") == 500
    assert banding_time(2_000, "text") == 0
    number = score_answer(True, 1_900, "number")
    assert number.band == Band.HUMMINGBIRD and number.elapsed_ms == 1_900
    text = score_answer(True, 3_500, "text")
    assert text.band == Band.JAGUAR and text.elapsed_ms == 3_500
    # The same time on a tap question is two bands slower.
    assert score_answer(True, 3_500, "choice").band == Band.TREE_FROG
    with pytest.raises(ValueError):
        banding_time(1_000, "ordering")


def test_wrong_answer_scores_zero_but_keeps_its_time() -> None:
    score = score_answer(False, 1_000, "text")
    assert score.outcome == Outcome.WRONG
    assert score.elapsed_ms == 1_000
    assert score.band is None
    assert score.points == 0


def test_timeout_scores_zero_with_no_time() -> None:
    score = score_timeout()
    assert (score.outcome, score.elapsed_ms, score.band, score.points) == (
        Outcome.TIMEOUT,
        None,
        None,
        0,
    )


def test_elapsed_subtracts_latency_floors_at_zero_and_caps_at_limit() -> None:
    assert elapsed_ms(10_000, 13_400) == 3_400 - LATENCY_ALLOWANCE_MS
    assert elapsed_ms(10_000, 10_100) == 0
    assert elapsed_ms(10_000, 10_000 + ANSWER_LIMIT_MS + 900) == ANSWER_LIMIT_MS


def test_too_early_and_timeout_edges() -> None:
    assert is_too_early(10_000, 9_999)
    assert not is_too_early(10_000, 10_000)
    assert not is_timed_out(10_000, 10_000 + 16_000)
    assert is_timed_out(10_000, 10_000 + 16_001)
