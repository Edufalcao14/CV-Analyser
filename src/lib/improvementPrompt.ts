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
    .replace(/\s+([.,;:%])/g, "$1")
    .trim();
}

export function buildImprovementPrompt(report: Report): string {
  const { ats, analysis, synthesis } = report;
  const c = stripPlaceholders; // every dynamic string goes through this
  const lines: string[] = [];

  // Senior CVs may run to two pages; everyone else must fit one.
  const senior =
    analysis.seniority.demonstrated === "senior" || analysis.seniority.target === "senior";
  const lengthTarget = senior
    ? "ONE page (two at the very most, only if essential)"
    : "exactly ONE page";

  lines.push("# Apply this CV feedback and regenerate my CV as a clean .docx");
  lines.push("");
  lines.push(
    "I'm attaching my current CV. Act as an expert technical recruiter and CV writer. " +
      "Apply ALL of the feedback below, then deliver an updated, ATS-friendly **.docx** file " +
      "(a Word document — NOT a PDF) that is final and ready to send as-is.",
  );
  lines.push("");
  lines.push("Hard rules (follow every one):");
  lines.push(
    "- **The CV must be final — zero placeholders.** Do NOT use square brackets, fill-in markers, TODO notes, or any 'add a number here' text of any kind. Every line must be finished prose.",
  );
  lines.push(
    "- **Never invent or estimate** numbers, metrics, employers, dates, titles, or skills. Use only what is already in my CV.",
  );
  lines.push(
    "- If a bullet would be stronger with a metric I haven't given you, write it strongly WITHOUT a number — lead with scope, technology, action and qualitative outcome. Do not leave a gap or marker for the number.",
  );
  lines.push(
    `- **Length: the CV MUST fit on ${lengthTarget}.** Be ruthless: trim the summary to 2–3 lines, group and shorten the skills list to the most job-relevant items, keep bullets to a single line where possible, and cut the least relevant content first (e.g. short or off-target roles).`,
  );
  lines.push(
    "- **ATS formatting:** single-column layout; standard headings (Summary, Experience, Skills, Education); NO tables, columns, text boxes, images, icons or charts; no headers/footers; a standard font (Calibri, Arial or Georgia); black text; simple round bullets; dates as plain text.",
  );
  lines.push(
    "- Produce the CV in the same language as my current CV. Improve wording, structure, quantification and ATS-friendliness while preserving my real content.",
  );
  lines.push("");

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
    lines.push("## Rewrite these experience bullets");
    for (const item of rewrites) {
      lines.push(`- **Current:** ${c(item.source)}`);
      const issue = c(item.issue);
      const rewrite = c(item.rewrite);
      if (issue) lines.push(`  - Issue: ${issue}`);
      if (rewrite) lines.push(`  - Suggested direction: ${rewrite}`);
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
    `- Deliver my full updated CV as a downloadable **.docx** (Word) file — not a PDF — with everything above applied and fitting on ${lengthTarget}.`,
  );
  lines.push("- The document itself must be final and clean: no placeholders or brackets anywhere in it.");
  lines.push(
    "- AFTER the document, separately in your reply (NOT inside the CV), list up to 3 places where adding a real metric would most strengthen it — so I can supply those numbers myself.",
  );

  return lines.join("\n");
}
