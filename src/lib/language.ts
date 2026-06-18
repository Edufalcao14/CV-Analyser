import type { Language } from "./schema";

/**
 * Lightweight EN / FR / PT detector. The audience is Belgium (EN/FR) and Brazil (PT).
 * Defaults to English when there's no clear signal — the LLM also re-confirms the
 * language, so this only needs to be a good first guess (it picks the region rubric
 * notes and is a hint to the analysis).
 */

const FR_MARKERS = new Set([
  "le", "la", "les", "un", "une", "des", "du", "et", "avec", "pour", "dans",
  "vous", "nous", "votre", "notre", "qui", "que", "est", "sont", "expérience",
  "expériences", "compétences", "formation", "développement", "gestion",
  "équipe", "équipes", "logiciel", "ingénieur", "années", "entreprise",
  "réalisé", "réalisations", "projet", "projets", "être", "cette",
]);

const EN_MARKERS = new Set([
  "the", "a", "an", "and", "with", "for", "in", "of", "to", "you", "we", "your",
  "our", "who", "is", "are", "experience", "skills", "education", "development",
  "management", "team", "teams", "software", "engineer", "years", "company",
  "built", "led", "leading", "background", "strong", "applications",
]);

const PT_MARKERS = new Set([
  "de", "da", "do", "dos", "das", "com", "mais", "anos", "para", "uma", "não",
  "são", "você", "em", "experiência", "experiências", "aplicações", "produção",
  "desenvolvimento", "desenvolvedor", "atuação", "qualidade", "formação",
  "competências", "habilidades", "empresa", "projeto", "projetos", "atual",
  "mil", "usuários", "pagamento", "pagamentos", "testes", "realização",
  "disponível", "escalável", "arquitetura",
]);

export function detectLanguage(text: string): Language {
  const tokens = text.toLowerCase().match(/[\p{L}]+/gu) ?? [];
  let en = 0;
  let fr = 0;
  let pt = 0;
  for (const t of tokens) {
    if (EN_MARKERS.has(t)) en++;
    if (FR_MARKERS.has(t)) fr++;
    if (PT_MARKERS.has(t)) pt++;
  }

  // Tilde (ã/õ) and the -ção/-ções ending are strongly Portuguese (French uses neither).
  pt += (text.match(/[ãõ]/giu) ?? []).length;
  pt += (text.match(/ç[ãõ]o|ções/giu) ?? []).length;
  // à / è / ù / œ lean French (Portuguese rarely uses them).
  fr += (text.match(/[àèùœ]/giu) ?? []).length * 0.5;

  const best = Math.max(en, fr, pt);
  if (best === 0) return "en"; // no signal → default
  if (pt === best) return "pt";
  if (fr === best) return "fr";
  return "en";
}
