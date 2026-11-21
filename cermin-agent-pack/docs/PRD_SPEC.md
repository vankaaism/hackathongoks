# PRD_SPEC.md: implementation spec (condensed from the full PRD)

## Goal
Give students a specific diagnosis of their interview weaknesses and make them aware of anxiety and hesitation while it happens.

## Layout
Three columns: Left 28% (transcript + feedback), Center 44% (interviewer), Right 28% (stats). Dark "night study room" theme. Below 1100 px collapse to tabs with the center always visible.

## User flow
1. Setup: upload CV PDF (under 5 MB), job posting PDF, company name, language (en/id), effect level (Off/Gentle/Full).
2. Parse PDFs to `cv_json` (roles, dates, skills, education) and `posting_json` (responsibilities, requirements).
3. LLM question plan: 7 questions: warm-up, 2 CV-grounded, 2 role-specific, 1 company-fit, 1 behavioral (STAR), closing. Each has `focus`.
4. Pre-generate TTS for all questions. Mic check.
5. Green button starts. Clock `t0` = end of first question audio.
6. Student answers; push-to-talk toggle or 4 s silence ends the turn.
7. Live: STT words stream into left panel; heuristic flags immediately; composure evaluated every 1 s.
8. Turn end: `/api/analyze` returns semantic flags and `answer_score`; character reacts; next question.
9. End: summary pop-up (overall score, top 3 weaknesses, 1 strength, 3 recommendations).
10. Review mode: click graph dots to jump to transcript span, "Mark for review" on selected text, Retry per question (stretch).

## Blunder taxonomy (weights live in `lib/config.ts`)

| Category | Flag | Detection | Method | Weight |
|----------|------|-----------|--------|--------|
| Fluency | Filler words (en: um, uh, like, you know; id: emm, eee, jadi, gitu, apa ya) | list + STT filler tokens | heuristic | 1 |
| Fluency | Long pause: gap over 3000 ms mid-answer, or first-word latency over 3000 ms | `next.start - prev.end` | heuristic | 2 |
| Fluency | Restart/stutter: repeated 1 to 3 word n-gram at sentence start | n-gram repeat | heuristic | 1 |
| Composure | Speech-rate spike: over 180 wpm in a trailing 10 s window | words per window | heuristic | 2 |
| Composure | Hedging stack: 3 or more hedges in one sentence | list | heuristic | 1 |
| Clarity | Rambling: over 120 s, or no point after 45 s | duration + LLM | hybrid | 2 |
| Clarity | Off-topic / question not answered | LLM | llm | 3 |
| Evidence | Vague claim with no example or number | LLM | llm | 2 |
| Consistency | Contradiction with CV (dates, roles, skills) | LLM + `cv_json` | llm | 3 |

Categories shown in the left-panel bottom bar: Fluency, Clarity, Evidence, Consistency, Composure. Each strip is red/amber/green with a count.

## Left panel behavior
- Turns with speaker label and timestamp. Interim words at 60% opacity until final.
- Underline colors by category, severity highlight (pink background) for weight 3.
- Click a flagged span: suggestion card with `what happened`, `why it matters`, `suggested rewrite or tactic`, buttons **Got it** / **Dismiss**, prev/next arrows. During live interview underline only, no auto-opening cards.
- "Next time" card after each answer, max 2 bullets.
- Text selection shows "Mark for review" which stores a `marked_span`.

## Center panel behavior
- Original flat vector character, 6 states: idle/listening, speaking (mouth driven by audio amplitude), thinking, positive, skeptical (side-eye, raised brow), concerned.
- Camera framing via scale/translate: wide at intro, close-up on hard question, mid while student speaks.
- Visual-novel dialogue box with typed-out question text synced to audio, name tag "Ms. Alina, HR Lead, {company}", one-line scene caption at start.
- Green round button bottom center = start / push-to-talk toggle. Mic level bar. Skip and Repeat. Progress dots.

## Right panel behavior
- Area graph: x = session time, y = Interview Performance Score 0 to 100, smoothed every 10 s.
- Dots by severity: red (3), orange (2), blue (1), green = great moment or recovery. Vertical playhead.
- Blunder card (chess.com style): title, one-line explanation, score impact (e.g. "-4 pts"), buttons Retry / Best / Next.
- Event list rows: `mm:ss  Label xN  (Qn)` with category icon. Also logs effect-level changes.
- Tabs: Live, Review, Details (per-category scores + formula text), History (stretch).
- Tiles: filler rate/min, average pause, words/min, blunders per answer.

## Scoring
- Live score: `100 - clamp(sum(weight * decay(age)) * 4, 0, 100)`, half-life 60 s.
- Final score: `100 - clamp((total_weighted_blunders / minutes_spoken) * 6, 0, 100)`.

## Awareness Effect
Composure Load (CL) = sum of blunder weights in last 45 s, each decaying linearly to 0 over the window.

| Level | CL | Effect | Copy |
|-------|----|--------|------|
| 0 | below 3 | none | none |
| 1 | 3 to 5.9 | soft red vignette 15%; graph pulses once | none |
| 2 | 6 to 9.9 | side panels blur 4 px + dim to 70%; vignette 30% with 1 Hz pulse; character Concerned | cause-specific toast, e.g. "You're speeding up. Slow down." / "Long pauses piling up. Breathe, then answer." |
| 3 | 10 or more | center stays sharp, all else blur 8 px + dim to 50%; breathing circle (4 s in, 4 s out); interviewer pauses | "Take a beat. Breathe with the circle. Then continue." |

Rules: never obscure interviewer or dialogue box; escalate immediately, de-escalate only after CL stays below the lower threshold for 8 s; recovery to level 0 gives a brief green flash and a green graph dot; Off / Gentle (levels 1 and 2 without blur) / Full; 10 s first-run explainer; `prefers-reduced-motion` gives static vignette, no pulse; log every level change to `effect_events`.

Gentle mode default for first session.

## Timestamps
All times are integer ms since `t0`. Deepgram word `start`/`end` are seconds relative to stream start: convert to ms and add the stream-start offset to align with `t0`. Every blunder stores `start_ms`, `end_ms`, `word_start_idx`, `word_end_idx`.

## Acceptance for the demo path (must pass)
1. Upload seeded CV + posting, type a company, get 7 questions in under 45 s.
2. Speak an answer: words appear in under 1.5 s.
3. Say 4 fillers and pause 4 s: underlines appear, graph dot appears, effect reaches level 1 or 2.
4. Contradict a CV date: after the answer ends, a Consistency flag with explanation appears and the character shows Skeptical.
5. Recover with calm speech: effect returns to level 0 with the green flash.
6. Finish: summary pop-up shows score, 3 weaknesses, 1 strength, 3 recommendations.
7. Click a red graph dot: transcript scrolls to and highlights the span (stretch if not done).
8. Fallback replay of the 90 s recorded session works with no mic or network.

## Out of scope
Video/face analysis, accent scoring, hiring prediction, native apps, employer features, mixed-language sessions.
