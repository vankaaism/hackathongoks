import recorded from "../seed/session.json";
import { categories, detectFlags, type Flag } from "./analyzers/heuristics";
import { interview } from "./config";
import type { PreparedSession, Turn } from "./store";
import type { Plan } from "./llm/schemas";

const questionTypes = ["warmup", "cv", "role"] as const;
const questions: Plan["questions"] = recorded.turns.map((turn, i) => ({
  type: questionTypes[i], text: turn.question, focus: turn.focus,
}));

const turns: Turn[] = recorded.turns.map((turn, question) => ({
  question, promptStart: turn.promptStart, promptEnd: turn.promptEnd,
  words: turn.chunks.flatMap(chunk => chunk.text.split(" ").map((text, index) => ({
    text, startMs: chunk.at + index * chunk.interval,
    endMs: chunk.at + index * chunk.interval + Math.round(chunk.interval * .75),
    isFinal: true,
  }))),
}));

const flags = turns.flatMap(turn => detectFlags(turn.words, turn.question, "id", turn.promptEnd, turn.words.at(-1)?.endMs ?? 0));
const correction = turns[1].words.findIndex(word => word.text === "Februari");
const type = "cv_contradiction";
const semantic: Flag = {
  question: 1, startWord: correction, endWord: correction + 1,
  startMs: turns[1].words[correction].startMs, endMs: turns[1].words[correction + 1].endMs,
  type, category: categories[type], severity: 3, weight: interview.weights[type], source: "llm",
  explanation: "Jawaban menyebut Februari 2022. CV mencatat awal magang pada Februari 2025.",
  suggestion: "Sebutkan Februari 2025, lalu jelaskan satu tanggung jawab Anda selama magang.",
};

const session: PreparedSession = {
  id: "replay", company: recorded.company, language: "id", effect: "full",
  startedAt: "2026-11-21T00:00:00.000Z",
  documents: {
    cv: { name: "Rania Putri", education: [], experience: [], skills: [], projects: [] },
    posting: { role: "Management Trainee", responsibilities: [], requirements: [], nice_to_have: [] },
  },
  plan: { questions, scene_caption: recorded.scene, closing: recorded.closing },
  audio: [],
};

export const seedReplay = {
  session, durationMs: recorded.durationMs, turns,
  flags: [...flags, semantic].sort((a, b) => a.endMs - b.endMs),
};
