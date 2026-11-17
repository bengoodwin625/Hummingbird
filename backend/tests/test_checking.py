from decimal import Decimal

import pytest

from app.checking import (
    build_text_answer,
    check_number,
    check_text,
    damerau_levenshtein,
    is_blank,
    normalise,
    parse_number,
)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("  The Beatles ", "beatles"),
        ("Beyoncé", "beyonce"),
        ("Simon & Garfunkel", "simon and garfunkel"),
        ("Rock'n'Roll!", "rocknroll"),
        ("Jean-Paul   Sartre", "jean paul sartre"),
        ("A", "a"),
        ("Ça va?", "ca va"),
    ],
)
def test_normalise(raw: str, expected: str) -> None:
    assert normalise(raw) == expected


@pytest.mark.parametrize("raw", ["", "   ", "?!", "...", "—"])
def test_empty_and_punctuation_only_input_is_blank(raw: str) -> None:
    assert is_blank(raw)


def test_damerau_levenshtein_counts_transpositions_as_one() -> None:
    assert damerau_levenshtein("radiohead", "radiohaed") == 1
    assert damerau_levenshtein("paris", "paris") == 0
    assert damerau_levenshtein("kitten", "sitting") == 3


RADIOHEAD = build_text_answer(1, "Radiohead", ["radio head"])


@pytest.mark.parametrize(
    "raw",
    ["Radiohead", "radiohead", "RADIO HEAD", "Radiohaed", "Radioheed", "the radiohead"],
)
def test_text_accepts_case_aliases_and_small_typos(raw: str) -> None:
    assert check_text(raw, [RADIOHEAD]) == RADIOHEAD


def test_text_accepts_accents_either_way() -> None:
    answer = build_text_answer(2, "Beyoncé", [])
    assert check_text("beyonce", [answer]) == answer
    assert check_text("Beyoncè", [answer]) == answer


@pytest.mark.parametrize("raw", ["Coldplay", "Radiohedges", "", "!!"])
def test_text_rejects_wrong_or_empty_answers(raw: str) -> None:
    assert check_text(raw, [RADIOHEAD]) is None


def test_short_answers_are_not_fuzzed() -> None:
    answer = build_text_answer(3, "Oslo", [])
    assert check_text("Osla", [answer]) is None
    assert check_text("oslo", [answer]) == answer


def test_long_answers_allow_two_edits() -> None:
    answer = build_text_answer(4, "Mississippi", [])
    assert check_text("Missisipi", [answer]) == answer
    assert check_text("Misisipi", [answer]) is None


def test_ambiguous_near_match_is_rejected() -> None:
    mars = build_text_answer(5, "Martin", [])
    marvin = build_text_answer(6, "Marvin", [])
    # "Marlin" is one edit from both: reject rather than guess.
    assert check_text("Marlin", [mars, marvin]) is None
    # An exact match still wins.
    assert check_text("Marvin", [mars, marvin]) == marvin


def test_closest_answer_wins_when_not_tied() -> None:
    short = build_text_answer(7, "Jupiter", [])
    other = build_text_answer(8, "Juniper", [])
    assert check_text("Jupiterr", [short, other]) == short


@pytest.mark.parametrize(
    ("raw", "value"),
    [
        ("1000", Decimal(1000)),
        ("1,000", Decimal(1000)),
        ("1 000", Decimal(1000)),
        ("1 000", Decimal(1000)),
        ("  206 ", Decimal(206)),
        ("3.5", Decimal("3.5")),
        ("-12", Decimal(-12)),
        ("12,345,678", Decimal(12345678)),
    ],
)
def test_parse_number_accepts_common_formats(raw: str, value: Decimal) -> None:
    assert parse_number(raw) == value


@pytest.mark.parametrize("raw", ["", "abc", "1,00", "12a", "1.2.3", "one", "1,0000", ",100"])
def test_parse_number_rejects_non_numbers(raw: str) -> None:
    assert parse_number(raw) is None


def test_number_tolerance() -> None:
    assert check_number("206", Decimal(206), Decimal(0)) is True
    assert check_number("207", Decimal(206), Decimal(0)) is False
    assert check_number("207", Decimal(206), Decimal(1)) is True
    assert check_number("204", Decimal(206), Decimal(1)) is False
    assert check_number("lots", Decimal(206), Decimal(0)) is None
