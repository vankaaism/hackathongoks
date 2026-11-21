# AGENTS.md: Cermin

## Product in one paragraph
Cermin lets a student rehearse an interview with an animated AI interviewer. Inputs: CV (PDF), job posting (PDF), company name. Three panels: LEFT live transcript with Grammarly-style inline feedback, CENTER animated interviewer (Duolingo-style, light-novel dialogue box), RIGHT chess.com-style performance graph with timestamped blunders. Signature feature: the **Awareness Effect**, where the UI vignettes, blurs and dims when blunders cluster so the student notices their own anxiety live.

## Hard constraints
- Hackathon scope. Ship the MVP in `docs/BUILD_PLAN.md` first. Do not start stretch items until every MVP item passes its check.
- One deployable Next.js app on Vercel. **No custom WebSocket server.** Browser streams audio straight to Deepgram using a short-lived token from an API route.
- Never store raw audio. Never log CV text or transcripts to third-party analytics.
- Transcript is a faithful record. Feedback never edits it.
- Never score accent or pronunciation.
- Awareness Effect must never cover the interviewer or the dialogue box, must respect `prefers-reduced-motion`, must never flash above 3 Hz, and must have an Off / Gentle / Full setting.
- Every LLM flag must be validated server-side (word indices exist, category valid). Drop invalid flags silently.

## Stack (decided, see docs/TECH_STACK.md)
Next.js 15 (App Router, TypeScript) · Tailwind · shadcn/ui · Zustand · Motion (`motion` package) · Recharts · Supabase (Postgres) · Deepgram streaming STT · Anthropic API (`claude-sonnet-5-5` for plan and analysis, `claude-haiku-5-5` optional for speed) · ElevenLabs or OpenAI TTS with browser `speechSynthesis` fallback · `unpdf` for PDF text · Vercel hosting. n8n is optional and only for post-session notifications.

## Repo layout to create
```
app/
  page.tsx                      landing + setup form
  interview/[sessionId]/page.tsx   3-panel screen
  api/
    parse/route.ts              PDFs -> cv_json, posting_json
    plan/route.ts               question plan
    deepgram-token/route.ts     short-lived STT token
    analyze/route.ts            per-answer semantic analysis
    summary/route.ts            final summary
    tts/route.ts                question audio
components/
  panels/{LeftTranscript,CenterStage,RightStats}.tsx
  effect/AwarenessOverlay.tsx
  character/Interviewer.tsx     layered SVG, 6 states
lib/
  analyzers/heuristics.ts       fillers, pauses, rate, hedges, restarts
  analyzers/composure.ts        Composure Load + level + hysteresis
  scoring.ts
  stt/deepgramClient.ts
  llm/{anthropic.ts,schemas.ts} zod schemas for every LLM JSON
  store.ts                      zustand
  db.ts                         supabase client
docs/  assets/  skills/
```

## Commands
```bash
pnpm install
pnpm dev            # http://localhost:3000
pnpm typecheck
pnpm lint
pnpm test           # vitest: heuristics, composure, scoring MUST have unit tests
```

## Definition of done (per task)
1. Typecheck and lint pass.
2. Unit tests exist for pure logic (heuristics, composure, scoring).
3. The task's acceptance check in `docs/BUILD_PLAN.md` passes manually.
4. No secrets in the client bundle (only `NEXT_PUBLIC_*` vars are client-visible).

## Style rules
- TypeScript strict. Zod-validate all external JSON (LLM, STT, uploads).
- Small pure functions for analysis so they are testable without a browser.
- All timestamps are integer milliseconds since session clock `t0` (first question audio ends).
- Keep thresholds and weights in `lib/config.ts`, never inline.
- Use the bundled skills in `skills/` as described in `skills/README.md`.

## Seed data for the demo
Create `seed/` with one realistic CV PDF and one job posting PDF (management trainee) plus a pre-recorded 90 s fallback session JSON that can replay through the UI without microphone or network.
