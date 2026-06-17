import type { ReactNode } from "react";
import type { RuleStatus, ScoreBand } from "@/lib/schema";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-4 text-lg font-semibold tracking-tight text-zinc-900">
      {children}
    </h2>
  );
}

/** Band → colour. Calibrated so high scores look genuinely earned, low ones alarming. */
export function bandColor(band: ScoreBand): { text: string; ring: string; bg: string } {
  switch (band) {
    case "Excellent":
      return { text: "text-emerald-700", ring: "ring-emerald-500", bg: "bg-emerald-50" };
    case "Good":
      return { text: "text-green-700", ring: "ring-green-500", bg: "bg-green-50" };
    case "Fair":
      return { text: "text-amber-700", ring: "ring-amber-500", bg: "bg-amber-50" };
    case "Weak":
      return { text: "text-orange-700", ring: "ring-orange-500", bg: "bg-orange-50" };
    case "Poor":
      return { text: "text-red-700", ring: "ring-red-500", bg: "bg-red-50" };
  }
}

export function StatusBadge({ status }: { status: RuleStatus }) {
  const map: Record<RuleStatus, { label: string; cls: string }> = {
    pass: { label: "Pass", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
    warn: { label: "Warn", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
    fail: { label: "Fail", cls: "bg-red-50 text-red-700 ring-red-200" },
  };
  const { label, cls } = map[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}
    >
      {label}
    </span>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "good" | "bad" | "neutral";
}) {
  const cls =
    tone === "good"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : tone === "bad"
        ? "bg-red-50 text-red-700 ring-red-200"
        : "bg-zinc-100 text-zinc-700 ring-zinc-200";
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-sm font-medium ring-1 ring-inset ${cls}`}
    >
      {children}
    </span>
  );
}
