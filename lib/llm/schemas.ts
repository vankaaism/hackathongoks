import { z } from "zod";

const optionalText = z.string().nullable();
const textList = z.array(z.string());

export const documentsSchema = z.object({
  cv: z.object({
    name: optionalText,
    education: z.array(z.object({ school: optionalText, degree: optionalText, start: optionalText, end: optionalText })),
    experience: z.array(z.object({
      org: optionalText, role: optionalText, start: optionalText, end: optionalText,
      duration_months: z.number().int().nonnegative().nullable(), highlights: textList,
    })),
    skills: textList,
    projects: z.array(z.object({ name: optionalText, summary: optionalText })),
  }),
  posting: z.object({
    role: optionalText, responsibilities: textList, requirements: textList, nice_to_have: textList,
  }),
});

export const languageSchema = z.enum(["en", "id"]);
export const effectSchema = z.enum(["off", "gentle", "full"]);
export const planInput = documentsSchema.extend({
  company: z.string().trim().min(1).max(100),
  language: languageSchema,
});
const questionTypes = ["warmup", "cv", "cv", "role", "role", "company", "behavioral"] as const;

export const planSchema = z.object({
  scene_caption: z.string().min(1).max(200),
  questions: z.array(z.object({
    type: z.enum(["warmup", "cv", "role", "company", "behavioral"]),
    text: z.string().trim().min(1).max(400).refine(text => text.split(/\s+/).length < 35),
    focus: z.string().min(1).max(240),
  })).length(questionTypes.length).refine(items => items.every((item, i) => item.type === questionTypes[i])),
  closing: z.string().min(1).max(240),
});

export type Documents = z.infer<typeof documentsSchema>;
export type Plan = z.infer<typeof planSchema>;
export type Language = z.infer<typeof languageSchema>;
export type Effect = z.infer<typeof effectSchema>;
