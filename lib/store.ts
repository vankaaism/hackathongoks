import type { TranscriptWord } from "./stt/deepgramClient";
import type { Analysis } from "./llm/coaching";
import { detectFlags, type Flag } from "./analyzers/heuristics";
import { evaluateComposure, initialComposure, type Composure, type Level } from "./analyzers/composure";
import { liveScore } from "./scoring";
import { interview } from "./config";
import { create } from "zustand";
import type { Documents, Effect, Language, Plan } from "./llm/schemas";

export type PreparedSession = {
  id: string;
  company: string;
  language: Language;
  effect: Effect;
  documents: Documents;
  plan: Plan;
  audio: (Blob | null)[];
  startedAt: string;
};

export type Turn = { question: number; words: TranscriptWord[]; promptStart: number; promptEnd: number };
export type Mark = { question: number; startWord: number; endWord: number };
export type EffectEvent = { time: number; level: Level; load: number };
export type ScorePoint = { time: number; score: number };

export const useSession = create<{
  session: PreparedSession | null;
  turns: Turn[];
  current: Turn | null;
  interim: TranscriptWord[];
  analyses: Record<number, Analysis>;
  saveAnalysis: (id: string, question: number, analysis: Analysis, semantic: Flag[]) => void;
  flagStatus: Record<string, "got_it" | "dismissed">;
  setFlagStatus: (id: string, status: "got_it" | "dismissed") => void;
  flags: Flag[];
  liveFlags: Flag[];
  composure: Composure;
  effects: EffectEvent[];
  scores: ScorePoint[];
  updateDelivery: (now: number, startedMs: number | null) => void;
  prepare: (session: PreparedSession) => void;
  beginTurn: (question: number, promptStart: number, promptEnd: number) => void;
  marks: Mark[];
  markSpan: (mark: Mark) => void;
  appendWords: (words: TranscriptWord[], final: boolean) => void;
  commitTurn: () => void;
}>(set => ({
  session: null, turns: [], current: null, interim: [], marks: [],
  markSpan: mark => set(state => state.marks.some(item => item.question === mark.question && item.startWord === mark.startWord && item.endWord === mark.endWord)
    ? {} : { marks: [...state.marks, mark] }),
  analyses: {}, flagStatus: {},
  saveAnalysis: (id, question, analysis, semantic) => set(state => {
    if (state.session?.id !== id) return {};
    const prior = state.flags.filter(flag => flag.question !== question || flag.source !== "llm");
    return { analyses: { ...state.analyses, [question]: analysis }, flags: [...prior, ...semantic] };
  }),
  setFlagStatus: (id, status) => set(state => ({ flagStatus: { ...state.flagStatus, [id]: status } })),
  flags: [], liveFlags: [], composure: initialComposure, effects: [], scores: [],
  prepare: session => set({
    session, turns: [], current: null, interim: [], marks: [], analyses: {}, flagStatus: {}, flags: [], liveFlags: [],
    composure: initialComposure, effects: [], scores: [],
  }),
  updateDelivery: (now, startedMs) => set(state => {
    if (!state.session) return {};
    const liveFlags = state.current && startedMs !== null
      ? detectFlags(state.current.words, state.current.question, state.session.language, startedMs, now)
      : state.liveFlags;
    const flags = [...state.flags, ...liveFlags];
    const composure = evaluateComposure(state.composure, flags, now);
    const effects = composure.level === state.composure.level ? state.effects : [...state.effects, {
      time: now, level: composure.level, load: composure.load,
    }];
    const previous = state.scores.at(-1);
    const scores = !previous || now - previous.time >= interview.scoreSmoothingMs
      ? [...state.scores, { time: now, score: liveScore(flags, now) }] : state.scores;
    return { liveFlags, composure, effects, scores };
  }),
  beginTurn: (question, promptStart, promptEnd) => set({ current: { question, words: [], promptStart, promptEnd }, interim: [] }),
  appendWords: (words, final) => set(state => {
    if (!state.current) return {};
    if (!final) return { interim: words };
    return { current: { ...state.current, words: [...state.current.words, ...words] }, interim: [] };
  }),
  commitTurn: () => set(state => state.current
    ? { turns: [...state.turns, state.current], current: null, interim: [], flags: [...state.flags, ...state.liveFlags], liveFlags: [] }
    : {}),
}));
