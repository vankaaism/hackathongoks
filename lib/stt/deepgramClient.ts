import { z } from "zod";
import { interview } from "../config";
import type { Language } from "../llm/schemas";

const tokenSchema = z.object({ access_token: z.string() });
const resultSchema = z.object({
  type: z.literal("Results"),
  is_final: z.boolean(),
  channel: z.object({ alternatives: z.array(z.object({
    words: z.array(z.object({
      word: z.string(), punctuated_word: z.string().optional(),
      start: z.number().nonnegative(), end: z.number().nonnegative(),
    })),
  })) }),
});

export type TranscriptWord = { text: string; startMs: number; endMs: number; isFinal: boolean };

export async function startTranscription(options: {
  language: Language;
  clock: () => number;
  onWords: (words: TranscriptWord[], final: boolean) => void;
  onLevel: (level: number) => void;
  onSilence: () => void;
  onFailure: () => void;
}) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  let context: AudioContext | undefined;
  let socket: WebSocket | undefined;
  let capture: AudioWorkletNode | undefined;
  let finishing: Promise<void> | undefined;
  let canceled = false;
  let settle: (() => void) | undefined;

  function releaseAudio() {
    stream.getTracks().forEach(track => track.stop());
    capture?.disconnect();
    if (context?.state !== "closed") void context?.close().catch(() => {});
    options.onLevel(0);
  }
  function cancel() {
    canceled = true;
    releaseAudio();
    socket?.close();
    settle?.();
  }

  try {
    context = new AudioContext({ sampleRate: 16_000 });
    await context.resume();
    await context.audioWorklet.addModule("/pcm-capture.js");
    const response = await fetch("/api/deepgram-token", { method: "POST" });
    if (!response.ok) throw new Error("Speech service could not connect.");
    const { access_token } = tokenSchema.parse(await response.json());
    const params = new URLSearchParams({
      model: "nova-3", language: options.language, encoding: "linear16", sample_rate: "16000", channels: "1",
      punctuate: "true", interim_results: "true", endpointing: "300",
    });
    if (options.language === "en") params.set("filler_words", "true");
    const connection = new WebSocket("wss://api.deepgram.com/v1/listen?" + params, ["bearer", access_token]);
    socket = connection;
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("Speech connection timed out.")), 5000);
      connection.addEventListener("open", () => { clearTimeout(timeout); resolve(); }, { once: true });
      connection.addEventListener("error", () => { clearTimeout(timeout); reject(new Error("Speech service could not connect.")); }, { once: true });
    });

    let streamOffset: number | undefined;
    let lastSpeech = performance.now();
    let silenceSent = false;
    capture = new AudioWorkletNode(context, "pcm-capture", { channelCount: 1, channelCountMode: "explicit" });
    const muted = context.createGain();
    muted.gain.value = 0;
    context.createMediaStreamSource(stream).connect(capture).connect(muted).connect(context.destination);

    capture.port.onmessage = ({ data }: MessageEvent<{ pcm: ArrayBuffer; peak: number }>) => {
      if (canceled || finishing || connection.readyState !== WebSocket.OPEN) return;
      if (streamOffset === undefined) streamOffset = Math.max(0, options.clock() - 40);
      const now = performance.now();
      if (data.peak > 0.035) lastSpeech = now;
      options.onLevel(Math.min(1, data.peak * 3));
      connection.send(data.pcm);
      if (!silenceSent && now - lastSpeech >= interview.silenceMs) {
        silenceSent = true;
        options.onSilence();
      }
    };

    connection.onmessage = ({ data }) => {
      if (canceled || typeof data !== "string") return;
      let message: unknown;
      try { message = JSON.parse(data); } catch { return; }
      const result = resultSchema.safeParse(message);
      if (!result.success) return;
      const offset = streamOffset ?? 0;
      const final = result.data.is_final;
      const words = result.data.channel.alternatives[0]?.words.map(word => ({
        text: word.punctuated_word ?? word.word,
        startMs: Math.round(word.start * 1000) + offset,
        endMs: Math.round(word.end * 1000) + offset,
        isFinal: final,
      })) ?? [];
      options.onWords(words, final);
    };
    connection.onclose = () => {
      if (finishing) settle?.();
      else if (!canceled) { cancel(); options.onFailure(); }
    };

    return {
      cancel,
      finish() {
        if (finishing) return finishing;
        releaseAudio();
        finishing = new Promise<void>(resolve => {
          const timer = window.setTimeout(() => { connection.close(); resolve(); }, 2000);
          settle = () => { clearTimeout(timer); resolve(); };
        });
        if (connection.readyState === WebSocket.OPEN) connection.send(JSON.stringify({ type: "CloseStream" }));
        else settle?.();
        return finishing;
      },
    };
  } catch (error) {
    cancel();
    throw error;
  }
}
