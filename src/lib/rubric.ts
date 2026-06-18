/**
 * Baked-in CV best-practices rubric.
 *
 * This is the one-time "research what the good tools check" work, distilled and frozen
 * (cross-checked against the criteria used by Jobscan, Teal, Rezi and Enhancv). It is
 * applied identically to every CV so scoring stays consistent and explainable — the app
 * does NOT do live web search per analysis.
 *
 * Region-aware: the audience is Belgium (FR/EN), so EU conventions apply. A photo or a
 * date of birth is normal on a Belgian/EU CV and must NOT be penalised the way a
 * US/UK-centric tool would.
 */
export const CV_BEST_PRACTICES = [
  "Length: 1 page for under ~10 years of experience; 2 pages maximum for senior profiles.",
  "Bullets describe quantified achievements (numbers, %, scale, outcomes), not duty lists.",
  "Bullets use strong action verbs and follow STAR (Situation-Task-Action-Result) or XYZ (Accomplished X, measured by Y, by doing Z).",
  "Essential contact details present: email, phone, and a LinkedIn URL.",
  "ATS-friendly structure: standard section headings, no critical info trapped in tables, columns, headers/footers or images.",
  "Standard, readable fonts; consistent formatting, spacing and verb tense throughout.",
  "No clichés or empty filler ('team player', 'hard-working', 'detail-oriented') without evidence.",
  "Content is tailored to THIS job: the key skills and keywords from the posting appear naturally.",
  "No spelling or grammar mistakes.",
  "A short, specific professional summary tailored to the target role (not a generic objective).",
] as const;

/**
 * EU-specific guidance the model must respect so it gives correct advice to Belgian CVs.
 */
export const EU_REGION_NOTES = [
  "A photo is acceptable and common on EU/Belgian CVs — do NOT flag it as a problem.",
  "Date of birth, nationality and marital status are sometimes included per local norms — do NOT penalise their presence; only note if they crowd out substance.",
  "Belgium is bilingual (FR/NL) plus English — language skills are a genuine asset worth highlighting.",
] as const;

/**
 * Brazil-specific guidance for Portuguese CVs, so the model doesn't impose US/EU norms.
 */
export const BRAZIL_REGION_NOTES = [
  "A photo is common on Brazilian CVs and is NOT a problem — do not flag it.",
  "Some personal details (idade/estado civil) may appear per local custom — do NOT penalise them; only note if they crowd out substance. Never expect CPF/RG on a CV.",
  "A short 'Resumo'/'Objetivo' section at the top is standard and expected — treat it as the professional summary.",
  "Portuguese plus English (and other languages) is a strong asset worth highlighting.",
] as const;

/** Region notes appropriate to the CV's language. */
export function getRegionNotes(lang: "en" | "fr" | "pt"): readonly string[] {
  return lang === "pt" ? BRAZIL_REGION_NOTES : EU_REGION_NOTES;
}
