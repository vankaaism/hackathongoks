import { interview } from "../config";
import type { Language } from "../llm/schemas";
import type { TranscriptWord } from "../stt/deepgramClient";

export type FlagType = keyof typeof interview.weights;
export type Category = "Fluency" | "Clarity" | "Evidence" | "Consistency" | "Composure";
export type Flag = {
  type: FlagType;
  category: Category;
  question: number;
  startMs: number;
  endMs: number;
  startWord: number;
  endWord: number;
  weight: number;
  severity?: number;
  source?: "heuristic" | "llm";
  explanation: string;
  suggestion: string;
};

export const categories = {
  filler: "Fluency", long_pause: "Fluency", restart: "Fluency",
  rate_spike: "Composure", hedging: "Composure",
  rambling: "Clarity", off_topic: "Clarity", vague_claim: "Evidence", cv_contradiction: "Consistency",
} as const;

export const flagLabels: Record<FlagType, string> = {
  filler: "Filler word", long_pause: "Long pause", restart: "Repeated start",
  rate_spike: "Fast speech", hedging: "Hesitant wording", rambling: "Long answer",
  off_topic: "Off topic", vague_claim: "Vague claim", cv_contradiction: "CV inconsistency",
};

const phrases = {
  en: { filler: ["um", "uh", "like", "you know"], hedge: ["maybe", "i think", "sort of", "kind of", "probably", "i guess"] },
  id: { filler: ["emm", "em", "hmm", "eee", "ee", "jadi", "gitu", "apa ya"], hedge: ["mungkin", "kayaknya", "sepertinya", "kira kira", "kurang lebih", "saya rasa"] },
};

const tactics: Partial<Record<FlagType, string>> = {
  filler: "Take a short silent breath before continuing.",
  long_pause: "Start with a one-sentence answer, then add the details.",
  restart: "Pause briefly and begin the sentence once.",
  rate_spike: "Slow down at the end of each thought.",
  hedging: "State your point directly and give an example.",
  rambling: "Lead with your point and use one specific example.",
};

export function detectFlags(words: TranscriptWord[], question: number, language: Language, startedMs: number, now: number): Flag[] {
  const normalized = words.map(word => word.text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim());
  const flags: Flag[] = [];
  let sentenceStart = 0;
  let hedges = 0;
  let rateStart = 0;
  let fast = false;
  let lastFiller = -1;
  let lastHedge = -1;

  function add(type: FlagType, startWord: number, endWord: number, startMs?: number, endMs?: number) {
    flags.push({
      type, category: categories[type], question, startWord, endWord, source: "heuristic",
      startMs: startMs ?? words[startWord].startMs, endMs: endMs ?? words[endWord].endMs,
      weight: interview.weights[type], explanation: flagLabels[type], suggestion: tactics[type] ?? "",
    });
  }
  function match(list: string[], index: number) {
    return list.find(phrase => {
      const parts = phrase.split(" ");
      return parts.every((part, offset) => normalized[index + offset] === part);
    })?.split(" ").length ?? 0;
  }

  for (const [i, word] of words.entries()) {
    const filler = match(phrases[language].filler, i);
    if (filler && i > lastFiller) {
      lastFiller = i + filler - 1;
      add("filler", i, lastFiller);
    }
    const hedge = match(phrases[language].hedge, i);
    if (hedge && i > lastHedge) {
      lastHedge = i + hedge - 1;
      hedges += 1;
      if (hedges === interview.hedgesPerSentence) add("hedging", sentenceStart, lastHedge);
    }
    const prev = words[i - 1]?.endMs ?? startedMs;
    if (word.startMs - prev > interview.longPauseMs) {
      add("long_pause", Math.max(0, i - 1), Math.max(0, i - 1), prev, prev + interview.longPauseMs);
    }

    if (i === sentenceStart) {
      for (let size = interview.restartMaxWords; size > 0; size -= 1) {
        const first = normalized.slice(i, i + size);
        const second = normalized.slice(i + size, i + size * 2);
        if (second.length === size && first.every((text, j) => text && text === second[j])) {
          add("restart", i, i + size * 2 - 1);
          break;
        }
      }
    }
    if (/[.!?]$/.test(word.text)) { sentenceStart = i + 1; hedges = 0; }

    while (words[rateStart].endMs <= word.endMs - interview.speechRateWindowMs) rateStart += 1;
    const wpm = (i - rateStart + 1) * 60_000 / interview.speechRateWindowMs;
    if (wpm > interview.speechRateThreshold && !fast) add("rate_spike", rateStart, i);
    fast = wpm > interview.speechRateThreshold;
  }

  const last = words.at(-1);
  const boundary = last?.endMs ?? startedMs;
  if (now - boundary > interview.longPauseMs) {
    const index = words.length - 1;
    add("long_pause", index, index, boundary, boundary + interview.longPauseMs);
  }
  if (last && last.endMs - startedMs > interview.ramblingMs) add("rambling", 0, words.length - 1);
  return flags;
}

export function flagKey(flag: Flag) {
  return [flag.question, flag.type, flag.startMs, flag.startWord, flag.endWord].join(":");
}
