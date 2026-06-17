import type { Report } from "./schema";

/**
 * Turns a finished report into a self-contained Markdown prompt the user can paste
 * into Claude (alongside their CV) to apply every piece of feedback and get back an
 * updated .docx. Only improvement-oriented content is included (weaknesses, fixes,
 * rewrites) — strengths/scores are left out since the goal is to act on the report.
 *
 * Invariant: the generated prompt contains NO square-bracket placeholder tokens
 * (`[X]`, `[ADD NUMBER]`, …). The suggested rewrites from the analysis often carry
 * such placeholders, and a model will faithfully copy any it sees — producing a CV
 * littered with `[ADD NUMBER]`. We strip them from every emitted field so there is
 * nothing to echo, and we never print one as an example either.
 */

/** Remove bracketed placeholder tokens and tidy the dangling text around them. */
export function stripPlaceholders(s: string): string {
  return s
    // "...by [X]%", "...from [X]ms", "...to [Y]ms" → drop the preposition + token too
    .replace(/\b(?:by|from|to|of|over|reaching|achieving)\s+\[[^\]]*\][%a-z]*/gi, "")
    // any remaining bracket token, with an optional unit/percent suffix
    .replace(/\[[^\]]*\][%a-z]*/gi, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    // tidy space before commas/semicolons/percent, and before a sentence-ending period
    // (but NOT before ".NET", "·.js" etc. where the period starts a word)
    .replace(/\s+([,;:%])/g, "$1")
    .replace(/\s+\.(?=\s|$)/g, ".")
    .trim();
}

export function buildImprovementPrompt(report: Report): string {
  const { ats, analysis, synthesis } = report;
  const c = stripPlaceholders; // every dynamic string goes through this
  const lines: string[] = [];

  const jobOffer = (report.jobOffer ?? "").trim();

  lines.push("# Rewrite my CV into a final, ready-to-send .docx");
  lines.push("");
  lines.push(
    "I'm attaching my current CV, and the job I'm targeting is included below. Act as an expert " +
      "technical recruiter and CV writer.",
  );
  lines.push("");
  lines.push(
    "Your task: produce a final, ready-to-send **.docx** (Word document — NOT a PDF) that applies " +
      "every fix below. For each point, MAKE THE CONCRETE CHANGE YOURSELF — write the finished " +
      "wording using the real content of my CV and the target job. Decide and apply the change; " +
      "do not merely suggest it, do not ask me questions, and do not leave anything for me to fill in.",
  );
  lines.push("");
  lines.push("Hard rules (follow every one):");
  lines.push(
    "- **Write finished, concrete prose.** No placeholders, no square brackets, no fill-in markers, no 'add a number here' notes. Every line must be complete and usable exactly as written.",
  );
  lines.push(
    "- **Never invent** numbers, metrics, employers, dates, titles or skills. Use only what is true in my CV. If a bullet would be stronger with a number I haven't given, write a strong, specific version WITHOUT one (lead with scope, technology, action and outcome) — never leave a gap or marker.",
  );
  lines.push(
    "- **Tailor to the target job:** reflect its priorities and use its terminology wherever it genuinely applies to me.",
  );
  lines.push(
    "- **LENGTH — VERY IMPORTANT: if I have less than 10 years of experience, the CV MUST be ONE page. This is mandatory, not a preference.** Be ruthless to hit it: trim the summary to 2–3 lines, group and shorten the skills list to the most job-relevant items, keep bullets to a single line, and cut the least relevant content first (short or off-target roles). Only a profile with 10+ years of experience may use a second page.",
  );
  lines.push(
    "- **ATS formatting:** single-column layout; standard headings (Summary, Experience, Skills, Education); NO tables, columns, text boxes, images, icons or charts; no headers/footers; a standard font (Calibri, Arial or Georgia); black text; simple round bullets; dates as plain text.",
  );
  lines.push("- Produce the CV in the same language as my current CV.");
  lines.push("");

  if (jobOffer) {
    lines.push("## The job I'm targeting");
    lines.push(jobOffer);
    lines.push("");
  }

  lines.push("## Overall verdict");
  lines.push(c(synthesis.verdict));
  lines.push("");

  const actions = [...synthesis.prioritizedActions].sort((a, b) => a.priority - b.priority);
  if (actions.length > 0) {
    lines.push("## Highest-impact fixes (do these first)");
    actions.forEach((a, i) => {
      lines.push(`${i + 1}. **${c(a.action)}** — ${c(a.why)}`);
    });
    lines.push("");
  }

  if (analysis.keywordGap.missing.length > 0) {
    lines.push("## Skills / keywords to address");
    lines.push(
      "The job requires these, and they're missing or under-evidenced in my CV. " +
        "Add them ONLY where they are genuinely true for me; otherwise leave them out:",
    );
    for (const k of analysis.keywordGap.missing) lines.push(`- ${c(k)}`);
    lines.push("");
  }

  const rewrites = analysis.experienceAnalysis.filter(
    (i) => i.method === "WEAK" || i.rewrite.trim().length > 0,
  );
  if (rewrites.length > 0) {
    lines.push("## Rewrite these bullets (apply the change directly in the CV)");
    for (const item of rewrites) {
      lines.push(`- **Current:** ${c(item.source)}`);
      const issue = c(item.issue);
      const rewrite = c(item.rewrite);
      if (issue) lines.push(`  - Problem: ${issue}`);
      if (rewrite) lines.push(`  - Rewrite it along these lines (finish it concretely): ${rewrite}`);
    }
    lines.push("");
  }

  const bpFixes = analysis.bestPractices.filter((b) => b.status !== "pass");
  if (bpFixes.length > 0) {
    lines.push("## Best-practice fixes");
    for (const b of bpFixes) {
      lines.push(`- **${b.status.toUpperCase()}** — ${c(b.rule)}: ${c(b.note)}`);
    }
    lines.push("");
  }

  const concerns = [
    ...analysis.recruiterCritique.weaknesses,
    ...analysis.techRecruiterCritique.weaknesses,
  ];
  if (concerns.length > 0) {
    lines.push("## Recruiter & technical concerns to resolve");
    for (const w of concerns) {
      const point = c(w.point);
      const evidence = c(w.evidence);
      lines.push(evidence ? `- ${point} (in: “${evidence}”)` : `- ${point}`);
    }
    lines.push("");
  }

  if (ats.notes.length > 0) {
    lines.push("## ATS issues found in my current CV");
    for (const n of ats.notes) lines.push(`- ${c(n)}`);
    lines.push("");
  }

  lines.push("## Output");
  lines.push(
    "- Deliver my full updated CV as a downloadable **.docx** (Word) file — not a PDF — with everything above applied, tailored to the target job, and on a single page (two only if I have 10+ years of experience).",
  );
  lines.push("- The document itself must be final and clean: no placeholders or brackets anywhere in it.");
  lines.push(
    "- AFTER the document, separately in your reply (NOT inside the CV), list up to 3 places where adding a real metric would most strengthen it — so I can supply those numbers myself.",
  );

  return lines.join("\n");
}
