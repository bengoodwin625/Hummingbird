import type { Band } from "../art/sprites";
import { BAND_INFO, MISSED_EMOJI, formatPoints, formatSeconds } from "./format";

export interface ShareInput {
  number: number;
  totalScore: number;
  totalQuestions: number;
  answers: ReadonlyArray<{ band: Band | null; correct: boolean; elapsedMs: number | null }>;
  /** Where to play, added as the last line when given. */
  url?: string;
}

/** Wordle-style result with no questions or answers in it. */
export function buildShareText(input: ShareInput): string {
  const row = input.answers
    .map((a) => (a.correct && a.band ? BAND_INFO[a.band].emoji : MISSED_EMOJI))
    .join("");
  const correct = input.answers.filter((a) => a.correct);
  const times = correct.map((a) => a.elapsedMs).filter((t): t is number => t !== null);
  const avg = times.length ? formatSeconds(times.reduce((s, t) => s + t, 0) / times.length) : "–";
  const stats = [`avg ${avg}`];
  if (times.length) stats.push(`fastest ${formatSeconds(Math.min(...times))}`);
  stats.push(`${correct.length}/${input.totalQuestions} correct`);
  const lines = [`Hummingbird #${input.number} — ${formatPoints(input.totalScore)} pts`, row, stats.join(" · ")];
  if (input.url) lines.push(input.url);
  return lines.join("\n");
}
