import { z } from "zod";

/**
 * The structured contract between the LLM passes and the UI.
 *
 * Pipeline (version B — light, 2 LLM calls):
 *   1. Mechanical ATS checks run in code (see `ats.ts`) — no LLM.
 *   2. Judgment pass (LLM)  → `AnalysisSchema`  (the detailed findings)
 *   3. Synthesis pass (LLM) → `SynthesisSchema` (headline verdict + top fixes,
 *      produced by stepping back over the full analysis)
 *
 * The UI renders the structured fields directly — it never parses prose.
 */

export const Language = z.enum(["en", "fr"]);
export type Language = z.infer<typeof Language>;

export const SeniorityLevel = z.enum(["junior", "mid", "senior", "unknown"]);
export type SeniorityLevel = z.infer<typeof SeniorityLevel>;

/** A single finding must cite the line/bullet it is based on — kills vague, sycophantic praise. */
const Finding = z.object({
  point: z.string(),
  /** The exact CV text this is based on. Empty only when genuinely not applicable. */
  evidence: z.string(),
});
export type Finding = z.infer<typeof Finding>;

const Critique = z.object({
  summary: z.string(),
  strengths: z.array(Finding),
  /** The recruiter persona must surface real problems even on a strong CV. */
  weaknesses: z.array(Finding),
});
export type Critique = z.infer<typeof Critique>;

export const BulletMethod = z.enum(["STAR", "XYZ", "WEAK", "OTHER"]);
export type BulletMethod = z.infer<typeof BulletMethod>;

const ExperienceItem = z.object({
  /** The role or bullet being assessed. */
  source: z.string(),
  method: BulletMethod,
  issue: z.string(),
  /** A concrete rewrite. Empty string when the bullet is already strong. */
  rewrite: z.string(),
});
export type ExperienceItem = z.infer<typeof ExperienceItem>;

export const RuleStatus = z.enum(["pass", "fail", "warn"]);
export type RuleStatus = z.infer<typeof RuleStatus>;

const BestPracticeResult = z.object({
  rule: z.string(),
  status: RuleStatus,
  note: z.string(),
});
export type BestPracticeResult = z.infer<typeof BestPracticeResult>;

const SeniorityAssessment = z.object({
  demonstrated: SeniorityLevel,
  required: SeniorityLevel,
  target: SeniorityLevel,
  /** e.g. "Your CV reads as mid-level, but this job targets senior." */
  gapNote: z.string(),
});
export type SeniorityAssessment = z.infer<typeof SeniorityAssessment>;

/** Output of LLM call 1 — the detailed judgment. */
export const AnalysisSchema = z.object({
  language: Language,
  matchScore: z.number().min(0).max(100),
  seniority: SeniorityAssessment,
  keywordGap: z.object({
    present: z.array(z.string()),
    missing: z.array(z.string()),
  }),
  recruiterCritique: Critique,
  techRecruiterCritique: Critique,
  experienceAnalysis: z.array(ExperienceItem),
  bestPractices: z.array(BestPracticeResult),
});
export type Analysis = z.infer<typeof AnalysisSchema>;

const PrioritizedAction = z.object({
  /** 1 = most impactful. */
  priority: z.number().int().min(1),
  action: z.string(),
  why: z.string(),
});
export type PrioritizedAction = z.infer<typeof PrioritizedAction>;

/** Output of LLM call 2 — the executive synthesis. */
export const SynthesisSchema = z.object({
  /** One blunt sentence, e.g. "Strong fit, but impact is buried and 3 key skills are missing." */
  verdict: z.string(),
  prioritizedActions: z.array(PrioritizedAction),
});
export type Synthesis = z.infer<typeof SynthesisSchema>;

/** Mechanical, code-computed ATS facts (see `ats.ts`). */
export const AtsResult = z.object({
  score: z.number().min(0).max(100),
  parseable: z.boolean(),
  keywordCoverage: z.number().min(0).max(1),
  matchedKeywords: z.array(z.string()),
  missingKeywords: z.array(z.string()),
  sectionsFound: z.array(z.string()),
  sectionsMissing: z.array(z.string()),
  hasContactEmail: z.boolean(),
  hasContactPhone: z.boolean(),
  hasSummary: z.boolean(),
  notes: z.array(z.string()),
});
export type AtsResult = z.infer<typeof AtsResult>;

/** The complete report handed to the UI. */
export type Report = {
  ats: AtsResult;
  analysis: Analysis;
  synthesis: Synthesis;
  /** The job offer text, kept so the "Copy for Claude" prompt can tailor concretely. */
  jobOffer: string;
};

export type ScoreBand = "Excellent" | "Good" | "Fair" | "Weak" | "Poor";

/**
 * Maps a 0–100 score to an honest band. Scores are shown as band + number + reasoning,
 * never as a bare, falsely-precise figure.
 */
export function scoreBand(score: number): ScoreBand {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 55) return "Fair";
  if (score >= 40) return "Weak";
  return "Poor";
}
