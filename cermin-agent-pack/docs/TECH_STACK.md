# TECH_STACK.md: tool decisions for Cermin

Principle: the fewest moving parts that still meet the latency targets (transcript under 1.5 s, heuristic flags under 2 s). Every extra hop costs time and demo risk.

## Decision table

| Need | Decision | Why | Skip / fallback |
|------|----------|-----|-----------------|
| Frontend + backend | **Next.js 15 (App Router, TS)** | One repo, API routes replace a backend | Vite + Express if the team dislikes Next |
| Hosting | **Vercel** | One-click deploy, preview URLs for judges | Netlify, Railway |
| Realtime transport | **None of our own.** Browser connects directly to Deepgram WebSocket with a short-lived token | Vercel serverless does not hold long-lived WebSockets; direct connection also removes a latency hop | Separate WS server on Railway/Fly only if direct connection is impossible |
| Speech-to-text | **Deepgram streaming (Nova family)** with interim results, punctuation, filler words, word timestamps | Gives per-word `start`/`end` needed for pause and rate detection | Browser Web Speech API (Chrome only, weak timestamps) as emergency fallback |
| LLM | **Anthropic API**: `claude-sonnet-5-5` for plan + analysis, `claude-haiku-5-5` if analysis latency is too high | Strong structured output and CV-vs-answer consistency checks | Any comparable LLM |
| TTS | **ElevenLabs or OpenAI TTS**, pre-generated for all questions right after the plan | Removes latency during the interview | Browser `speechSynthesis` |
| PDF text | **`unpdf`** in a Node-runtime route | Works in serverless, no native deps | `pdf-parse`; paste-text fallback for scanned PDFs |
| Database | **Supabase Postgres** | Free tier, SQL, optional auth | SQLite via Turso; or skip auth and use an anonymous session id |
| UI | **Tailwind + shadcn/ui** | Fast, consistent | |
| State | **Zustand** | Tiny, no boilerplate, good for streaming updates | |
| Animation | **`motion` (Framer Motion)** + layered inline SVG character | Flat style from Image 2 is cheap to animate | CSS keyframes only |
| Charts | **Recharts** (AreaChart + custom dots) | Quick custom markers, click handlers | visx |
| Validation | **Zod** | Validates LLM JSON and STT payloads | |
| Tests | **Vitest** for pure logic | Heuristics and composure must be tested | |
| Notifications (optional) | **n8n** webhook, post-session only | See below | Skip entirely in MVP |

## n8n: use or skip?

**Skip in the realtime path.** n8n adds a network hop and per-execution overhead, which breaks the latency budget and adds a demo failure point.

**Use only for post-session CDC workflows (stretch):**

1. App POSTs to `N8N_WEBHOOK_URL` when a session finishes (and only if the student pressed Share).
2. n8n flow: Webhook, then branch into (a) email the student their summary, (b) append an anonymized row to a Google Sheet for CDC weakness statistics, (c) Slack or WhatsApp ping to the counselor.

Webhook payload (no transcript, no CV text):

```json
{
  "session_id": "uuid",
  "company_name": "string",
  "final_score": 74,
  "top_weaknesses": ["Fluency", "Evidence", "Consistency"],
  "blunders_per_minute": 2.1,
  "shared_with_cdc": true,
  "finished_at": "ISO-8601"
}
```

Host on n8n Cloud for speed, or self-host with Docker if the CDC needs data residency.

## Explicitly not needed

Redis, Kafka, a vector database, LangChain or LlamaIndex, a separate WebSocket server, Docker for the app, microservices, a custom auth system.

## Data flow

```
Setup:   Browser -> /api/parse (unpdf + LLM) -> cv_json, posting_json
         Browser -> /api/plan (LLM) -> questions[]
         Browser -> /api/tts (per question, parallel) -> audio blobs cached in memory

Live:    Browser mic -> Deepgram (direct WS, token from /api/deepgram-token)
         words (interim/final, start/end) -> zustand store
         heuristics.ts runs on each final word -> blunders[]
         composure.ts runs every 1000 ms -> effect level -> AwarenessOverlay
         on turn end -> /api/analyze (LLM) -> semantic blunders[] + answer_score

Persist: store flushes to Supabase at the end of each turn and at session end
End:     /api/summary -> summary pop-up; optional n8n webhook
```

## Token and cost control
- One LLM call per answer plus one plan call plus one summary call. Roughly 8 to 10 calls per session.
- Cap `max_tokens` on analysis at about 800.
- Cache TTS audio per question for the session.
- Verify current provider limits, free tiers and Vercel function duration for your plan before demo day. Set `export const maxDuration` on LLM routes.

## Things to verify against current docs before coding
- Deepgram temporary token endpoint and TTL, supported languages for Indonesian, and the exact query params for filler words and interim results.
- Vercel function duration limits for your plan.
- Browser autoplay rules: the first TTS must follow a user click (the green start button satisfies this).
