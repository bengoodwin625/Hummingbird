import { describe, expect, it } from "vitest";
import {
  BAND_INFO,
  formatCountdown,
  formatOrdinal,
  formatPoints,
  formatQuizDate,
  formatSeconds,
  speedTrackPercent,
} from "./format";

describe("format", () => {
  it("shows seconds to one decimal place, rounding down", () => {
    expect(formatSeconds(3400)).toBe("3.4 s");
    expect(formatSeconds(1999)).toBe("1.9 s");
    expect(formatSeconds(0)).toBe("0.0 s");
    expect(formatSeconds(-50)).toBe("0.0 s");
  });

  it("formats points with British separators", () => {
    expect(formatPoints(6400)).toBe("6,400");
  });

  it("formats a countdown", () => {
    expect(formatCountdown(3_600_000 * 14 + 60_000 * 32, 0)).toBe("14 h 32 m");
    expect(formatCountdown(8 * 60_000, 0)).toBe("8 m");
    expect(formatCountdown(0, 1000)).toBe("0 m");
  });

  it("matches the server's points per animal", () => {
    expect(Object.values(BAND_INFO).map((b) => b.points)).toEqual([1000, 700, 450, 250, 100]);
  });

  it("writes ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(formatOrdinal)).toEqual([
      "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "101st",
    ]);
  });

  it("places times on the speed track", () => {
    expect(speedTrackPercent(0)).toBe(0);
    expect(speedTrackPercent(1250)).toBe(25);
    expect(speedTrackPercent(9000)).toBe(100);
    expect(speedTrackPercent(-5)).toBe(0);
  });

  it("formats the quiz date in British style", () => {
    expect(formatQuizDate("2026-11-17")).toBe("Tuesday 17 November");
    expect(formatQuizDate("not-a-date")).toBe("not-a-date");
  });
});

import { bandForTime, categoryLabel, scorePercent, smoothDistribution } from "./format";

describe("smoothDistribution", () => {
  it("peaks at the busiest bucket and is scaled to 1", () => {
    const counts = [0, 1, 4, 1, 0];
    const curve = smoothDistribution(counts, 51);
    expect(Math.max(...curve)).toBeCloseTo(1);
    const peakAt = curve.indexOf(Math.max(...curve));
    expect(peakAt / 50).toBeCloseTo(0.5, 1); // the middle bucket's centre
  });

  it("is symmetric for symmetric data", () => {
    const curve = smoothDistribution([1, 3, 1], 21);
    curve.forEach((y, i) => expect(y).toBeCloseTo(curve[curve.length - 1 - i] ?? -1));
  });

  it("is flat zero when nobody has finished", () => {
    expect(smoothDistribution([0, 0, 0], 5)).toEqual([0, 0, 0, 0, 0]);
  });
});

describe("scorePercent", () => {
  it("clamps to the chart", () => {
    expect(scorePercent(4000, 8000)).toBe(50);
    expect(scorePercent(-1, 8000)).toBe(0);
    expect(scorePercent(9000, 8000)).toBe(100);
  });
});

describe("categoryLabel", () => {
  it("capitalises the first letter and handles blanks", () => {
    expect(categoryLabel("geography")).toBe("Geography");
    expect(categoryLabel("  ")).toBe("");
  });
});

describe("bandForTime", () => {
  it("uses the scoring limits, with each limit belonging to the faster band", () => {
    expect(bandForTime(500)).toBe("hummingbird");
    expect(bandForTime(501)).toBe("jaguar");
    expect(bandForTime(1200)).toBe("jaguar");
    expect(bandForTime(2500)).toBe("toucan");
    expect(bandForTime(4500)).toBe("tree_frog");
    expect(bandForTime(4501)).toBe("sloth");
  });
});
