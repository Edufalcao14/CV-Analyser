import OpenAI from "openai";
import type { ZodType } from "zod";

/**
 * Thin wrapper around OpenRouter (OpenAI-compatible API). One key, one billing
 * relationship, and the model is a single env var so quality is a one-line swap.
 *
 * SECURITY: this only ever runs server-side (API routes). The key must never
 * reach the browser.
 */

const BASE_URL = "https://openrouter.ai/api/v1";

export const DEFAULT_MODEL = "anthropic/claude-sonnet-4.6";

export function getModel(): string {
  return process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
}

let client: OpenAI | null = null;

function getClient(): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to .env.local (see .env.example).",
    );
  }
  if (!client) {
    client = new OpenAI({
      apiKey,
      baseURL: BASE_URL,
      defaultHeaders: {
        "HTTP-Referer": "https://github.com/cv-analyser",
        "X-Title": "CV Analyser",
      },
    });
  }
  return client;
}

/** A user-message content part. `file` is OpenRouter's PDF/document attachment shape. */
export type ContentPart =
  | { type: "text"; text: string }
  | { type: "file"; file: { filename: string; file_data: string } };

function extractJson(raw: string): unknown {
  let text = raw.trim();
  // Strip ```json ... ``` fences if the model added them.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  // Fall back to the outermost { ... } span.
  if (!text.startsWith("{")) {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first !== -1 && last > first) text = text.slice(first, last + 1);
  }
  return JSON.parse(text);
}

/**
 * Calls the model and returns a value validated against `schema`.
 * `userContent` is either plain text or an array of content parts (for vision/file reads).
 */
export async function callJson<T>(args: {
  schema: ZodType<T>;
  system: string;
  userContent: string | ContentPart[];
  model?: string;
  maxTokens?: number;
}): Promise<T> {
  const { schema, system, userContent, model = getModel(), maxTokens = 4000 } = args;

  const response = await getClient().chat.completions.create({
    model,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      // `file` content parts aren't in the stock OpenAI types; OpenRouter accepts them.
      { role: "user", content: userContent as never },
    ],
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error("Empty response from model.");

  let parsed: unknown;
  try {
    parsed = extractJson(raw);
  } catch {
    throw new Error("Model did not return valid JSON.");
  }
  return schema.parse(parsed);
}
