"""Estimate the spread of daily scores under the current scoring rules.

Usage: python scripts/simulate_scores.py [players]

The player model is an ASSUMPTION for tuning, not measured data: each simulated player has
their own accuracy (most get 4-7 of 8 medium questions right) and their own typical answer
speed (most need 2-4 s after the options appear to tap an answer). Re-run this with real
answer-time data once players exist, and adjust `app/scoring.py` from that.
"""

from __future__ import annotations

import math
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.scoring import (  # noqa: E402
    ANSWER_LIMIT_MS,
    MAX_POINTS_PER_DAY,
    score_answer,
)

QUESTION_TYPES = ["choice"] * 6 + ["number", "text"]
TYPING_EXTRA_MS = {"choice": 0, "number": 1_800, "text": 3_000}


def simulate_player(rng: random.Random) -> int:
    accuracy = min(0.98, max(0.2, rng.betavariate(7, 3)))
    median_ms = math.exp(rng.gauss(math.log(2_800), 0.35))
    total = 0
    for qtype in QUESTION_TYPES:
        correct = rng.random() < accuracy
        answer_ms = median_ms * math.exp(rng.gauss(0, 0.45)) + TYPING_EXTRA_MS[qtype]
        if answer_ms > ANSWER_LIMIT_MS:
            continue
        total += score_answer(correct, int(answer_ms), qtype).points
    return total


def main(argv: list[str]) -> int:
    players = int(argv[1]) if len(argv) > 1 else 20_000
    rng = random.Random(42)
    scores = sorted(simulate_player(rng) for _ in range(players))
    bucket = 500
    counts = [0] * (MAX_POINTS_PER_DAY // bucket + 1)
    for score in scores:
        counts[score // bucket] += 1
    peak = max(counts)
    print(f"{players:,} simulated players (assumed model; see the docstring)\n")
    for i, count in enumerate(counts):
        bar = "#" * round(40 * count / peak) if peak else ""
        print(f"{i * bucket:>5,}-{i * bucket + bucket - 1:>5,} {count / players:6.1%} {bar}")
    perfect = sum(1 for s in scores if s == MAX_POINTS_PER_DAY)
    mean = sum(scores) / players
    median = scores[players // 2]
    print(f"\nmean {mean:,.0f}, median {median:,}, perfect {perfect / players:.3%}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
