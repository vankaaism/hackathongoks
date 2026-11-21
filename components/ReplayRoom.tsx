"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { Pause, Play, RotateCcw } from "lucide-react";
import { seedReplay } from "@/lib/replay";
import { useSession, type Turn } from "@/lib/store";
import { flagLabels, type Flag } from "@/lib/analyzers/heuristics";
import { LeftTranscript } from "./panels/LeftTranscript";
import { RightStats, formatTime } from "./panels/RightStats";
import { AwarenessMessage } from "./effect/AwarenessOverlay";
import { Interviewer } from "./character/Interviewer";
import { DemoIntro } from "./DemoIntro";
import { useDemoProgressChime } from "@/lib/demo-chime";
import { ProgressBar } from "./ProgressBar";
import { SessionSummary } from "./SessionSummary";

export function ReplayRoom() {
  const [panel, setPanel] = useState<"transcript" | "performance">("transcript");
  const [selected, setSelected] = useState<Flag>();
  const [time, setTime] = useState(0);
  const [intro, setIntro] = useState(true);
  const [running, setRunning] = useState(false);
  const [ready, setReady] = useState(false);
  const point = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const silent = useRef(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [audioUnavailable, setAudioUnavailable] = useState(false);
  const level = useSession(state => state.composure.level);
  const flags = useSession(state => state.flags);
  const session = seedReplay.session;
  const complete = time >= seedReplay.durationMs;
  const percent = complete ? 100 : Math.floor(time * 100 / seedReplay.durationMs);
  useDemoProgressChime(percent);

  useEffect(() => {
    const state = useSession.getState();
    state.prepare(session);
    useSession.setState({ scores: [{ time: 0, score: 100 }] });
    setReady(true);
  }, [session]);

  useEffect(() => {
    const player = new Audio("/interview-demo-id.mp3");
    player.preload = "auto";
    audioRef.current = player;
    return () => {
      player.pause();
      audioRef.current = null;
    };
  }, []);

  const playReplay = useCallback(async () => {
    const player = audioRef.current;
    if (!player || silent.current) {
      setRunning(true);
      return;
    }
    try {
      await player.play();
      if (audioRef.current === player) { setAudioBlocked(false); setRunning(true); }
    } catch (error) {
      if (audioRef.current !== player) return;
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setAudioBlocked(true);
      } else {
        silent.current = true;
        setAudioUnavailable(true);
        setRunning(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const player = audioRef.current;
      const clock = player && !silent.current
        ? player.ended ? seedReplay.durationMs : player.currentTime * 1000
        : point.current + now - last;
      point.current = Math.min(seedReplay.durationMs, clock);
      last = now;
      const time = Math.round(point.current);
      const turns: Turn[] = seedReplay.turns.filter(turn => turn.promptEnd <= time)
        .map(turn => ({ ...turn, words: turn.words.filter(word => word.endMs <= time) }));
      const revealed = seedReplay.flags.filter(flag => flag.endMs <= time);
      useSession.setState({ turns, flags: revealed });
      useSession.getState().updateDelivery(time, null);
      setTime(time);
      if (point.current >= seedReplay.durationMs) { player?.pause(); setRunning(false); }
    }, 200);
    return () => clearInterval(timer);
  }, [running]);

  const question = seedReplay.turns.findLastIndex(turn => turn.promptStart <= time);
  const turn = seedReplay.turns[Math.max(0, question)];
  const activeFlag = flags.at(-1);
  const closing = time >= seedReplay.closingStart;
  const speaking = running && (time < turn.promptEnd || closing);
  const demoMouth = speaking ? .25 + .55 * Math.abs(Math.sin(time / 155)) : 0;

  const finishIntro = useCallback(() => {
    setIntro(false);
    void playReplay();
  }, [playReplay]);

  function restart() {
    useSession.getState().prepare(session);
    useSession.setState({ scores: [{ time: 0, score: 100 }] });
    point.current = 0;
    const player = audioRef.current;
    if (player) { player.pause(); player.currentTime = 0; }
    setAudioBlocked(false);
    setTime(0);
    setSelected(undefined);
    setRunning(false);
    setIntro(true);
  }

  if (intro) return <main className="home setup-home">
    <div className="setup-header"><Link href="/" className="brand"><BrandMark/></Link><span>Demo</span></div>
    <h1 className="wizard-title">Demo latihan wawancara</h1>
    <DemoIntro onFinish={finishIntro}/>
  </main>;

  return <main className="workspace">
    <div className="workspace-header">
      <Link href="/" className="brand"><BrandMark/></Link>
      <ProgressBar label="Progres demo" value={percent}/>
    </div>
    <div className="room-grid" data-panel={panel}>
      <LeftTranscript question={session.plan.questions[0].text} session={ready ? session : null} selected={selected} select={setSelected}/>
      <section className="stage" aria-label="Interviewer">
        <div className="room">
          <Interviewer speaking={speaking} amplitude={demoMouth}/>
          </div>
      <div className="dialogue">
            <p className="speaker">Ms. Alina <span>HR Lead, {session.company}</span></p>
            <p>{closing ? session.plan.closing : session.plan.questions[turn.question].text}</p>
          </div>
        <div className="controls">
          <span>{formatTime(time)} / 01:30</span>
          <button type="button" className="mic" aria-label={complete ? "Ulangi demo" : running ? "Jeda demo" : "Putar demo bersuara"}
            onClick={complete ? restart : running ? () => { audioRef.current?.pause(); setRunning(false); } : () => void playReplay()}>
            {complete ? <RotateCcw size={20}/> : running ? <Pause size={20}/> : <Play size={20}/>}
          </button>
          <span>{activeFlag ? flagLabels[activeFlag.type] : "Recorded practice"}</span>
        </div>
        {audioBlocked && <p className="muted text-center">Tekan tombol putar untuk memulai wawancara bersuara.</p>}
        {audioUnavailable && <p className="muted text-center">Audio gagal dimuat. Demo berlanjut dengan transkrip.</p>}
        <AwarenessMessage level={level} preference="full" cause={activeFlag}/>
      </section>
      <div className="mobile-panels" aria-label="Interview panels">
        <button type="button" aria-pressed={panel === "transcript"} aria-controls="transcript" onClick={() => setPanel("transcript")}>Transcript</button>
        <button type="button" aria-pressed={panel === "performance"} aria-controls="performance" onClick={() => setPanel("performance")}>Performance</button>
      </div>
      <RightStats live={!complete} replayClock={time} selected={selected} select={flag => { setSelected(flag); setPanel("transcript"); }}/>
    </div>
    {complete && <p className="demo-review-note">Demo selesai. Tutup ringkasan, lalu klik kata bergaris di transkrip untuk melihat alasan dan sarannya.</p>}
    {complete && <SessionSummary session={session} pending={0} replay/>}
  </main>;
}
