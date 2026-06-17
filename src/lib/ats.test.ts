import { describe, it, expect } from "vitest";
import {
  extractKeywords,
  computeKeywordCoverage,
  detectSections,
  hasEmail,
  hasPhone,
  isParseable,
  computeAtsResult,
  reconcileAtsKeywords,
} from "./ats";

describe("extractKeywords", () => {
  it("picks up meaningful skill terms and drops stopwords", () => {
    const job =
      "We are looking for a React developer with strong TypeScript skills. " +
      "You will work with Node and PostgreSQL.";
    const kws = extractKeywords(job);
    expect(kws).toContain("react");
    expect(kws).toContain("typescript");
    expect(kws).toContain("postgresql");
    expect(kws).not.toContain("the");
    expect(kws).not.toContain("with");
    expect(kws).not.toContain("are");
  });

  it("drops French stopwords too", () => {
    const job = "Nous recherchons un développeur React avec des compétences en TypeScript.";
    const kws = extractKeywords(job);
    expect(kws).toContain("react");
    expect(kws).toContain("typescript");
    expect(kws).not.toContain("nous");
    expect(kws).not.toContain("avec");
    expect(kws).not.toContain("des");
  });

  it("returns deduplicated, lowercased terms", () => {
    const kws = extractKeywords("React react REACT Docker docker");
    expect(kws.filter((k) => k === "react")).toHaveLength(1);
    expect(kws.filter((k) => k === "docker")).toHaveLength(1);
  });
});

describe("computeKeywordCoverage", () => {
  it("matches keywords present in the CV, case-insensitively", () => {
    const cv = "Built apps with React and TypeScript and Docker.";
    const { matched, missing, coverage } = computeKeywordCoverage(cv, [
      "react",
      "typescript",
      "kubernetes",
    ]);
    expect(matched).toEqual(expect.arrayContaining(["react", "typescript"]));
    expect(missing).toContain("kubernetes");
    expect(coverage).toBeCloseTo(2 / 3, 5);
  });

  it("matches whole words only (no substring false positives)", () => {
    const { matched } = computeKeywordCoverage("I love javascript", ["java"]);
    expect(matched).not.toContain("java");
  });

  it("matches accented French keywords (unicode word boundaries, not ASCII \\b)", () => {
    const cv = "Je gère une équipe de cinq développeurs avec expérience.";
    const { matched } = computeKeywordCoverage(cv, ["équipe", "développeurs", "kubernetes"]);
    expect(matched).toEqual(expect.arrayContaining(["équipe", "développeurs"]));
    expect(matched).not.toContain("kubernetes");
  });

  it("does not match an accented keyword as a substring of a longer word", () => {
    const { matched } = computeKeywordCoverage("nous avons des équipes", ["équipe"]);
    expect(matched).not.toContain("équipe");
  });

  it("returns zero coverage for an empty keyword list", () => {
    const { coverage } = computeKeywordCoverage("anything", []);
    expect(coverage).toBe(0);
  });
});

describe("detectSections", () => {
  it("finds core English sections", () => {
    const cv = "PROFILE\n...\nEXPERIENCE\n...\nEDUCATION\n...\nSKILLS\n...";
    const { found, missing } = detectSections(cv, "en");
    expect(found).toEqual(expect.arrayContaining(["experience", "education", "skills"]));
    expect(missing).toHaveLength(0);
  });

  it("finds core French sections", () => {
    const cv = "PROFIL\nEXPÉRIENCE PROFESSIONNELLE\nFORMATION\nCOMPÉTENCES";
    const { found } = detectSections(cv, "fr");
    expect(found).toEqual(expect.arrayContaining(["experience", "education", "skills"]));
  });

  it("reports missing sections", () => {
    const { missing } = detectSections("EXPERIENCE\nonly this", "en");
    expect(missing).toEqual(expect.arrayContaining(["education", "skills"]));
  });

  it("detects sections regardless of the language argument (resilient to misdetection)", () => {
    const frCv = "PROFIL\nEXPÉRIENCE PROFESSIONNELLE\nFORMATION\nCOMPÉTENCES";
    // Deliberately pass the wrong language — a French CV mislabelled "en".
    const { found } = detectSections(frCv, "en");
    expect(found).toEqual(expect.arrayContaining(["experience", "education", "skills"]));
  });
});

describe("contact detection", () => {
  it("detects an email", () => {
    expect(hasEmail("Reach me at jane.doe@example.com")).toBe(true);
    expect(hasEmail("no email here")).toBe(false);
  });

  it("detects a phone number in various formats", () => {
    expect(hasPhone("+32 470 12 34 56")).toBe(true);
    expect(hasPhone("0470/12.34.56")).toBe(true);
    expect(hasPhone("no number")).toBe(false);
  });
});

describe("isParseable", () => {
  it("treats reasonable extracted text as parseable", () => {
    expect(isParseable("A".repeat(50) + " real cv content here with words")).toBe(true);
  });

  it("treats near-empty or garbage extraction as not parseable", () => {
    expect(isParseable("")).toBe(false);
    expect(isParseable("   \n  ")).toBe(false);
    expect(isParseable("ab")).toBe(false);
  });
});

describe("computeAtsResult", () => {
  const goodCv =
    "PROFILE\nSenior engineer. Contact: jane@example.com, +32 470 12 34 56\n" +
    "EXPERIENCE\nBuilt React and TypeScript apps, deployed with Docker and PostgreSQL.\n" +
    "EDUCATION\nMSc.\nSKILLS\nReact, TypeScript, Docker, PostgreSQL, Node";
  const job =
    "Looking for a React developer with TypeScript, Docker and PostgreSQL experience.";

  it("produces a high score for a well-matched, parseable CV", () => {
    const r = computeAtsResult(goodCv, job, "en");
    expect(r.parseable).toBe(true);
    expect(r.hasContactEmail).toBe(true);
    expect(r.hasContactPhone).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(r.matchedKeywords).toEqual(expect.arrayContaining(["react", "typescript"]));
  });

  it("caps the score and flags a note when the CV is not parseable", () => {
    const r = computeAtsResult("", job, "en");
    expect(r.parseable).toBe(false);
    expect(r.score).toBeLessThanOrEqual(35);
    expect(r.notes.join(" ")).toMatch(/pars/i);
  });

  it("penalises a CV missing the job's keywords", () => {
    const r = computeAtsResult(
      "PROFILE\njane@example.com +32470123456\nEXPERIENCE\nSold insurance.\nEDUCATION\nBA\nSKILLS\nsales",
      job,
      "en",
    );
    expect(r.keywordCoverage).toBeLessThan(0.5);
    expect(r.missingKeywords).toEqual(expect.arrayContaining(["react"]));
  });

  it("exposes hasSummary for downstream reconciliation", () => {
    const r = computeAtsResult(goodCv, job, "en");
    expect(r.hasSummary).toBe(true);
  });
});

describe("reconcileAtsKeywords", () => {
  const base = computeAtsResult(
    "PROFILE\nSenior engineer. jane@example.com +32 470 12 34 56\nEXPERIENCE\nx\nEDUCATION\ny\nSKILLS\nz",
    "react typescript docker",
    "en",
  );

  it("recomputes coverage and matched/missing from the provided skill lists", () => {
    const r = reconcileAtsKeywords(base, ["react", "typescript", "docker"], ["kubernetes"]);
    expect(r.matchedKeywords).toEqual(["react", "typescript", "docker"]);
    expect(r.missingKeywords).toEqual(["kubernetes"]);
    expect(r.keywordCoverage).toBeCloseTo(3 / 4, 5);
  });

  it("a higher coverage yields a higher (or equal) score than a lower one", () => {
    const high = reconcileAtsKeywords(base, ["react", "typescript", "docker"], []);
    const low = reconcileAtsKeywords(base, ["react"], ["typescript", "docker", "kubernetes"]);
    expect(high.score).toBeGreaterThan(low.score);
  });

  it("handles empty skill lists as zero coverage without crashing", () => {
    const r = reconcileAtsKeywords(base, [], []);
    expect(r.keywordCoverage).toBe(0);
  });

  it("preserves the non-keyword fields (sections, contact)", () => {
    const r = reconcileAtsKeywords(base, ["react"], []);
    expect(r.sectionsFound).toEqual(base.sectionsFound);
    expect(r.hasContactEmail).toBe(base.hasContactEmail);
  });
});
