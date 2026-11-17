"""Answer checking for choice, number and text questions. Pure functions, no I/O."""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Sequence
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

_APOSTROPHES = re.compile(r"['‘’ʼ`]")
_NON_WORD = re.compile(r"[^0-9a-z ]+")
_SPACES = re.compile(r"\s+")
_LEADING_ARTICLE = re.compile(r"^(the|a|an) (?=\S)")


def normalise(text: str) -> str:
    """Lowercase, strip accents, '&' to 'and', drop punctuation, collapse spaces, drop articles."""
    decomposed = unicodedata.normalize("NFKD", text)
    stripped = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    lowered = stripped.lower().replace("&", " and ")
    lowered = _APOSTROPHES.sub("", lowered)
    lowered = _NON_WORD.sub(" ", lowered)
    collapsed = _SPACES.sub(" ", lowered).strip()
    return _LEADING_ARTICLE.sub("", collapsed)


def is_blank(raw: str) -> bool:
    """Empty or punctuation-only input. It doesn't count as the player's one go."""
    return normalise(raw) == ""


def damerau_levenshtein(a: str, b: str) -> int:
    """Optimal string alignment distance (adjacent transpositions count as one edit)."""
    rows, cols = len(a) + 1, len(b) + 1
    dist = [[0] * cols for _ in range(rows)]
    for i in range(rows):
        dist[i][0] = i
    for j in range(cols):
        dist[0][j] = j
    for i in range(1, rows):
        for j in range(1, cols):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            dist[i][j] = min(
                dist[i - 1][j] + 1,
                dist[i][j - 1] + 1,
                dist[i - 1][j - 1] + cost,
            )
            if i > 1 and j > 1 and a[i - 1] == b[j - 2] and a[i - 2] == b[j - 1]:
                dist[i][j] = min(dist[i][j], dist[i - 2][j - 2] + 1)
    return dist[-1][-1]


def allowed_distance(form: str) -> int:
    """Typo budget for a stored answer form, by its length."""
    length = len(form.replace(" ", ""))
    if length <= 4:
        return 0
    if length <= 8:
        return 1
    return 2


@dataclass(frozen=True)
class TextAnswer:
    """One accepted answer: its display canonical plus normalised forms (canonical + aliases)."""

    answer_id: int
    canonical: str
    forms: tuple[str, ...]


def build_text_answer(answer_id: int, canonical: str, aliases: Sequence[str]) -> TextAnswer:
    forms: list[str] = []
    for value in (canonical, *aliases):
        form = normalise(value)
        if form and form not in forms:
            forms.append(form)
    return TextAnswer(answer_id, canonical, tuple(forms))


def check_text(raw: str, answers: Sequence[TextAnswer]) -> TextAnswer | None:
    """Match typed text against accepted answers. Ambiguous near-matches are rejected."""
    given = normalise(raw)
    if not given:
        return None
    for answer in answers:
        if given in answer.forms:
            return answer

    best_distance: int | None = None
    best: list[TextAnswer] = []
    for answer in answers:
        closest: int | None = None
        for form in answer.forms:
            distance = damerau_levenshtein(given, form)
            if distance <= allowed_distance(form) and (closest is None or distance < closest):
                closest = distance
        if closest is None:
            continue
        if best_distance is None or closest < best_distance:
            best_distance, best = closest, [answer]
        elif closest == best_distance:
            best.append(answer)
    if len(best) == 1:
        return best[0]
    return None


_PLAIN_NUMBER = re.compile(r"^[+-]?\d+(\.\d+)?$")
_GROUPED_NUMBER = re.compile(r"^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$")
_SPACE_GROUPED_NUMBER = re.compile(r"^[+-]?\d{1,3}( \d{3})+(\.\d+)?$")


def parse_number(raw: str) -> Decimal | None:
    """Parse '1,000', '1000', '1 000' or '3.5'. Anything else returns None."""
    text = raw.strip().replace(" ", " ").replace(" ", " ")
    text = _SPACES.sub(" ", text)
    if _SPACE_GROUPED_NUMBER.match(text):
        text = text.replace(" ", "")
    elif _GROUPED_NUMBER.match(text):
        text = text.replace(",", "")
    elif not _PLAIN_NUMBER.match(text):
        return None
    try:
        return Decimal(text)
    except InvalidOperation:
        return None


def check_number(raw: str, answer: Decimal, tolerance: Decimal) -> bool | None:
    """True/False for a parsed number, or None when the input isn't a number at all."""
    value = parse_number(raw)
    if value is None:
        return None
    return abs(value - answer) <= tolerance
