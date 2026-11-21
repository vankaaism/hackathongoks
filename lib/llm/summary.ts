import { z } from "zod";
import { languageSchema } from "./schemas";

const line = z.string().trim().min(1).max(400);
export const summarySchema = z.object({
  top_weaknesses: z.array(z.object({ category: line, evidence: line, tip: line })).length(3),
  strength: line,
  recommendations: z.array(line).length(3),
});
export type Summary = z.infer<typeof summarySchema>;

export const summaryInput = z.object({
  language: languageSchema,
  score: z.number().int().min(0).max(100),
  counts: z.record(z.string(), z.number().int().nonnegative()),
  flags: z.array(z.object({ category: line, explanation: line, suggestion: z.string().max(450) })).max(5),
  strengths: z.array(z.string().max(450)).max(7),
  answerScores: z.array(z.number().min(0).max(100)).max(7),
});

export function practiceSummary(input: z.infer<typeof summaryInput>): Summary {
  const points = input.language === "id"
    ? [
        { category: "Kelancaran", evidence: "Perhatikan bagian yang terputus oleh jeda atau kata pengisi.", tip: "Berhenti sejenak, lalu selesaikan satu kalimat." },
        { category: "Bukti", evidence: "Cari kesempatan untuk memperjelas kontribusi Anda.", tip: "Sebutkan satu tindakan dan hasilnya." },
        { category: "Kejelasan", evidence: "Periksa apakah inti jawaban muncul di awal.", tip: "Sampaikan inti jawaban sebelum memberi konteks." },
      ]
    : [
        { category: "Fluency", evidence: "Review where long pauses or filler words interrupt your answer.", tip: "Take a short breath and finish one sentence at a time." },
        { category: "Evidence", evidence: "Look for places where you could make your contribution more specific.", tip: "Name one action and its result." },
        { category: "Clarity", evidence: "Check whether the main point appears early in each answer.", tip: "Give your main point before adding context." },
      ];
  const observed = input.flags.filter((item, i, all) => all.findIndex(flag => flag.category === item.category) === i).slice(0, 3)
    .map(item => ({ category: item.category, evidence: item.explanation.slice(0, 400), tip: (item.suggestion || points[0].tip).slice(0, 400) }));
  const topics = [...observed, ...points.filter(item => !observed.some(existing => existing.category === item.category))].slice(0, 3);
  return {
    top_weaknesses: topics,
    strength: input.strengths.find(Boolean)?.slice(0, 400) ?? (input.language === "id"
      ? "Anda sudah mengikuti sesi latihan dan dapat meninjau jawabannya."
      : "You completed a practice run and can review your answers."),
    recommendations: topics.map(item => item.tip),
  };
}
