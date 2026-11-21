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
    text, startMs: chunk.at + chunk.timing[index][0],
    endMs: chunk.at + chunk.timing[index][1],
    isFinal: true,
  }))),
}));

const flags = turns.flatMap(turn => detectFlags(turn.words, turn.question, "id", turn.promptEnd, turn.words.at(-1)?.endMs ?? 0))
  .map(flag => {
    const feedback = {
      filler: ["Kata pengisi memutus alur kalimat tanpa menambah makna.", "Coba ambil jeda singkat sebelum melanjutkan."],
      long_pause: ["Jeda lebih dari tiga detik membuat jawaban terasa terputus.", "Sampaikan inti jawaban dulu, lalu ambil napas."],
      rate_spike: ["Kecepatan bicara melonjak dalam sepuluh detik terakhir.", "Pisahkan langkah-langkah dengan jeda pendek."],
      hedging: ["Kata “mungkin” berulang sehingga urutan tindakan terdengar kurang tegas.", "Mulai dengan tindakan pertama yang akan dilakukan."],
    }[flag.type as "filler" | "long_pause" | "rate_spike" | "hedging"];
    if (!feedback) return flag;
    const startWord = flag.type === "rate_spike" ? Math.max(flag.startWord, flag.endWord - 4) : flag.startWord;
    const endWord = flag.type === "hedging" ? Math.min(flag.startWord + 2, flag.endWord) : flag.endWord;
    return { ...flag, startWord, endWord, explanation: feedback[0], suggestion: feedback[1] };
  });

function recordedFeedback(question: number, type: Flag["type"], from: string, through: string, explanation: string, suggestion: string): Flag {
  const words = turns[question].words;
  const startWord = words.findIndex(word => word.text === from);
  const endWord = words.findIndex((word, index) => index >= startWord && word.text === through);
  return {
    question, startWord, endWord, startMs: words[startWord].startMs, endMs: words[endWord].endMs,
    type, category: categories[type], weight: interview.weights[type], severity: interview.weights[type],
    source: "llm", explanation, suggestion,
  };
}
const semantic = [
  recordedFeedback(0, "vague_claim", "sering", "penting.", "“Laporan penting” belum menjelaskan apa yang dikerjakan atau hasilnya.", "Sebutkan jenis laporan, jumlah toko, dan manfaatnya."),
  recordedFeedback(0, "off_topic", "Kantin", "Jumat.", "Cerita tentang menu kantin tidak membantu menjawab pertanyaan tentang pengalaman yang relevan.", "Gunakan waktu ini untuk menjelaskan tanggung jawab saat magang."),
  recordedFeedback(1, "cv_contradiction", "Februari", "2022", "Jawaban menyebut Februari 2022. CV mencatat awal magang pada Februari 2025.", "Sebutkan Februari 2025, lalu jelaskan satu tanggung jawab selama magang."),
];

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
  session, durationMs: recorded.durationMs, closingStart: recorded.closingStart, turns,
  flags: [...flags, ...semantic].sort((a, b) => a.endMs - b.endMs),
};
