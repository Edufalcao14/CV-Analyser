import type { Report } from "./schema";

/**
 * Turns a finished report into a self-contained Markdown prompt the user can paste
 * into Claude (alongside their CV) to apply every piece of feedback and get back an
 * updated .docx. Only improvement-oriented content is included (weaknesses, fixes,
 * rewrites) — strengths/scores are left out since the goal is to act on the report.
 */
export function buildImprovementPrompt(report: Report): string {
  const { ats, analysis, synthesis } = report;
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
      "(a Word document — NOT a PDF) that is ready to send as-is.",
  );
  lines.push("");
  lines.push("Hard rules (follow every one):");
  lines.push(
    "- **No placeholders, ever.** Do NOT put `[ADD NUMBER]`, `[X]`, `[ADD ...]`, brackets, or TODO-style notes anywhere in the CV. The document must be clean and ready to send.",
  );
  lines.push(
    "- **Never invent or estimate** numbers, metrics, employers, dates, titles, or skills. Use only what is already in my CV.",
  );
  lines.push(
    "- Some suggested rewrites below contain bracketed placeholders like `[X]%` or `[Y]ms`. Do NOT copy the brackets. If the real figure already appears in my CV, use it; otherwise rephrase the bullet to be strong WITHOUT that metric (lead with scope, technology, action and qualitative outcome).",
  );
  lines.push(
    `- **Length: the CV MUST fit on ${lengthTarget}.** Be ruthless: trim the summary to 2–3 lines, group and shorten the skills list to the most job-relevant items, keep bullets to a single line where possible, and cut the least relevant content first (e.g. short/off-target roles).`,
  );
  lines.push(
    "- **ATS formatting:** single-column layout; standard headings (Summary, Experience, Skills, Education); NO tables, columns, text boxes, images, icons or charts; no headers/footers; a standard font (Calibri, Arial or Georgia); black text; simple round bullets; dates as plain text.",
  );
  lines.push(
    "- Produce the CV in the same language as my current CV. Improve wording, structure, quantification and ATS-friendliness while preserving my real content.",
  );
  lines.push("");

  lines.push("## Overall verdict");
  lines.push(synthesis.verdict);
  lines.push("");

  const actions = [...synthesis.prioritizedActions].sort((a, b) => a.priority - b.priority);
  if (actions.length > 0) {
    lines.push("## Highest-impact fixes (do these first)");
    actions.forEach((a, i) => {
      lines.push(`${i + 1}. **${a.action}** — ${a.why}`);
    });
    lines.push("");
  }

  if (analysis.keywordGap.missing.length > 0) {
    lines.push("## Skills / keywords to address");
    lines.push(
      "The job requires these, and they're missing or under-evidenced in my CV. " +
        "Add them ONLY where they are genuinely true for me; otherwise leave them out:",
    );
    for (const k of analysis.keywordGap.missing) lines.push(`- ${k}`);
    lines.push("");
  }

  const rewrites = analysis.experienceAnalysis.filter(
    (i) => i.method === "WEAK" || i.rewrite.trim().length > 0,
  );
  if (rewrites.length > 0) {
    lines.push("## Rewrite these experience bullets");
    for (const item of rewrites) {
      lines.push(`- **Current:** ${item.source}`);
      if (item.issue) lines.push(`  - Issue: ${item.issue}`);
      if (item.rewrite) lines.push(`  - Suggested rewrite: ${item.rewrite}`);
    }
    lines.push("");
  }

  const bpFixes = analysis.bestPractices.filter((b) => b.status !== "pass");
  if (bpFixes.length > 0) {
    lines.push("## Best-practice fixes");
    for (const b of bpFixes) {
      lines.push(`- [${b.status.toUpperCase()}] ${b.rule}: ${b.note}`);
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
      lines.push(w.evidence ? `- ${w.point} (in: “${w.evidence}”)` : `- ${w.point}`);
    }
    lines.push("");
  }

  if (ats.notes.length > 0) {
    lines.push("## ATS issues found in my current CV");
    for (const n of ats.notes) lines.push(`- ${n}`);
    lines.push("");
  }

  lines.push("## Output");
  lines.push(
    `- Deliver my full updated CV as a downloadable **.docx** (Word) file — not a PDF — with everything above applied and fitting on ${lengthTarget}.`,
  );
  lines.push("- The document itself must be clean: no placeholders, brackets or notes inside it.");
  lines.push(
    "- AFTER the document, separately in your reply (NOT inside the CV), list up to 3 places where adding a real metric would most strengthen it — so I can supply those numbers myself.",
  );

  return lines.join("\n");
}
