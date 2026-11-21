"use client";

import { useEffect, useRef, useState } from "react";
import { analysisResult } from "../llm/coaching";
import { interview } from "../config";
import { useSession } from "../store";
import type { PreparedSession } from "../store";
import { startTranscription } from "./deepgramClient";

type Stream = Awaited<ReturnType<typeof startTranscription>>;

export function useInterviewAudio(session: PreparedSession | null) {
  const [phase, setPhase] = useState<"ready" | "playing" | "answer" | "connecting" | "listening" | "finishing" | "breathing" | "complete">("ready");
  const [pending, setPending] = useState(0);
  const [index, setIndex] = useState(0);
  const [level, setLevel] = useState(0);
  const [playback, setPlayback] = useState({ characters: 0, amplitude: 0 });
  const [error, setError] = useState("");
  const origin = useRef<number | null>(null);
  const started = useRef<number | null>(null);
  const active = useRef<Stream | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const url = useRef<string | null>(null);
  const stopPlayback = useRef<(() => void) | null>(null);
  const disposed = useRef(false);

  useEffect(() => {
    disposed.current = false;
    return () => {
      disposed.current = true;
      active.current?.cancel();
      stopPlayback.current?.();
      player.current?.pause();
      if (url.current) URL.revokeObjectURL(url.current);
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    if (!session || phase === "complete") return;
    const timer = window.setInterval(() => {
      if (origin.current !== null) useSession.getState().updateDelivery(clock(), started.current);
    }, interview.composureTickMs);
    return () => clearInterval(timer);
  }, [phase, session]);

  function clock() {
    return origin.current === null ? 0 : Math.max(0, Math.round(performance.now() - origin.current));
  }

  function playQuestion(next: number) {
    if (!session) return;
    setError("");
    setIndex(next);
    const promptStart = clock();
    setPhase("playing");
    setPlayback({ characters: 0, amplitude: 0 });
    const text = session.plan.questions[next].text;
    const language = session.language;
    const ended = () => {
      if (disposed.current) return;
      if (origin.current === null) origin.current = performance.now();
      stopPlayback.current?.();
      setPlayback({ characters: text.length, amplitude: 0 });
      const state = useSession.getState();
      if (state.current?.question !== next) state.beginTurn(next, promptStart, clock());
      setPhase("answer");
    };
    let usedFallback = false;
    const fallback = () => {
      if (usedFallback || disposed.current) return;
      usedFallback = true;
      if (!window.speechSynthesis) { setError("Audio unavailable. Read the question on screen."); ended(); return; }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === "id" ? "id-ID" : "en-US";
      utterance.onboundary = ({ charIndex, charLength }) => setPlayback({
        characters: charIndex + Math.max(charLength, 1), amplitude: .23,
      });
      utterance.onend = ended;
      utterance.onerror = () => { setError("Audio unavailable. Read the question on screen."); ended(); };
      window.speechSynthesis.speak(utterance);
    };
    const audio = session.audio[next];
    if (!audio) { fallback(); return; }
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = URL.createObjectURL(audio);
    const media = new Audio(url.current);
    player.current = media;
    media.onended = ended;
    media.onerror = fallback;
    let context: AudioContext | undefined;
    let analyser: AnalyserNode | undefined;
    const samples = new Uint8Array(128);
    try {
      context = new AudioContext();
      const source = context.createMediaElementSource(media);
      analyser = context.createAnalyser();
      analyser.fftSize = samples.length;
      source.connect(analyser).connect(context.destination);
      void context.resume().catch(() => {});
    } catch { /* Audio can still play through the media element. */ }
    let frame = 0;
    function update() {
      let amplitude = 0;
      if (analyser) {
        analyser.getByteTimeDomainData(samples);
        amplitude = Math.min(1, Math.sqrt(samples.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / samples.length) * 5);
      }
      if (Number.isFinite(media.duration)) setPlayback({
        characters: Math.ceil(text.length * Math.min(1, media.currentTime / media.duration)), amplitude,
      });
      frame = requestAnimationFrame(update);
    }
    stopPlayback.current = () => {
      cancelAnimationFrame(frame);
      if (context && context.state !== "closed") void context.close().catch(() => {});
      stopPlayback.current = null;
    };
    media.play().then(() => { frame = requestAnimationFrame(update); }).catch(() => {
      stopPlayback.current?.();
      fallback();
    });
  }

  async function endAnswer() {
    const stream = active.current;
    if (!stream || !session) return;
    active.current = null;
    setPhase("finishing");
    await stream.finish();
    if (disposed.current) return;
    useSession.getState().updateDelivery(clock(), started.current);
    started.current = null;
    const state = useSession.getState();
    const words = state.current?.words ?? [];
    state.commitTurn();
    if (words.length) void analyzeAnswer(session, index, words);
    advance();
  }

  async function startAnswer() {
    if (!session) return;
    setError("");
    setPhase("connecting");
    try {
      const stream = await startTranscription({
        language: session.language,
        clock,
        onWords: (words, final) => {
          useSession.getState().appendWords(words, final);
          if (final) useSession.getState().updateDelivery(clock(), started.current);
        },
        onLevel: setLevel,
        onSilence: () => void endAnswer(),
        onFailure: () => {
          active.current = null;
          started.current = null;
          useSession.getState().appendWords([], false);
          setError("Speech connection dropped. Press the microphone to reconnect.");
          setPhase("answer");
        },
      });
      if (disposed.current) { stream.cancel(); return; }
      const firstWord = useSession.getState().current?.words[0];
      started.current = firstWord ? Math.min(firstWord.startMs, clock()) : clock();
      active.current = stream;
      setPhase("listening");
    } catch (failure) {
      if (disposed.current) return;
      setError(failure instanceof DOMException && failure.name === "NotAllowedError"
        ? "Allow microphone access in your browser, then try again."
        : "Could not access the microphone or connect to transcription. Try again.");
      setPhase("answer");
    }
  }

  async function analyzeAnswer(prepared: PreparedSession, question: number, words: import("./deepgramClient").TranscriptWord[]) {
    setPending(count => count + 1);
    const currentQuestion = prepared.plan.questions[question];
    try {
      const response = await fetch("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...prepared.documents, question: currentQuestion.text, focus: currentQuestion.focus,
          language: prepared.language, words: words.slice(0, 1800).map(({ text }, i) => ({ i, text })),
        }),
      });
      if (!response.ok) return;
      const analysis = analysisResult.parse(await response.json());
      useSession.getState().saveAnalysis(prepared.id, question, analysis, analysis.flags.flatMap(flag => {
        const start = words[flag.start_word], end = words[flag.end_word];
        return start && end ? [{
          question, type: flag.type, category: flag.category, severity: flag.severity,
          weight: interview.weights[flag.type], explanation: flag.explanation, suggestion: flag.suggestion,
          startMs: start.startMs, endMs: end.endMs, startWord: flag.start_word, endWord: flag.end_word,
          source: "llm" as const,
        }] : [];
      }));
    } catch { /* The session can continue if this answer's coaching is unavailable. */ }
    finally { if (!disposed.current) setPending(count => count - 1); }
  }

  function continueAfterBreath() {
    if (!session) return;
    if (index + 1 < session.plan.questions.length) playQuestion(index + 1);
    else setPhase("complete");
  }

  function advance() {
    if (!session) return;
    if (session.effect === "full" && useSession.getState().composure.level === 3) setPhase("breathing");
    else continueAfterBreath();
  }

  function skip() {
    if (phase !== "answer") return;
    useSession.getState().commitTurn();
    advance();
  }

  return { index, phase, level, error, playback, pending, playQuestion, startAnswer, endAnswer, skip, continueAfterBreath };
}
