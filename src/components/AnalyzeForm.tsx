"use client";

import { useState } from "react";
import type { Report, SeniorityLevel } from "@/lib/schema";
import { Card } from "./ui";

const TARGET_OPTIONS: { value: SeniorityLevel; label: string }[] = [
  { value: "unknown", label: "Auto-detect" },
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
];

export function AnalyzeForm({ onReport }: { onReport: (r: Report) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [jobOffer, setJobOffer] = useState("");
  const [target, setTarget] = useState<SeniorityLevel>("unknown");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = file !== null && jobOffer.trim().length > 0 && !loading;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("cv", file);
      body.set("jobOffer", jobOffer);
      body.set("targetLevel", target);
      const res = await fetch("/api/analyze", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        onReport(data as Report);
      } else {
        setError(data.error ?? "Analysis failed.");
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <label className="mb-2 block text-sm font-medium text-zinc-900">
          Your CV (PDF or DOCX)
        </label>
        <input
          type="file"
          accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-zinc-600 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-800"
        />
        {file && <p className="mt-2 text-xs text-zinc-500">Selected: {file.name}</p>}
      </Card>

      <Card>
        <label className="mb-2 block text-sm font-medium text-zinc-900">
          Job offer
        </label>
        <p className="mb-2 text-xs text-zinc-500">
          Paste the full job description you&apos;re applying to.
        </p>
        <textarea
          value={jobOffer}
          onChange={(e) => setJobOffer(e.target.value)}
          rows={8}
          placeholder="Paste the job description here…"
          className="w-full resize-y rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
        />
      </Card>

      <Card>
        <label className="mb-2 block text-sm font-medium text-zinc-900">
          Target level <span className="font-normal text-zinc-400">(optional)</span>
        </label>
        <p className="mb-3 text-xs text-zinc-500">
          What level are you aiming for? Leave on auto-detect to infer it from your CV.
        </p>
        <div className="flex flex-wrap gap-2">
          {TARGET_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTarget(opt.value)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                target === opt.value
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
      >
        {loading ? "Analysing… this can take up to a minute" : "Analyse my CV"}
      </button>
    </form>
  );
}
