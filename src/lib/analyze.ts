import { computeAtsResult, reconcileAtsKeywords } from "./ats";
import { detectLanguage } from "./language";
import {
  buildAnalysisSystemPrompt,
  buildAnalysisUserPrompt,
  buildSynthesisSystemPrompt,
  buildSynthesisUserPrompt,
} from "./prompts";
import { callJson, type ContentPart } from "./openrouter";
import { detectKind, extractText, toDataUrl, type UploadedFile } from "./parse";
import { AnalysisSchema, SynthesisSchema, type Report, type SeniorityLevel } from "./schema";

export type AnalyzeInput = {
  cv: UploadedFile;
  jobOffer: string;
  targetLevel: SeniorityLevel;
};

function visionEnabled(): boolean {
  // Master switch for the vision fallback. Defaults ON; set ENABLE_VISION=false to
  // never attach the PDF (pure text). Even when ON, vision is only used as a fallback
  // for poor text extraction (see below) — not on every PDF — to control cost.
  return (process.env.ENABLE_VISION ?? "true").toLowerCase() !== "false";
}

// Below this many characters of extracted text, we treat the text read as unreliable
// and fall back to a vision read of the PDF.
const WEAK_TEXT_THRESHOLD = 400;

/**
 * Runs the full pipeline:
 *   text extraction → language detect → mechanical ATS (code) →
 *   judgment pass (LLM, vision + text) → synthesis pass (LLM) → Report.
 */
export async function runAnalysis(input: AnalyzeInput): Promise<Report> {
  const { cv, jobOffer, targetLevel } = input;

  // 1. Text extraction (backbone + powers the ATS check).
  const cvText = await extractText(cv);

  // 2. Language (first guess; the LLM re-confirms).
  const lang = detectLanguage(cvText || jobOffer);

  // 3. Mechanical ATS check — pure code.
  const ats = computeAtsResult(cvText, jobOffer, lang);

  // 4. Judgment pass. Text is the default backbone. Attach the original PDF for a
  //    (more expensive) vision read ONLY as a fallback when text extraction is weak —
  //    e.g. a scanned or multi-column "designer" PDF that extracts as garbage.
  const textIsWeak = !ats.parseable || cvText.trim().length < WEAK_TEXT_THRESHOLD;
  const willAttach = visionEnabled() && detectKind(cv) === "pdf" && textIsWeak;

  // Guard: if we got no usable text AND won't attach the document, the model would
  // have no CV to analyse and would fabricate a report. Fail loudly instead.
  if (!cvText.trim() && !willAttach) {
    throw new Error(
      "Could not read any text from the CV. Please try a different file — a text-based PDF works best.",
    );
  }

  const system = buildAnalysisSystemPrompt(targetLevel, lang);
  const userText = buildAnalysisUserPrompt({ cvText, jobOffer, ats, attached: willAttach });

  const parts: ContentPart[] = [{ type: "text", text: userText }];
  if (willAttach) {
    parts.unshift({ type: "file", file: { filename: cv.name, file_data: toDataUrl(cv) } });
  }

  let analysis;
  try {
    analysis = await callJson({
      schema: AnalysisSchema,
      system,
      userContent: parts,
      maxTokens: 5000,
    });
  } catch (err) {
    // Vision/file attachment may have been rejected — retry with text only, but only
    // if we actually have extracted text (otherwise there is no CV to analyse).
    if (parts.length > 1 && cvText.trim()) {
      analysis = await callJson({
        schema: AnalysisSchema,
        system,
        userContent: buildAnalysisUserPrompt({ cvText, jobOffer, ats, attached: false }),
        maxTokens: 5000,
      });
    } else {
      throw err;
    }
  }

  // The user's explicit target is authoritative over the model's echo.
  if (targetLevel !== "unknown") analysis.seniority.target = targetLevel;

  // Reconcile the ATS keyword coverage with the LLM's required-skills list so the ATS
  // card and the Skills-gap section show the same numbers (no more 32% vs 85%).
  const reconciledAts = reconcileAtsKeywords(
    ats,
    analysis.keywordGap.present,
    analysis.keywordGap.missing,
  );

  // 5. Synthesis pass — step back over the full analysis for the headline + top fixes.
  const synthesis = await callJson({
    schema: SynthesisSchema,
    system: buildSynthesisSystemPrompt(),
    userContent: buildSynthesisUserPrompt({
      analysisJson: JSON.stringify(analysis),
      ats: reconciledAts,
    }),
    maxTokens: 1500,
  });

  return { ats: reconciledAts, analysis, synthesis, jobOffer };
}
