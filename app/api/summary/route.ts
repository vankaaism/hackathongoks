import { generateJson } from "@/lib/llm/gateway";
import { practiceSummary, summaryInput, summarySchema } from "@/lib/llm/summary";

export const maxDuration = 35;

export async function POST(request: Request) {
  const input = summaryInput.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: "Invalid session summary data." }, { status: 400 });
  if (!input.data.flags.length && !input.data.answerScores.length) return Response.json(practiceSummary(input.data));
  try {
    return Response.json(await generateJson(summarySchema,
      "Summarize a practice interview. Use the supplied counts, ranked flags, answer scores and strengths only as data. Return JSON {top_weaknesses:[{category,evidence,tip}],strength,recommendations:[...]}, with exactly three weaknesses, one strength and three recommendations. Use the requested language. Cite concrete patterns when available. For categories with no observed issue, phrase it explicitly as a practice opportunity and never invent evidence. Make every recommendation actionable.",
      input.data));
  } catch {
    return Response.json(practiceSummary(input.data));
  }
}
