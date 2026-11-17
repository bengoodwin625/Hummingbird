import type { Band } from "../art/sprites";
import { BAND_INFO, MISSED_EMOJI, formatPoints, formatSeconds } from "./format";

export interface ShareInput {
  number: number;
  totalScore: number;
  totalQuestions: number;
  answers: ReadonlyArray<{ band: Band | null; correct: boolean; elapsedMs: number | null }>;
}

/** Wordle-style result with no questions or answers in it. */
export function buildShareText(input: ShareInput): string {
  const row = input.answers
    .map((a) => (a.correct && a.band ? BAND_INFO[a.band].emoji : MISSED_EMOJI))
    .join("");
  const correct = input.answers.filter((a) => a.correct);
  const times = correct.map((a) => a.elapsedMs).filter((t): t is number => t !== null);
  const avg = times.length ? formatSeconds(times.reduce((s, t) => s + t, 0) / times.length) : "–";
  return [
    `Hummingbird #${input.number} — ${formatPoints(input.totalScore)} pts`,
    row,
    `avg ${avg} · ${correct.length}/${input.totalQuestions} correct`,
  ].join("\n");
}
