import type { Language } from "./schema";

/**
 * Lightweight FR/EN detector. The audience is Belgium, so we only distinguish
 * French from English. Defaults to English when there's no clear signal — the
 * LLM also re-confirms the language in the analysis, so this only needs to be
 * a good first guess (e.g. to pick the EU rubric notes and report language hint).
 */

const FR_MARKERS = new Set([
  "le", "la", "les", "un", "une", "des", "du", "et", "avec", "pour", "dans",
  "vous", "nous", "votre", "notre", "qui", "que", "est", "sont", "expérience",
  "expériences", "compétences", "formation", "développement", "gestion",
  "équipe", "équipes", "logiciel", "ingénieur", "années", "entreprise",
  "réalisé", "réalisations", "projet", "projets",
]);

const EN_MARKERS = new Set([
  "the", "a", "an", "and", "with", "for", "in", "of", "to", "you", "we", "your",
  "our", "who", "is", "are", "experience", "skills", "education", "development",
  "management", "team", "teams", "software", "engineer", "years", "company",
  "built", "led", "leading", "background", "strong", "applications",
]);

export function detectLanguage(text: string): Language {
  const tokens = text.toLowerCase().match(/[\p{L}]+/gu) ?? [];
  let fr = 0;
  let en = 0;
  for (const t of tokens) {
    if (FR_MARKERS.has(t)) fr++;
    if (EN_MARKERS.has(t)) en++;
  }
  // Accented characters are a strong French signal.
  const accents = (text.match(/[àâäéèêëïîôöùûüçœ]/giu) ?? []).length;
  fr += accents * 0.5;

  return fr > en ? "fr" : "en";
}
