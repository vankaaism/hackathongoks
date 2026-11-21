"use client";

import { useEffect, useRef } from "react";

let context: AudioContext | undefined;

export function unlockDemoChime() {
  if (!window.AudioContext) return;
  context ??= new AudioContext();
  void context.resume().catch(() => {});
}

export function demoChimeReady() {
  return context?.state === "running";
}

export function useDemoProgressChime(percent: number) {
  const last = useRef(0);
  const milestone = Math.floor(percent / 25);
  useEffect(() => {
    const increased = milestone > last.current;
    last.current = milestone;
    if (!increased || context?.state !== "running") return;
    const start = context.currentTime;
    [440, 587, 740].slice(0, milestone === 4 ? 3 : 2).forEach((frequency, index) => {
      const at = start + index * .068;
      const oscillator = context!.createOscillator();
      const envelope = context!.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      envelope.gain.setValueAtTime(.0001, at);
      envelope.gain.exponentialRampToValueAtTime(.046, at + .014);
      envelope.gain.exponentialRampToValueAtTime(.0001, at + .155);
      oscillator.connect(envelope).connect(context!.destination);
      oscillator.start(at);
      oscillator.stop(at + .16);
    });
  }, [milestone]);
}
