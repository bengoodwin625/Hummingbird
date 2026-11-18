import { describe, expect, it } from "vitest";
import { formatGuess } from "./numbers";

describe("formatGuess", () => {
  it("formats plain numbers like the answers", () => {
    expect(formatGuess("4000")).toBe("4,000");
    expect(formatGuess("1 500")).toBe("1,500");
    expect(formatGuess("8,000")).toBe("8,000");
    expect(formatGuess("9.58")).toBe("9.58");
  });

  it("leaves anything else as typed", () => {
    expect(formatGuess("about 40")).toBe("about 40");
    expect(formatGuess(null)).toBe("None");
  });
});
