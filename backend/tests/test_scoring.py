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


def test_score_distribution_buckets_every_total() -> None:
    from app.scoring import score_distribution

    counts = score_distribution([0, 499, 500, 1_700, 7_999, 8_000])
    assert len(counts) == 16
    assert counts[0] == 2  # 0 and 499
    assert counts[1] == 1  # exactly 500 starts the next bucket
    assert counts[3] == 1  # 1,700
    assert counts[15] == 2  # 7,999 and a perfect 8,000 share the top bucket
    assert sum(counts) == 6


def test_score_distribution_empty_and_out_of_range() -> None:
    from app.scoring import score_distribution

    assert score_distribution([]) == [0] * 16
    assert score_distribution([-5, 9_000]) == [1] + [0] * 14 + [1]


# ---------------------------------------------------------------- the Numbers quiz


def test_closeness_is_100_for_exact_and_falls_by_ratio() -> None:
    from app.scoring import closeness

    assert closeness(50, 50) == 100
    assert closeness(55, 50) == 93  # 10% high
    assert closeness(45, 50) == 92  # 10% low
    assert closeness(100, 50) == 50  # double
    assert closeness(25, 50) == 50  # half: the same as double
    assert closeness(200, 50) == 0  # four times
    assert closeness(1_000_000, 50) == 0


def test_closeness_rejects_nonsense_and_honours_spread() -> None:
    import pytest

    from app.scoring import closeness

    assert closeness(0, 50) == 0
    assert closeness(-5, 50) == 0
    assert closeness(100, 50, spread=1.2) == 75  # a looser question
    with pytest.raises(ValueError):
        closeness(10, 10, spread=0)


def test_numbers_score_multiplies_closeness_by_the_animal() -> None:
    from app.scoring import Band, Outcome, score_numbers

    fast = score_numbers(50, 50, 4_000)
    assert (fast.band, fast.multiplier, fast.points) == (Band.HUMMINGBIRD, 2.0, 220)
    assert fast.bullseye and fast.bonus == 20
    jaguar = score_numbers(55, 50, 4_001)
    assert (jaguar.band, jaguar.points) == (Band.JAGUAR, round(93 * 1.7))
    assert score_numbers(50, 50, 11_000).band == Band.TOUCAN
    assert score_numbers(50, 50, 17_000).band == Band.TREE_FROG
    slow = score_numbers(50, 50, 29_000)
    assert (slow.band, slow.points) == (Band.SLOTH, 120)
    miss = score_numbers(500, 50, 1_000)
    assert (miss.outcome, miss.band, miss.points) == (Outcome.WRONG, None, 0)


def test_numbers_limits_use_the_longer_window() -> None:
    from app.scoring import NUMBERS_ANSWER_LIMIT_MS, NUMBERS_MAX_PER_DAY, elapsed_ms, is_timed_out

    assert NUMBERS_MAX_PER_DAY == 1_100
    assert elapsed_ms(0, 60_000, NUMBERS_ANSWER_LIMIT_MS) == NUMBERS_ANSWER_LIMIT_MS
    assert not is_timed_out(0, 30_500, NUMBERS_ANSWER_LIMIT_MS)
    assert is_timed_out(0, 31_001, NUMBERS_ANSWER_LIMIT_MS)


def test_score_distribution_for_the_how_close_quiz() -> None:
    from app.scoring import NUMBERS_DISTRIBUTION_BUCKET, NUMBERS_MAX_PER_DAY, score_distribution

    counts = score_distribution(
        [0, 49, 50, 567, 1_100], NUMBERS_DISTRIBUTION_BUCKET, NUMBERS_MAX_PER_DAY
    )
    assert len(counts) == 22
    assert counts[0] == 2 and counts[1] == 1 and counts[11] == 1 and counts[21] == 1


def test_bullseye_is_within_one_percent_and_earns_a_bonus() -> None:
    from app.scoring import BULLSEYE_BONUS, closeness, is_bullseye, score_numbers

    assert is_bullseye(50.5, 50) and is_bullseye(49.5, 50)
    assert not is_bullseye(50.6, 50)
    assert closeness(10_050, 10_000) == 100  # inside 1% counts as spot on
    near = score_numbers(10_050, 10_000, 6_000)
    assert near.bullseye and near.points == round(100 * 1.7) + BULLSEYE_BONUS
    close = score_numbers(10_200, 10_000, 6_000)
    assert not close.bullseye and close.bonus == 0
