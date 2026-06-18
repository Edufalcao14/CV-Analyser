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

  it("detects Portuguese and distinguishes it from French", () => {
    const pt =
      "Desenvolvedor Mobile com mais de 3 anos de experiência em React Native e TypeScript, " +
      "atuando em aplicações em produção para iOS e Android com foco em arquitetura escalável.";
    expect(detectLanguage(pt)).toBe("pt");
  });

  it("defaults to English on empty or ambiguous input", () => {
    expect(detectLanguage("")).toBe("en");
    expect(detectLanguage("React Node Docker 2024")).toBe("en");
  });
});
