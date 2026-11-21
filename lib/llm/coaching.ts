import { z } from "zod";
import { documentsSchema, languageSchema } from "./schemas";

export const semanticType = z.enum(["off_topic", "rambling", "vague_claim", "cv_contradiction"]);
const word = z.object({ i: z.number().int().nonnegative(), text: z.string().min(1).max(400) });
export const analysisInput = documentsSchema.extend({
  question: z.string().max(400),
  focus: z.string().max(240),
  language: languageSchema,
  words: z.array(word).min(1).max(1800).refine(words => words.every((item, index) => item.i === index)),
});

export const semanticFlag = z.object({
  category: z.enum(["Clarity", "Evidence", "Consistency"]),
  type: semanticType,
  severity: z.number().int().min(1).max(3),
  start_word: z.number().int().nonnegative(),
  end_word: z.number().int().nonnegative(),
  explanation: z.string().trim().min(1).max(450),
  suggestion: z.string().trim().min(1).max(450),
});
export const rawAnalysis = z.object({
  answer_score: z.number().min(0).max(100),
  flags: z.array(z.unknown()).max(20),
  strength: z.string().max(450),
  next_time: z.array(z.string().max(450)).max(2),
});

export const analysisResult = rawAnalysis.extend({ flags: z.array(semanticFlag).max(4) });
export type Analysis = z.infer<typeof analysisResult>;
