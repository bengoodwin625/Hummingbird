import type { Band } from "../art/sprites";
import { BAND_INFO, MISSED_EMOJI, formatPoints, formatSeconds } from "./format";

export interface ShareInput {
  number: number;
  totalScore: number;
  totalQuestions: number;
  answers: ReadonlyArray<{ band: Band | null; correct: boolean; elapsedMs: number | null }>;
  /** Extra lines before the link, such as the combined total for both games. */
  extra?: string[];
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
  lines.push(...(input.extra ?? []));
  if (input.url) lines.push(input.url);
  return lines.join("\n");
}

export interface NumbersShareInput {
  number: number;
  totalScore: number;
  maxScore: number;
  avgCloseness: number;
  answers: ReadonlyArray<{ band: Band | null }>;
  extra?: string[];
  url?: string;
}

/** The How Close quiz result: score, the animals row and average closeness, no questions. */
export function buildNumbersShareText(input: NumbersShareInput): string {
  const row = input.answers.map((a) => (a.band ? BAND_INFO[a.band].emoji : MISSED_EMOJI)).join("");
  const lines = [
    `Hummingbird How Close #${input.number} — ${formatPoints(input.totalScore)}/${formatPoints(input.maxScore)}`,
    row,
    `${input.avgCloseness}% close on average`,
  ];
  lines.push(...(input.extra ?? []));
  if (input.url) lines.push(input.url);
  return lines.join("\n");
}

/** The line added to either game's share text once both have been played today. */
export function combinedLine(today: { speed: number | null; close: number | null; combined: number | null }): string[] {
  if (today.speed === null || today.close === null || today.combined === null) return [];
  return [`Both games today: ${formatPoints(today.combined)}`];
}
