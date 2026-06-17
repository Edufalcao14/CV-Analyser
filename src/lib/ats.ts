import type { AtsResult, Language } from "./schema";

/**
 * Mechanical, code-based ATS checks — deliberately "dumb", because this is what real
 * applicant-tracking software does. A CV that extracts/parses badly genuinely IS
 * ATS-unfriendly, so a low score here is a real finding, not a bug.
 *
 * The LLM produces the refined, human-grade skills gap separately (see `analyze.ts`);
 * these functions provide the deterministic mechanical signal.
 */

// Function words (EN + FR) and generic job-description filler — never useful as keywords.
const STOPWORDS = new Set<string>([
  // English function words
  "the", "a", "an", "and", "or", "but", "with", "for", "to", "of", "in", "on", "at",
  "as", "by", "is", "are", "be", "been", "being", "was", "were", "will", "would",
  "you", "your", "we", "our", "us", "they", "their", "them", "this", "that", "these",
  "those", "from", "have", "has", "had", "who", "what", "which", "it", "its", "into",
  "about", "per", "via", "if", "then", "than", "so", "such", "not", "no",
  // English JD filler
  "looking", "seeking", "strong", "good", "great", "excellent", "experience",
  "experienced", "years", "year", "work", "working", "role", "team", "join", "join",
  "ability", "able", "developer", "developers", "engineer", "candidate", "ideal",
  "responsibilities", "requirements", "must", "should", "plus", "etc", "including",
  // French function words
  "le", "la", "les", "un", "une", "des", "de", "du", "et", "ou", "avec", "en", "dans",
  "au", "aux", "pour", "sur", "vous", "votre", "nous", "notre", "qui", "que", "se",
  "sera", "est", "sont", "ce", "cette", "ces", "par", "plus", "ne", "pas",
  // French JD filler
  "recherchons", "recherche", "poste", "candidat", "idéal", "expérience", "années",
  "profil",
]);

/** Section synonyms by language; we care about the three core sections. */
const SECTION_PATTERNS: Record<Language, Record<string, RegExp>> = {
  en: {
    experience: /\b(experience|employment|work history|professional experience)\b/i,
    education: /\b(education|academic|qualifications)\b/i,
    skills: /\b(skills|competenc(?:e|ies)|technical skills)\b/i,
  },
  fr: {
    experience: /(expérience|parcours professionnel|expériences)/i,
    education: /(formation|éducation|études|diplôme|diplômes)/i,
    skills: /(compétences|compétence)/i,
  },
};

const CORE_SECTIONS = ["experience", "education", "skills"] as const;

export function extractKeywords(jobOffer: string): string[] {
  const tokens = jobOffer.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tokens) {
    if (t.length < 2) continue;
    if (/^\d+$/.test(t)) continue;
    if (STOPWORDS.has(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out.slice(0, 25);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function computeKeywordCoverage(
  cvText: string,
  keywords: string[],
): { matched: string[]; missing: string[]; coverage: number } {
  if (keywords.length === 0) return { matched: [], missing: [], coverage: 0 };
  const matched: string[] = [];
  const missing: string[] = [];
  for (const kw of keywords) {
    // Unicode-aware word boundaries. JS `\b` is ASCII-only, so it fails to match
    // accented terms ("équipe", "expérience") — which matters for French CVs.
    // Lookarounds for a letter/number on either side give a real word boundary.
    const re = new RegExp(
      `(?<![\\p{L}\\p{N}])${escapeRegExp(kw)}(?![\\p{L}\\p{N}])`,
      "iu",
    );
    if (re.test(cvText)) matched.push(kw);
    else missing.push(kw);
  }
  return { matched, missing, coverage: matched.length / keywords.length };
}

export function detectSections(
  cvText: string,
  // `lang` is accepted for API symmetry but section detection checks BOTH languages:
  // CV headers are unambiguous enough, and this avoids false "missing section" reports
  // when the coarse language detector misfires (e.g. an English-titled French CV).
  _lang?: Language,
): { found: string[]; missing: string[] } {
  const found: string[] = [];
  const missing: string[] = [];
  for (const section of CORE_SECTIONS) {
    const hit =
      SECTION_PATTERNS.en[section].test(cvText) ||
      SECTION_PATTERNS.fr[section].test(cvText);
    if (hit) found.push(section);
    else missing.push(section);
  }
  return { found, missing };
}

export function hasEmail(text: string): boolean {
  return /[^\s@]+@[^\s@]+\.[^\s@]+/.test(text);
}

export function hasPhone(text: string): boolean {
  const candidates = text.match(/\+?\d[\d\s().\-/]{6,}\d/g);
  if (!candidates) return false;
  return candidates.some((c) => c.replace(/\D/g, "").length >= 8);
}

export function isParseable(text: string): boolean {
  const t = text.trim();
  if (t.length < 20) return false;
  const words = t.match(/[\p{L}]{2,}/gu) ?? [];
  return words.length >= 5;
}

export function computeAtsResult(
  cvText: string,
  jobOffer: string,
  lang: Language,
): AtsResult {
  const parseable = isParseable(cvText);
  const keywords = extractKeywords(jobOffer);
  const { matched, missing, coverage } = computeKeywordCoverage(cvText, keywords);
  const { found, missing: sectionsMissing } = detectSections(cvText, lang);
  const hasContactEmail = hasEmail(cvText);
  const hasContactPhone = hasPhone(cvText);
  const hasSummary = /\b(summary|profile|profil|résumé|objective|objectif)\b/i.test(cvText);

  const notes: string[] = [];

  const sectionScore = found.length / CORE_SECTIONS.length;
  const contactScore = (hasContactEmail ? 0.5 : 0) + (hasContactPhone ? 0.5 : 0);
  const summaryScore = hasSummary ? 1 : 0;

  const raw =
    0.5 * coverage + 0.25 * sectionScore + 0.15 * contactScore + 0.1 * summaryScore;
  let score = Math.round(100 * raw);

  if (!parseable) {
    notes.push(
      "The CV text could not be reliably parsed. An ATS may fail to read this layout — avoid columns, tables, text-in-images and unusual fonts.",
    );
    score = Math.min(score, 30);
  }
  if (sectionsMissing.length > 0) {
    notes.push(`Missing standard section(s): ${sectionsMissing.join(", ")}.`);
  }
  if (!hasContactEmail) notes.push("No email address detected.");
  if (!hasContactPhone) notes.push("No phone number detected.");
  if (coverage < 0.5) {
    notes.push("Fewer than half of the job's key terms appear in the CV.");
  }

  return {
    score,
    parseable,
    keywordCoverage: coverage,
    matchedKeywords: matched,
    missingKeywords: missing,
    sectionsFound: found,
    sectionsMissing,
    hasContactEmail,
    hasContactPhone,
    notes,
  };
}
