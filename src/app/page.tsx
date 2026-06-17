"use client";

import { useEffect, useState } from "react";
import type { Report } from "@/lib/schema";
import { PasswordGate } from "@/components/PasswordGate";
import { AnalyzeForm } from "@/components/AnalyzeForm";
import { ReportView } from "@/components/ReportView";

export default function Home() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => setAuthed(Boolean(d.authed)))
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-zinc-400">
        Loading…
      </div>
    );
  }

  if (!authed) {
    return <PasswordGate onUnlock={() => setAuthed(true)} />;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="no-print mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">CV Analyser</h1>
        <p className="mt-1 text-sm text-zinc-500">
          A blunt, recruiter-grade analysis of your CV against a specific job offer.
        </p>
      </header>

      {report ? (
        <ReportView report={report} onReset={() => setReport(null)} />
      ) : (
        <AnalyzeForm onReport={setReport} />
      )}
    </main>
  );
}
