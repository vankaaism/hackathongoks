import { z } from "zod";

const completion = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
});

export async function generateJson<T>(schema: z.ZodType<T>, system: string, data: unknown): Promise<T> {
  const { LLM_BASE_URL, LLM_MODEL, LLM_API_KEY } = process.env;
  if (!LLM_BASE_URL || !LLM_MODEL || !LLM_API_KEY) throw new Error("LLM is not configured");
  const endpoint = LLM_BASE_URL.replace(/\/$/, "") + "/chat/completions";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${LLM_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: LLM_MODEL,
        temperature: 0.2,
        max_tokens: 2500,
        messages: [
          { role: "system", content: system + (attempt ? "\nYour previous output was invalid. Follow the supplied schema exactly." : "") },
          { role: "user", content: JSON.stringify(data) },
        ],
        response_format: { type: "json_object" },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(14_000),
    });
    if (!response.ok) throw new Error(`LLM returned HTTP ${response.status}`);
    const result = completion.safeParse(await response.json());
    if (!result.success) continue;
    const content = result.data.choices[0].message.content.trim().replace(/^\`\`\`(?:json)?\s*|\s*\`\`\`$/gi, "");
    try { return schema.parse(JSON.parse(content)); } catch { /* Retry malformed output once. */ }
  }
  throw new Error("LLM did not return valid JSON");
}
