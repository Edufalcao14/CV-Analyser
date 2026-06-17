# CV Analyser

A private, password-gated web tool that gives a **blunt, recruiter-grade analysis** of a CV against a specific job offer. Upload a CV (PDF/DOCX), paste the job description, and get a structured report: match + ATS scores, skills gap, recruiter & tech-recruiter critique, STAR/XYZ writing analysis, a best-practices checklist, and a prioritized action list.

## How it works

**Hybrid engine:**

- **Mechanical ATS checks run in code** (`src/lib/ats.ts`) — keyword coverage, section detection, contact info, parseability. This is the deliberately "dumb" path that mirrors real applicant-tracking software, so a CV that parses badly genuinely scores badly.
- **Judgment runs on an LLM** via [OpenRouter](https://openrouter.ai) (default `anthropic/claude-sonnet-4.6` — one-line swap to Opus for higher quality).

**Dual-path read:** extracted text is the backbone and powers the ATS check. The original PDF is sent to the vision model **only as a fallback** when text extraction is poor (a scanned or multi-column "designer" CV) — clean text PDFs stay text-only to keep token costs down (toggle the fallback with `ENABLE_VISION`).

The ATS keyword coverage is **reconciled** against the LLM's extracted required-skills list, so the ATS score and the Skills-gap section always show consistent numbers.

**Two-call pipeline:** a detailed judgment pass → a synthesis pass that steps back for the headline verdict + top fixes. Both return validated JSON (`src/lib/schema.ts`), so the UI renders structured fields, never parsed prose.

**Copy fixes for Claude:** a button on the report copies a self-contained Markdown prompt (all the actionable fixes, rewrites and missing skills) to your clipboard — paste it into Claude with your CV attached to apply the feedback and regenerate an updated **.docx**.

**Realism is enforced structurally** — calibrated score anchors, an evidence requirement on every finding, and "tough but fair recruiter" framing — so the model can't grade-inflate.

**Region-aware:** FR/EN, report mirrors the CV's language, Belgian/EU CV norms (a photo or date-of-birth is not penalised).

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Required env (`.env.local`):

| Var                 | What                                                                |
| ------------------- | ------------------------------------------------------------------- |
| `OPENROUTER_API_KEY`| Your OpenRouter key. **Also set a hard spend cap on OpenRouter.**   |
| `OPENROUTER_MODEL`  | e.g. `anthropic/claude-sonnet-4.6`                                  |
| `APP_PASSWORD`      | The shared password that unlocks the app                            |
| `AUTH_SECRET`       | Long random string for signing the session cookie (`openssl rand -hex 32`) |
| `ENABLE_VISION`     | `true` (default) / `false`                                          |

## Security

- **OpenRouter spend cap** is your hard backstop — set it in the OpenRouter dashboard.
- The app is gated by a **shared password**; on success the server sets an **HttpOnly, Secure, SameSite cookie** (invisible to JS — unlike `localStorage`), so you don't retype it.
- Nothing is stored: upload → analyse → report → **Download PDF** → done.

## Scripts

```bash
npm run dev         # local dev server
npm run build       # production build
npm run typecheck   # tsc --noEmit
npm test            # vitest (pure-logic unit tests)
```

## Tests

Unit tests cover the pure, deterministic logic: ATS checks (`ats.test.ts`), language detection (`language.test.ts`), and the signed session token (`auth.test.ts`). The LLM passes are validated by typecheck + schema validation at runtime (they need a real API key to exercise end-to-end).

## Deferred (for if/when this is commercialised)

User accounts, saved history, payments, rate-limiting, input-size validation, job-offer URL fetching, runtime web search for trending skills.
