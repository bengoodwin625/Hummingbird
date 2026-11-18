import { describe, expect, it } from "vitest";
import { buildNumbersShareText, buildShareText } from "./share";

describe("buildShareText", () => {
  it("builds the animal row, score and average without answers", () => {
    const text = buildShareText({
      number: 42,
      totalScore: 6400,
      totalQuestions: 8,
      answers: [
        { band: "hummingbird", correct: true, elapsedMs: 1500 },
        { band: "jaguar", correct: true, elapsedMs: 3000 },
        { band: "toucan", correct: true, elapsedMs: 5000 },
        { band: null, correct: false, elapsedMs: 4000 },
        { band: "tree_frog", correct: true, elapsedMs: 9000 },
        { band: "jaguar", correct: true, elapsedMs: 2500 },
        { band: "hummingbird", correct: true, elapsedMs: 1000 },
        { band: "sloth", correct: true, elapsedMs: 12000 },
      ],
    });
    expect(text).toBe(
      "Hummingbird #42 — 6,400 pts\n🐦🐆🦜❌🐸🐆🐦🦥\navg 4.8 s · fastest 1.0 s · 7/8 correct",
    );
  });

  it("adds the link to the game on its own line", () => {
    const text = buildShareText({
      number: 3,
      totalScore: 1000,
      totalQuestions: 1,
      answers: [{ band: "hummingbird", correct: true, elapsedMs: 400 }],
      url: "https://example.test",
    });
    expect(text.split("\n").at(-1)).toBe("https://example.test");
    expect(text).toContain("fastest 0.4 s");
  });

  it("handles a day with no correct answers", () => {
    const text = buildShareText({
      number: 1,
      totalScore: 0,
      totalQuestions: 2,
      answers: [
        { band: null, correct: false, elapsedMs: 3000 },
        { band: null, correct: false, elapsedMs: null },
      ],
    });
    expect(text).toBe("Hummingbird #1 — 0 pts\n❌❌\navg – · 0/2 correct");
  });
});

describe("buildNumbersShareText", () => {
  it("shows the score out of 1,000, the animals and average closeness", () => {
    const text = buildNumbersShareText({
      number: 2,
      totalScore: 567,
      maxScore: 1000,
      avgCloseness: 74,
      answers: [{ band: "hummingbird" }, { band: "jaguar" }, { band: null }, { band: "sloth" }, { band: "toucan" }],
      url: "https://example.test",
    });
    expect(text).toBe(
      "Hummingbird Numbers #2 — 567/1,000\n🐦🐆❌🦥🦜\n74% close on average\nhttps://example.test",
    );
  });
});
