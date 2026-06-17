import { describe, it, expect } from "vitest";
import { detectLanguage } from "./language";

describe("detectLanguage", () => {
  it("detects English", () => {
    const en =
      "Experienced software engineer with a strong background in building web applications and leading teams.";
    expect(detectLanguage(en)).toBe("en");
  });

  it("detects French", () => {
    const fr =
      "Ingénieur logiciel expérimenté avec une solide expérience dans le développement d'applications web et la gestion d'équipes.";
    expect(detectLanguage(fr)).toBe("fr");
  });

  it("defaults to English on empty or ambiguous input", () => {
    expect(detectLanguage("")).toBe("en");
    expect(detectLanguage("React Node Docker 2024")).toBe("en");
  });
});
