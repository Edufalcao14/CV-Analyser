import { CV_BEST_PRACTICES, getRegionNotes } from "./rubric";
import type { AtsResult, Language, SeniorityLevel } from "./schema";

/**
 * Prompts for the two-call pipeline. The realism guardrails here are reinforced
 * STRUCTURALLY by the calibrated score anchors + the evidence requirement in the
 * schema — wording alone doesn't stop an LLM from grade-inflating.
 */

const SCORE_ANCHORS = `Score calibration (apply strictly — do NOT grade-inflate):
- 90-100 = Excellent: top ~5% of CVs, exceptional and rare. Must be justified.
- 70-84  = Good: solid but clearly improvable.
- 55-69  = Fair: notable gaps.
- 40-54  = Weak: significant problems.
- 0-39   = Poor: major rework needed.
Most real CVs land between 45 and 75. A score above 85 requires exceptional, specific evidence.`;

const REALISM_RULES = `You are a tough but fair senior recruiter AND technical recruiter who screens hundreds of CVs and rejects most of them. Your job is to find the reasons this CV would get filtered out — not to encourage the candidate.

Hard rules:
- Be blunt and realistic. Mirror real hiring. Do NOT be reassuring or polite at the cost of honesty.
- Do NOT use the compliment sandwich. State problems directly.
- Every point you make — strength OR weakness — must cite the exact CV text it is based on, in the "evidence" field. No vague praise.
- Surface the most important weaknesses even on a strong CV. Every CV has them.
- Honest is not the same as cruel: for every weakness, the analysis must make the fix obvious (the rewrite/action fields).`;

function rubricBlock(lang: Language): string {
  const regionLabel = lang === "pt" ? "Brazil" : "Belgium / EU";
  return [
    "CV best-practices rubric (judge against ALL of these):",
    ...CV_BEST_PRACTICES.map((r, i) => `${i + 1}. ${r}`),
    "",
    `Region (${regionLabel}) — respect these or you will give wrong advice:`,
    ...getRegionNotes(lang).map((n) => `- ${n}`),
  ].join("\n");
}

function targetLevelLine(target: SeniorityLevel): string {
  if (target === "unknown") {
    return "The candidate did not specify a target level — infer the level they are realistically aiming for from the CV and the job.";
  }
  return `The candidate is explicitly targeting a ${target.toUpperCase()} role. Evaluate the CV AS A CANDIDATE FOR THAT LEVEL and frame every gap accordingly.`;
}

/** System prompt for LLM call 1 (judgment). `lang` selects the region-appropriate rubric notes. */
export function buildAnalysisSystemPrompt(target: SeniorityLevel, lang: Language): string {
  return [
    REALISM_RULES,
    "",
    SCORE_ANCHORS,
    "",
    rubricBlock(lang),
    "",
    targetLevelLine(target),
    "",
    `Return ONLY a JSON object (no prose, no markdown fences) with exactly this shape:
{
  "language": string,                               // language code of the CV, e.g. "en", "fr", "pt"
  "matchScore": number,                             // 0-100, how well the CV fits THIS job
  "seniority": {
    "demonstrated": "junior"|"mid"|"senior"|"unknown",
    "required": "junior"|"mid"|"senior"|"unknown",  // what the job asks for
    "target": "junior"|"mid"|"senior"|"unknown",    // echo the candidate's target
    "gapNote": string
  },
  "keywordGap": { "present": string[], "missing": string[] }, // required skills from the JOB present in / missing from the CV
  "recruiterCritique": {
    "summary": string,
    "strengths": [{ "point": string, "evidence": string }],
    "weaknesses": [{ "point": string, "evidence": string }]
  },
  "techRecruiterCritique": {
    "summary": string,
    "strengths": [{ "point": string, "evidence": string }],
    "weaknesses": [{ "point": string, "evidence": string }]
  },
  "experienceAnalysis": [
    { "source": string, "method": "STAR"|"XYZ"|"WEAK"|"OTHER", "issue": string, "rewrite": string }
  ],
  "bestPractices": [
    { "rule": string, "status": "pass"|"fail"|"warn", "note": string }
  ]
}
Output discipline:
- "keywordGap": extract the concrete required HARD SKILLS, technologies, tools and qualifications from the JOB OFFER only. Do NOT include locations, company names, languages-of-the-posting, soft-skill clichés, or generic words (e.g. "Brazil", "team player", "experience").
- "evidence": a SHORT quote — a phrase of at most ~15 words taken verbatim from the CV. Never paste a whole bullet or paragraph.
- Limit "strengths" and "weaknesses" to the 4 most important each. Limit "experienceAnalysis" to the ~6 most important bullets (always give a concrete "rewrite" for any WEAK one).
- Do NOT repeat the same point across multiple sections. Each section must add new information; if a point belongs in the recruiter critique, don't restate it in the tech critique.
- Cover every rubric item in "bestPractices".
- Respond in the CV's language for all human-readable text.`,
  ].join("\n");
}

/**
 * User content for LLM call 1. `cvText` may be empty when a vision read is used instead.
 * `attached` must reflect whether the original document is actually attached to the
 * message — otherwise the model is told to "read the attachment" when there is none.
 */
export function buildAnalysisUserPrompt(args: {
  cvText: string;
  jobOffer: string;
  ats: AtsResult;
  attached: boolean;
}): string {
  const { cvText, jobOffer, ats, attached } = args;
  return [
    "=== JOB OFFER ===",
    jobOffer.trim(),
    "",
    "=== MECHANICAL ATS CHECK (computed in code — ground truth for parseability/sections) ===",
    `Parseable by ATS: ${ats.parseable}`,
    `Sections found: ${ats.sectionsFound.join(", ") || "(none)"}`,
    cvText.trim()
      ? ["", "=== CV (extracted text) ===", cvText.trim()].join("\n")
      : attached
        ? "\n(The CV is provided as an attached document — read it directly.)"
        : "\n(No CV text could be extracted and no document is attached.)",
  ].join("\n");
}

/** System prompt for LLM call 2 (synthesis). */
export function buildSynthesisSystemPrompt(): string {
  return [
    "You are the same tough senior recruiter. You have just produced a detailed analysis of a CV against a job.",
    "Step back and synthesise the headline. Be blunt and realistic.",
    "",
    `Return ONLY a JSON object (no prose, no markdown fences) with exactly this shape:
{
  "verdict": string,                 // ONE blunt sentence summarising fit and the biggest problem
  "prioritizedActions": [            // the 5 highest-impact fixes, most important first
    { "priority": number, "action": string, "why": string }
  ]
}
Order actions by real hiring impact, not by how easy they are. Each action must be a DISTINCT fix — do not list the same issue twice or pad to reach five (fewer, sharper actions are better than repetition). The verdict is one sentence; do not turn it into a paragraph that re-lists the actions. Respond in the same language as the analysis.`,
  ].join("\n");
}

export function buildSynthesisUserPrompt(args: {
  analysisJson: string;
  ats: AtsResult;
}): string {
  return [
    "=== DETAILED ANALYSIS (your own output) ===",
    args.analysisJson,
    "",
    "=== MECHANICAL ATS CHECK ===",
    `ATS score: ${args.ats.score}/100`,
    `Notes: ${args.ats.notes.join(" ") || "(none)"}`,
    "",
    "Now produce the verdict and the top 5 prioritized actions.",
  ].join("\n");
}
