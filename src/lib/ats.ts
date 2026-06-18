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
  // Portuguese function words
  "de", "da", "do", "dos", "das", "e", "ou", "com", "sem", "para", "por", "em",
  "no", "na", "nos", "nas", "um", "uma", "uns", "umas", "que", "se", "ao", "aos",
  "os", "as", "como", "mais", "menos", "muito", "você", "nós", "seu", "sua", "não",
  "são", "ser", "está", "estão", "será", "este", "esta", "esse", "essa", "isso",
  // Portuguese JD filler
  "experiência", "experiências", "vaga", "candidato", "candidata", "buscamos",
  "procuramos", "anos", "atuação", "atuar", "conhecimento", "conhecimentos",
  "desejável", "requisitos", "atividades", "responsabilidades",
]);

/**
 * Section synonyms per language. Detection checks ALL languages (not just the
 * detected one), so a CV in any of these languages is parsed correctly — including
 * Portuguese, which Brazilian roles use.
 */
const SECTION_PATTERNS: Record<string, Record<string, RegExp>> = {
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
  pt: {
    experience: /(experiência profissional|experiências?|histórico profissional)/i,
    education: /(formação acadêmica|formação|educação|escolaridade)/i,
    skills: /(compet[êe]ncias?|habilidades|conhecimentos t[ée]cnicos)/i,
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
  const patternSets = Object.values(SECTION_PATTERNS);
  for (const section of CORE_SECTIONS) {
    const hit = patternSets.some((set) => set[section].test(cvText));
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

type ScoreParts = {
  parseable: boolean;
  coverage: number;
  sectionScore: number;
  contactScore: number;
  summaryScore: number;
};

function atsScore(p: ScoreParts): number {
  const raw =
    0.5 * p.coverage + 0.25 * p.sectionScore + 0.15 * p.contactScore + 0.1 * p.summaryScore;
  const score = Math.round(100 * raw);
  // A CV that can't be parsed is ATS-hostile regardless of its keywords.
  return p.parseable ? score : Math.min(score, 30);
}

function atsNotes(args: {
  parseable: boolean;
  coverage: number;
  sectionsMissing: string[];
  hasContactEmail: boolean;
  hasContactPhone: boolean;
}): string[] {
  const notes: string[] = [];
  if (!args.parseable) {
    notes.push(
      "The CV text could not be reliably parsed. An ATS may fail to read this layout — avoid columns, tables, text-in-images and unusual fonts.",
    );
  }
  if (args.sectionsMissing.length > 0) {
    notes.push(`Missing standard section(s): ${args.sectionsMissing.join(", ")}.`);
  }
  if (!args.hasContactEmail) notes.push("No email address detected.");
  if (!args.hasContactPhone) notes.push("No phone number detected.");
  if (args.coverage < 0.5) {
    notes.push("Fewer than half of the job's required skills appear in the CV.");
  }
  return notes;
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
  const hasSummary =
    /\b(summary|profile|profil|résumé|resumo|objective|objectif|objetivo|perfil)\b/i.test(cvText);

  const score = atsScore({
    parseable,
    coverage,
    sectionScore: found.length / CORE_SECTIONS.length,
    contactScore: (hasContactEmail ? 0.5 : 0) + (hasContactPhone ? 0.5 : 0),
    summaryScore: hasSummary ? 1 : 0,
  });

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
    hasSummary,
    notes: atsNotes({ parseable, coverage, sectionsMissing, hasContactEmail, hasContactPhone }),
  };
}

/**
 * Recomputes the ATS keyword coverage + score from the LLM's authoritative
 * required-skills lists, so the ATS card and the Skills-gap section can no longer
 * contradict each other. The heuristic `extractKeywords` is only a pre-LLM hint;
 * this is the number the user actually sees.
 */
export function reconcileAtsKeywords(
  ats: AtsResult,
  present: string[],
  missing: string[],
): AtsResult {
  const total = present.length + missing.length;
  const coverage = total > 0 ? present.length / total : 0;
  const score = atsScore({
    parseable: ats.parseable,
    coverage,
    sectionScore: ats.sectionsFound.length / CORE_SECTIONS.length,
    contactScore: (ats.hasContactEmail ? 0.5 : 0) + (ats.hasContactPhone ? 0.5 : 0),
    summaryScore: ats.hasSummary ? 1 : 0,
  });
  return {
    ...ats,
    score,
    keywordCoverage: coverage,
    matchedKeywords: present,
    missingKeywords: missing,
    notes: atsNotes({
      parseable: ats.parseable,
      coverage,
      sectionsMissing: ats.sectionsMissing,
      hasContactEmail: ats.hasContactEmail,
      hasContactPhone: ats.hasContactPhone,
    }),
  };
}
