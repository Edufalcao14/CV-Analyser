import mammoth from "mammoth";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

/**
 * Document parsing for the dual-path read:
 *  - `extractText` powers the mechanical ATS check (the deliberately "dumb" path that
 *    mirrors real ATS software) and is the reliable backbone of the judgment pass.
 *  - `toDataUrl` lets the judgment pass ALSO send the original PDF to a vision-capable
 *    model for a richer "as a recruiter sees it" read (best-effort; see analyze.ts).
 */

export type UploadedFile = {
  buffer: Buffer;
  mimeType: string;
  name: string;
};

export type FileKind = "pdf" | "docx" | "text" | "unknown";

export function detectKind(file: { mimeType: string; name: string }): FileKind {
  const mime = file.mimeType.toLowerCase();
  const name = file.name.toLowerCase();
  if (mime.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  if (
    mime.includes("officedocument.wordprocessingml") ||
    mime.includes("msword") ||
    name.endsWith(".docx") ||
    name.endsWith(".doc")
  ) {
    return "docx";
  }
  if (mime.startsWith("text/") || name.endsWith(".txt")) return "text";
  return "unknown";
}

export async function extractText(file: UploadedFile): Promise<string> {
  const kind = detectKind(file);
  try {
    switch (kind) {
      case "pdf": {
        const data = await pdfParse(file.buffer);
        return data.text ?? "";
      }
      case "docx": {
        const { value } = await mammoth.extractRawText({ buffer: file.buffer });
        return value ?? "";
      }
      case "text":
        return file.buffer.toString("utf8");
      default:
        // Last resort: try to read it as text rather than failing outright.
        return file.buffer.toString("utf8");
    }
  } catch {
    // Extraction failed — return empty so the ATS check correctly flags "not parseable".
    return "";
  }
}

export function toDataUrl(file: UploadedFile): string {
  return `data:${file.mimeType};base64,${file.buffer.toString("base64")}`;
}
