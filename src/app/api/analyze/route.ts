import { NextResponse } from "next/server";
import { runAnalysis } from "@/lib/analyze";
import { isAuthed } from "@/lib/session";
import { SeniorityLevel } from "@/lib/schema";

// pdf-parse / mammoth need the Node runtime (not edge).
export const runtime = "nodejs";
export const maxDuration = 120;

function normalizeTarget(value: unknown): SeniorityLevel {
  const parsed = SeniorityLevel.safeParse(value);
  return parsed.success ? parsed.data : "unknown";
}

export async function POST(req: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const file = form.get("cv");
  const jobOffer = form.get("jobOffer");
  const targetLevel = normalizeTarget(form.get("targetLevel"));

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Please upload a CV file." }, { status: 400 });
  }
  if (typeof jobOffer !== "string" || jobOffer.trim().length === 0) {
    return NextResponse.json({ error: "Please paste the job offer." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const report = await runAnalysis({
      cv: { buffer, mimeType: file.type, name: file.name },
      jobOffer,
      targetLevel,
    });
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
