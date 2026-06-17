import { describe, it, expect } from "vitest";
import { buildImprovementPrompt, stripPlaceholders } from "./improvementPrompt";
import type { Report } from "./schema";

function makeReport(overrides: Partial<Report> = {}): Report {
  const base: Report = {
    ats: {
      score: 66,
      parseable: true,
      keywordCoverage: 0.5,
      matchedKeywords: ["react"],
      missingKeywords: ["docker"],
      sectionsFound: ["experience", "education", "skills"],
      sectionsMissing: [],
      hasContactEmail: true,
      hasContactPhone: true,
      hasSummary: true,
      notes: [],
    },
    analysis: {
      language: "en",
      matchScore: 72,
      seniority: { demonstrated: "mid", required: "mid", target: "mid", gapNote: "Well matched." },
      keywordGap: { present: ["react", "typescript"], missing: ["docker", "kubernetes"] },
      recruiterCritique: {
        summary: "Solid.",
        strengths: [{ point: "Quantified impact", evidence: "reduced load by 40%" }],
        weaknesses: [{ point: "No clear summary", evidence: "header only" }],
      },
      techRecruiterCritique: {
        summary: "Good depth.",
        strengths: [],
        weaknesses: [{ point: "No testing experience", evidence: "" }],
      },
      experienceAnalysis: [
        {
          source: "Built features",
          method: "WEAK",
          issue: "Vague",
          // Carries a bracketed placeholder on purpose — must be stripped from output.
          rewrite: "Shipped 12 features, improving onboarding by [X]%",
        },
        { source: "Led team", method: "STAR", issue: "", rewrite: "" },
      ],
      bestPractices: [
        { rule: "Quantify achievements", status: "fail", note: "Few numbers." },
        { rule: "Has contact info", status: "pass", note: "Present." },
      ],
    },
    synthesis: {
      verdict: "Good fit but impact is buried.",
      prioritizedActions: [
        { priority: 2, action: "Add a summary", why: "Recruiters scan it first." },
        { priority: 1, action: "Add Docker", why: "Required by the job." },
      ],
    },
  };
  return { ...base, ...overrides };
}

describe("buildImprovementPrompt", () => {
  const md = buildImprovementPrompt(makeReport());

  it("instructs Claude to produce a .docx (not a PDF)", () => {
    expect(md).toMatch(/\.docx/i);
    expect(md).toMatch(/not a pdf|NOT a PDF/i);
  });

  it("includes the verdict and the truthfulness guardrail", () => {
    expect(md).toContain("Good fit but impact is buried.");
    expect(md).toMatch(/never invent/i);
  });

  it("forbids placeholders and enforces a single page with ATS formatting", () => {
    expect(md).toMatch(/zero placeholders/i);
    expect(md).toMatch(/one page/i);
    expect(md).toMatch(/single-column/i);
  });

  it("contains NO square-bracket tokens anywhere (nothing for the model to echo)", () => {
    expect(md).not.toMatch(/\[[^\]]+\]/);
  });

  it("strips bracketed placeholders out of the suggested rewrites", () => {
    expect(md).toContain("Shipped 12 features, improving onboarding");
    expect(md).not.toContain("[X]");
  });

  it("lists prioritized actions in priority order", () => {
    const addDocker = md.indexOf("Add Docker");
    const addSummary = md.indexOf("Add a summary");
    expect(addDocker).toBeGreaterThan(-1);
    expect(addDocker).toBeLessThan(addSummary); // priority 1 before priority 2
  });

  it("lists missing skills but not present ones in the skills section", () => {
    expect(md).toContain("- docker");
    expect(md).toContain("- kubernetes");
  });

  it("includes weak-bullet rewrites but omits strengths", () => {
    expect(md).toContain("Shipped 12 features");
    expect(md).not.toContain("Quantified impact"); // strengths are not part of an improvement prompt
  });

  it("includes failing best practices but not passing ones", () => {
    expect(md).toContain("Quantify achievements");
    expect(md).not.toContain("Has contact info");
  });

  it("includes recruiter and technical concerns", () => {
    expect(md).toContain("No clear summary");
    expect(md).toContain("No testing experience");
  });

  it("omits the skills section entirely when nothing is missing", () => {
    const r = makeReport();
    r.analysis.keywordGap.missing = [];
    expect(buildImprovementPrompt(r)).not.toContain("Skills / keywords to address");
  });
});

describe("stripPlaceholders", () => {
  it("removes bracket tokens and the preposition that precedes them", () => {
    expect(stripPlaceholders("improved load by [X]%")).toBe("improved load");
    expect(stripPlaceholders("from [X]ms to [Y]ms")).toBe("");
    expect(stripPlaceholders("resolved [ADD NUMBER]+ defects")).toBe("resolved + defects");
  });

  it("leaves clean text untouched", () => {
    expect(stripPlaceholders("Reduced startup time by 78%")).toBe("Reduced startup time by 78%");
  });
});
