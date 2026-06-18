import { describe, it, expect } from "vitest";
import { AnalysisSchema, scoreBand } from "./schema";

describe("AnalysisSchema.language", () => {
  it("accepts languages beyond en/fr (e.g. Portuguese for Brazilian roles)", () => {
    // Regression: a Portuguese job offer made the model return "pt", which used to
    // fail the en/fr enum and crash the whole analysis.
    expect(AnalysisSchema.shape.language.parse("pt")).toBe("pt");
    expect(AnalysisSchema.shape.language.parse("es")).toBe("es");
    expect(AnalysisSchema.shape.language.parse("en")).toBe("en");
  });
});

describe("scoreBand", () => {
  it("maps scores to calibrated bands", () => {
    expect(scoreBand(95)).toBe("Excellent");
    expect(scoreBand(72)).toBe("Good");
    expect(scoreBand(60)).toBe("Fair");
    expect(scoreBand(45)).toBe("Weak");
    expect(scoreBand(20)).toBe("Poor");
  });
});
