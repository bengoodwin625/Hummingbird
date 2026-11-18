import type { Band } from "../art/sprites";

export interface BandInfo {
  name: string;
  points: number;
  emoji: string;
  range: string;
}

export const BAND_INFO: Record<Band, BandInfo> = {
  hummingbird: { name: "Hummingbird", points: 1000, emoji: "🐦", range: "0.5 s or less · rare" },
  jaguar: { name: "Jaguar", points: 700, emoji: "🐆", range: "0.5–1.2 s" },
  toucan: { name: "Toucan", points: 450, emoji: "🦜", range: "1.2–2.5 s" },
  tree_frog: { name: "Tree frog", points: 250, emoji: "🐸", range: "2.5–4.5 s" },
  sloth: { name: "Sloth", points: 100, emoji: "🦥", range: "over 4.5 s" },
};

/** Typed answers get this much time off before banding (mirrors backend/app/scoring.py). */
export const TYPING_ALLOWANCE_S = { number: 1.5, text: 2.5 } as const;

export const MISSED_EMOJI = "❌";

const numberFormat = new Intl.NumberFormat("en-GB");

export function formatPoints(points: number): string {
  return numberFormat.format(points);
}

/** "3.4 s" — one decimal place, rounded down so 1.99 s never shows as 2.0 s. */
export function formatSeconds(ms: number): string {
  const tenths = Math.floor(Math.max(0, ms) / 100);
  return `${(tenths / 10).toFixed(1)} s`;
}

/** "14 h 32 m" or "8 m" until a time. */
export function formatCountdown(untilMs: number, nowMs: number): string {
  const minutes = Math.max(0, Math.ceil((untilMs - nowMs) / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} h ${m} m` : `${m} m`;
}

const ordinalRules = new Intl.PluralRules("en-GB", { type: "ordinal" });
const ORDINAL_SUFFIX: Record<string, string> = { one: "st", two: "nd", few: "rd", other: "th" };

/** "1st", "2nd", "3rd", "11th", "22nd". */
export function formatOrdinal(n: number): string {
  return `${n}${ORDINAL_SUFFIX[ordinalRules.select(n)] ?? "th"}`;
}

const quizDateFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/** "Tuesday 17 November" for a quiz date like "2026-11-17". */
export function formatQuizDate(isoDate: string): string {
  const parsed = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return quizDateFormat.format(parsed).replace(",", "");
}

/**
 * A smooth curve through the day's score buckets (a Gaussian kernel over bucket centres),
 * sampled at `samples` evenly spaced scores from 0 to counts.length × bucketSize. Heights are
 * scaled so the tallest point is 1; an empty day gives a flat line of zeros.
 */
export function smoothDistribution(counts: readonly number[], samples = 81, bandwidthBuckets = 1): number[] {
  const n = counts.length;
  const out: number[] = [];
  for (let i = 0; i < samples; i++) {
    const at = samples === 1 ? 0 : (i / (samples - 1)) * n; // position in bucket units
    let y = 0;
    counts.forEach((count, b) => {
      const d = (at - (b + 0.5)) / bandwidthBuckets;
      y += count * Math.exp(-0.5 * d * d);
    });
    out.push(y);
  }
  const peak = Math.max(...out, 0);
  return peak > 0 ? out.map((y) => y / peak) : out.map(() => 0);
}

/** Where a score sits along the distribution chart, as a percentage of its width. */
export function scorePercent(score: number, maxScore: number): number {
  return Math.min(100, Math.max(0, (score / maxScore) * 100));
}

/** A content category as shown above a question: "geography" → "Geography". */
export function categoryLabel(category: string): string {
  const c = category.trim();
  return c ? c.charAt(0).toUpperCase() + c.slice(1) : "";
}

/** The animal whose band a time falls in (the same limits the server scores with). */
export function bandForTime(ms: number): Band {
  if (ms <= 500) return "hummingbird";
  if (ms <= 1200) return "jaguar";
  if (ms <= 2500) return "toucan";
  if (ms <= 4500) return "tree_frog";
  return "sloth";
}

/** One plain line comparing your average answer with today's (null when nobody else has played). */
export function speedGapLine(mine: number, everyone: number | null): string {
  if (everyone === null) return "You're setting today's pace. Check back later to see how it compares.";
  const gap = everyone - mine;
  if (Math.abs(gap) < 100) return "Right on today's average speed.";
  return gap > 0
    ? `${formatSeconds(gap)} quicker than today's average.`
    : `${formatSeconds(-gap)} slower than today's average.`;
}

/** The Numbers quiz's speed animals: longer timings, and each one multiplies closeness. */
export const NUMBERS_BAND_INFO: Record<Band, { range: string; multiplier: number }> = {
  hummingbird: { range: "4 s or less", multiplier: 2 },
  jaguar: { range: "4–7 s", multiplier: 1.7 },
  toucan: { range: "7–11 s", multiplier: 1.45 },
  tree_frog: { range: "11–17 s", multiplier: 1.2 },
  sloth: { range: "over 17 s", multiplier: 1 },
};

/** "×1.45", "×2". */
export function formatMultiplier(m: number): string {
  return `×${Number(m.toFixed(2))}`;
}
