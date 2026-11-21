# BUILD_PLAN.md

Execute phase by phase. After each phase, run the check and report. Do not start the next phase until the check passes. Stretch items only after Phase 6.

## Phase 0: Scaffold (about 1 h)
- `pnpm create next-app` (TS, Tailwind, App Router), add shadcn/ui, zustand, motion, recharts, zod, vitest, unpdf, `@anthropic-ai/sdk`, `@supabase/supabase-js`.
- Create folder layout from `AGENTS.md`, `lib/config.ts` with all thresholds and weights, `.env.local`.
- Static 3-panel layout with dark theme and placeholder content.
- Check: `pnpm dev` shows the three columns at the right proportions; `pnpm typecheck` clean.

## Phase 1: Setup + parse + plan (about 3 h)
- Landing form: two PDF inputs, company name, language, effect level.
- `/api/parse` with unpdf then LLM (PROMPTS.md #1); paste-text fallback if extracted text is under 200 chars.
- `/api/plan` (PROMPTS.md #2); `/api/tts` per question, called in parallel; in-memory audio cache.
- Check: seeded CV + posting + company gives 7 questions and audio in under 45 s.

## Phase 2: Live speech + transcript (about 4 h)
- `/api/deepgram-token`; `lib/stt/deepgramClient.ts` streaming 16 kHz mono audio, interim + final words with timestamps.
- Zustand store: turns, words (with `is_final`), session clock `t0`.
- LeftTranscript renders turns with interim opacity.
- Mic level bar, push-to-talk green button, 4 s silence auto end.
- Check: speak a sentence, words appear in under 1.5 s with correct timestamps; log shows ms since `t0`.

## Phase 3: Heuristics + composure + effect (about 4 h)
- `lib/analyzers/heuristics.ts` (filler, long pause, restart, rate spike, hedging) with Vitest tests using synthetic word arrays.
- `lib/analyzers/composure.ts`: CL over 45 s with linear decay, level thresholds, 8 s hysteresis. Unit-test escalation and de-escalation.
- `AwarenessOverlay` with levels 1 to 3, Off/Gentle/Full, reduced-motion handling, breathing circle.
- Underlines in the left panel; effect events logged.
- Check: scripted words (4 fillers + 4 s pause) reach level 1 or 2; calm speech returns to 0 with green flash; the interviewer and dialogue box are never blurred.

## Phase 4: Character + center stage (about 4 h)
- Layered SVG interviewer, 4 states first (idle, speaking, skeptical, concerned), then positive and thinking.
- Amplitude-driven mouth during TTS, dialogue box typed-out text synced to audio, name tag and scene caption, progress dots, Skip/Repeat.
- Check: all questions play in order; states switch on events; the dialogue text matches the audio.

## Phase 5: LLM analysis + right panel (about 5 h)
- `/api/analyze` with Zod validation and index checks; run at turn end while the next question audio plays.
- Merge semantic flags into the store; the skeptical state triggers on Consistency or vague-claim flags.
- Right panel: Recharts area graph (score over time, smoothed 10 s), severity-colored dots, vertical playhead, blunder card, event list, tiles, tabs (Live, Review, Details).
- Left panel: suggestion card with Got it / Dismiss / prev / next, category bottom bar, "Next time" card.
- Check: a contradicted CV date produces a Consistency flag with a correct span; the graph dot and event row exist for it.

## Phase 6: Summary + persistence + deploy (about 4 h)
- `/api/summary`; summary pop-up; "Mark for review" on text selection.
- Persist to Supabase (schema in `docs/DATA_MODEL.sql`); session end writes score points and effect events.
- Fallback replay mode: load `seed/session.json` and play through the UI with no mic or network.
- Deploy to Vercel, set env vars, test on the demo laptop and venue network.
- Check: run the full demo path in `docs/PRD_SPEC.md` (acceptance items 1 to 6 and 8).

## MVP complete here. Feature freeze.

## Stretch (priority order)
1. Click graph dot to jump to transcript span and the reverse (acceptance item 7).
2. Retry and Best buttons (PROMPTS.md #5).
3. Adaptive follow-up question after a vague or inconsistent answer.
4. Camera framing changes.
5. History tab and per-user speech-rate calibration.
6. n8n webhook plus CDC aggregate Google Sheet (see `docs/TECH_STACK.md`).
7. Counselor read-only share page.
8. Hands-free voice activity detection.

## Risk drills (do before demo)
- Kill the network mid-session: confirm replay fallback works.
- Mic denied: confirm the Web Speech API fallback or a clear error.
- Scanned PDF: confirm paste-text fallback.
- Run `break-ui` skill against the transcript and event list with a 3-minute Indonesian answer, emoji, very long words and zero blunders.
- Run `review-animations` on the Awareness Effect before the final deploy.
