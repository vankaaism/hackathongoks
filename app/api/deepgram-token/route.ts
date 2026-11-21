import { z } from "zod";

const grant = z.object({ access_token: z.string().min(1), expires_in: z.number().positive() });
export async function POST(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return new Response(null, { status: 403 });
  const secret = process.env.DEEPGRAM_API_KEY;
  if (!secret) return new Response(null, { status: 503 });
  try {
    const response = await fetch("https://api.deepgram.com/v1/auth/grant", {
      method: "POST",
      headers: { Authorization: `Token ${secret}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      console.warn("Speech token provider returned HTTP", response.status);
      return new Response(null, { status: 502 });
    }
    const token = grant.parse(await response.json());
    return Response.json(token, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return new Response(null, { status: 502 });
  }
}
