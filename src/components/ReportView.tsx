"use client";

import { useState } from "react";
import { scoreBand, type Critique, type Report } from "@/lib/schema";
import { buildImprovementPrompt } from "@/lib/improvementPrompt";
import { Card, SectionTitle, StatusBadge, Pill, bandColor } from "./ui";

function ScoreCard({
  label,
  score,
  reason,
}: {
  label: string;
  score: number;
  reason: string;
}) {
  const band = scoreBand(score);
  const c = bandColor(band);
  return (
    <Card className={`ring-1 ring-inset ${c.ring} ${c.bg}`}>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-zinc-600">{label}</span>
        <span className={`text-sm font-semibold ${c.text}`}>{band}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className={`text-4xl font-bold ${c.text}`}>{score}</span>
        <span className="text-lg text-zinc-400">/100</span>
      </div>
      {reason && <p className="mt-2 text-sm text-zinc-600">{reason}</p>}
    </Card>
  );
}

function CritiqueBlock({ title, critique }: { title: string; critique: Critique }) {
  return (
    <Card>
      <SectionTitle>{title}</SectionTitle>
      <p className="text-sm text-zinc-700">{critique.summary}</p>

      {critique.strengths.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-emerald-700">Strengths</h3>
          <ul className="space-y-2">
            {critique.strengths.map((f, i) => (
              <li key={i} className="text-sm text-zinc-700">
                <span className="font-medium">{f.point}</span>
                {f.evidence && (
                  <span className="mt-0.5 block text-xs italic text-zinc-500">
                    “{f.evidence}”
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {critique.weaknesses.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-red-700">Weaknesses</h3>
          <ul className="space-y-2">
            {critique.weaknesses.map((f, i) => (
              <li key={i} className="text-sm text-zinc-700">
                <span className="font-medium">{f.point}</span>
                {f.evidence && (
                  <span className="mt-0.5 block text-xs italic text-zinc-500">
                    “{f.evidence}”
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

const METHOD_TONE: Record<string, string> = {
  STAR: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  XYZ: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  WEAK: "bg-red-50 text-red-700 ring-red-200",
  OTHER: "bg-zinc-100 text-zinc-600 ring-zinc-200",
};

export function ReportView({ report, onReset }: { report: Report; onReset: () => void }) {
  const { ats, analysis, synthesis } = report;
  const [copied, setCopied] = useState(false);

  async function copyImprovementPrompt() {
    const md = buildImprovementPrompt(report);
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard API unavailable (e.g. non-secure context) — fall back to a prompt.
      window.prompt("Copy the prompt below:", md);
    }
  }

  const skillsPresent = analysis.keywordGap.present.length;
  const skillsTotal = skillsPresent + analysis.keywordGap.missing.length;
  const matchReason =
    skillsTotal > 0
      ? `${skillsPresent} of ${skillsTotal} required skills present.`
      : analysis.seniority.gapNote;
  const rewritesHavePlaceholders = analysis.experienceAnalysis.some((i) =>
    /\[[^\]]*\]/.test(i.rewrite),
  );

  return (
    <div className="print-container space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onReset}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-400"
        >
          ← New analysis
        </button>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={copyImprovementPrompt}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-400"
            title="Copy a Markdown prompt of all the fixes — paste it into Claude with your CV to regenerate an updated .docx"
          >
            {copied ? "✓ Copied for Claude" : "Copy fixes for Claude"}
          </button>
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            Download PDF
          </button>
        </div>
      </div>

      {/* Verdict */}
      <Card>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          Verdict
        </p>
        <p className="mt-1 text-xl font-semibold tracking-tight text-zinc-900">
          {synthesis.verdict}
        </p>
        <p className="mt-3 text-sm text-zinc-500">
          Seniority — demonstrated:{" "}
          <span className="font-medium text-zinc-700">{analysis.seniority.demonstrated}</span>{" "}
          · required:{" "}
          <span className="font-medium text-zinc-700">{analysis.seniority.required}</span>{" "}
          · target:{" "}
          <span className="font-medium text-zinc-700">{analysis.seniority.target}</span>
        </p>
        {analysis.seniority.gapNote && (
          <p className="mt-1 text-sm text-zinc-700">{analysis.seniority.gapNote}</p>
        )}
      </Card>

      {/* Scores */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ScoreCard label="Job match" score={analysis.matchScore} reason={matchReason} />
        <ScoreCard
          label="ATS friendliness"
          score={ats.score}
          reason={
            ats.parseable
              ? `${Math.round(ats.keywordCoverage * 100)}% of the job's key terms found.`
              : "Your CV could not be parsed cleanly — an ATS may reject it."
          }
        />
      </div>

      {/* Prioritized actions */}
      <Card>
        <SectionTitle>Do these first</SectionTitle>
        <ol className="space-y-3">
          {[...synthesis.prioritizedActions]
            .sort((a, b) => a.priority - b.priority)
            .map((a, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-zinc-900">{a.action}</p>
                  <p className="text-sm text-zinc-500">{a.why}</p>
                </div>
              </li>
            ))}
        </ol>
      </Card>

      {/* Keyword / skills gap */}
      <Card>
        <SectionTitle>Skills &amp; keyword gap</SectionTitle>
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
              Present
            </p>
            <div className="flex flex-wrap gap-1.5">
              {analysis.keywordGap.present.length === 0 ? (
                <span className="text-sm text-zinc-400">None detected</span>
              ) : (
                analysis.keywordGap.present.map((k) => (
                  <Pill key={k} tone="good">
                    {k}
                  </Pill>
                ))
              )}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
              Missing
            </p>
            <div className="flex flex-wrap gap-1.5">
              {analysis.keywordGap.missing.length === 0 ? (
                <span className="text-sm text-zinc-400">Nothing major missing</span>
              ) : (
                analysis.keywordGap.missing.map((k) => (
                  <Pill key={k} tone="bad">
                    {k}
                  </Pill>
                ))
              )}
            </div>
          </div>
        </div>
      </Card>

      <CritiqueBlock title="Recruiter critique" critique={analysis.recruiterCritique} />
      <CritiqueBlock
        title="Technical recruiter critique"
        critique={analysis.techRecruiterCritique}
      />

      {/* Experience writing analysis */}
      {analysis.experienceAnalysis.length > 0 && (
        <Card>
          <SectionTitle>Experience writing (STAR / XYZ)</SectionTitle>
          {rewritesHavePlaceholders && (
            <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Rewrites use placeholders like <code>[X]%</code> or <code>[Y]ms</code> — fill
              in your real numbers before using them.
            </p>
          )}
          <ul className="space-y-4">
            {analysis.experienceAnalysis.map((item, i) => (
              <li key={i} className="border-l-2 border-zinc-100 pl-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-zinc-900">{item.source}</p>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                      METHOD_TONE[item.method] ?? METHOD_TONE.OTHER
                    }`}
                  >
                    {item.method}
                  </span>
                </div>
                {item.issue && <p className="mt-1 text-sm text-zinc-600">{item.issue}</p>}
                {item.rewrite && (
                  <p className="mt-2 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-800">
                    <span className="font-medium text-zinc-500">Rewrite: </span>
                    {item.rewrite}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Best practices checklist */}
      <Card>
        <SectionTitle>Best-practices checklist</SectionTitle>
        <ul className="space-y-3">
          {analysis.bestPractices.map((bp, i) => (
            <li key={i} className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-900">{bp.rule}</p>
                {bp.note && <p className="text-sm text-zinc-500">{bp.note}</p>}
              </div>
              <StatusBadge status={bp.status} />
            </li>
          ))}
        </ul>
      </Card>

      {/* ATS detail */}
      {ats.notes.length > 0 && (
        <Card>
          <SectionTitle>ATS notes</SectionTitle>
          <ul className="list-inside list-disc space-y-1 text-sm text-zinc-600">
            {ats.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
