import { z } from "zod";

const input = z.object({ text: z.string().trim().min(1).max(400) });
export const maxDuration = 15;

export async function POST(request: Request) {
  const speech = input.safeParse(await request.json().catch(() => null));
  if (!speech.success) return new Response(null, { status: 400 });
  const { ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID } = process.env;
  if (!ELEVENLABS_API_KEY || !ELEVENLABS_VOICE_ID) return new Response(null, { status: 503 });

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(ELEVENLABS_VOICE_ID)}?output_format=mp3_44100_64`, {
      method: "POST",
      headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ text: speech.data.text, model_id: "eleven_multilingual_v2" }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      console.warn("Speech provider returned HTTP", response.status);
      return new Response(null, { status: 502 });
    }
    return new Response(response.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch {
    return new Response(null, { status: 502 });
  }
}
