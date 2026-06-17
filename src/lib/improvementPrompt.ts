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

  lines.push("# Apply this CV feedback and regenerate my CV as a .docx");
  lines.push("");
  lines.push(
    "I'm attaching my current CV. Act as an expert technical recruiter and CV writer. " +
      "Apply ALL of the feedback below, then produce an updated, ATS-friendly **.docx** file " +
      "(a Word document — NOT a PDF) with the changes applied.",
  );
  lines.push("");
  lines.push("Rules:");
  lines.push(
    "- Keep everything truthful. Do NOT invent experience, employers, skills, or metrics I don't have.",
  );
  lines.push(
    "- Where a number/metric would strengthen a bullet but you don't know it, insert a clearly-marked placeholder like `[ADD NUMBER]` for me to fill in.",
  );
  lines.push("- Produce the CV in the same language as my current CV.");
  lines.push(
    "- Improve wording, structure, quantification and ATS-friendliness; preserve my real content.",
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

  if (!ats.parseable || ats.notes.length > 0) {
    lines.push("## ATS / formatting");
    if (!ats.parseable) {
      lines.push(
        "- My current CV does not parse cleanly. Use a simple single-column, standard-heading layout with no tables, columns or text-in-images.",
      );
    }
    for (const n of ats.notes) lines.push(`- ${n}`);
    lines.push("");
  }

  lines.push("## Output");
  lines.push("- Regenerate my full CV as a downloadable **.docx** file with all of the above applied.");
  lines.push("- List any placeholders you inserted so I know what to fill in.");

  return lines.join("\n");
}
