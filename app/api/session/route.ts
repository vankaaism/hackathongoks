import { z } from "zod";
import { saveLocalSession } from "@/lib/local-sessions";
import { database } from "@/lib/db";
import { documentsSchema, effectSchema, languageSchema, planSchema } from "@/lib/llm/schemas";
import { summarySchema } from "@/lib/llm/summary";

const time = z.number().int().nonnegative();
const question = z.number().int().min(0).max(6);
const mark = z.object({ question, startWord: z.number().int().min(-1), endWord: z.number().int().min(-1) });
const bounds = z.object({ startMs: time, endMs: time });
const word = bounds.extend({ text: z.string().min(1).max(450) });
const score = z.number().min(0).max(100);
const payload = documentsSchema.extend({
  id: z.uuid(),
  company: z.string().min(1).max(100),
  language: languageSchema,
  effect: effectSchema,
  plan: planSchema,
  startedAt: z.iso.datetime(),
  finalScore: score.int(),
  turns: z.array(bounds.extend({
    question, prompt: z.string().max(400), promptStart: time, promptEnd: time,
    focus: z.string().max(240), text: z.string().max(80_000), words: z.array(word).max(5000), score: score.int().nullable(),
  })).max(7),
  flags: z.array(mark.extend({
    startMs: time, endMs: time, category: z.enum(["Fluency", "Clarity", "Evidence", "Consistency", "Composure"]),
    type: z.string().min(1).max(40), severity: z.number().int().min(1).max(3), weight: z.number().int().min(1).max(3),
    explanation: z.string().max(450), suggestion: z.string().max(450), source: z.enum(["heuristic", "llm"]),
    status: z.enum(["open", "got_it", "dismissed"]),
  })).max(5000),
  scores: z.array(z.object({ time, score: score.int() })).max(1000),
  effects: z.array(z.object({ time, level: z.number().int().min(0).max(3), load: z.number().nonnegative() })).max(1000),
  marks: z.array(mark).max(1000),
  summary: summarySchema,
});

export async function POST(request: Request) {
  const session = payload.safeParse(await request.json().catch(() => null));
  if (!session.success) return Response.json({ saved: false }, { status: 400 });
  if (process.env.CERMIN_SESSION_STORAGE === "local" && !process.env.VERCEL) {
    try {
      await saveLocalSession(session.data);
      return Response.json({ saved: true });
    } catch (error) {
      console.warn("Could not save local session:", (error as NodeJS.ErrnoException).code);
      return Response.json({ saved: false }, { status: 500 });
    }
  }
  const db = database();
  if (!db) return Response.json({ saved: false }, { status: 503 });
  const { error } = await db.rpc("save_cermin_session", { p: session.data });
  if (error) {
    console.warn("Could not save session:", error.code);
    return Response.json({ saved: false }, { status: 502 });
  }
  return Response.json({ saved: true });
}
