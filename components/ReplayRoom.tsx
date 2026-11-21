"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AudioLines, Pause, Play, RotateCcw } from "lucide-react";
import { seedReplay } from "@/lib/replay";
import { useSession, type Turn } from "@/lib/store";
import { flagLabels, type Flag } from "@/lib/analyzers/heuristics";
import { LeftTranscript } from "./panels/LeftTranscript";
import { RightStats, formatTime } from "./panels/RightStats";
import { AwarenessMessage, AwarenessOverlay } from "./effect/AwarenessOverlay";
import { Interviewer } from "./character/Interviewer";
import { SessionSummary } from "./SessionSummary";

export function ReplayRoom() {
  const [panel, setPanel] = useState<"transcript" | "performance">("transcript");
  const [selected, setSelected] = useState<Flag>();
  const [time, setTime] = useState(0);
  const [running, setRunning] = useState(false);
  const [ready, setReady] = useState(false);
  const point = useRef(0);
  const level = useSession(state => state.composure.level);
  const effects = useSession(state => state.effects);
  const flags = useSession(state => state.flags);
  const session = seedReplay.session;
  const complete = time >= seedReplay.durationMs;

  useEffect(() => {
    const state = useSession.getState();
    state.prepare(session);
    useSession.setState({ scores: [{ time: 0, score: 100 }] });
    setReady(true);
  }, [session]);

  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      point.current = Math.min(seedReplay.durationMs, point.current + now - last);
      last = now;
      const time = Math.round(point.current);
      const turns: Turn[] = seedReplay.turns.filter(turn => turn.promptEnd <= time)
        .map(turn => ({ ...turn, words: turn.words.filter(word => word.endMs <= time) }));
      const revealed = seedReplay.flags.filter(flag => flag.endMs <= time);
      useSession.setState({ turns, flags: revealed });
      useSession.getState().updateDelivery(time, null);
      setTime(time);
      if (point.current >= seedReplay.durationMs) setRunning(false);
    }, 200);
    return () => clearInterval(timer);
  }, [running]);

  const question = seedReplay.turns.findLastIndex(turn => turn.promptStart <= time);
  const turn = seedReplay.turns[Math.max(0, question)];
  const activeFlag = flags.at(-1);
  const expression = complete ? "positive" : level >= 2 ? "concerned"
    : activeFlag?.type === "cv_contradiction" && time - activeFlag.endMs < 6000 ? "skeptical"
    : running && time < turn.promptEnd ? "speaking" : "idle";

  function restart() {
    useSession.getState().prepare(session);
    useSession.setState({ scores: [{ time: 0, score: 100 }] });
    point.current = 0;
    setTime(0);
    setSelected(undefined);
    setRunning(true);
  }

  return <main className="workspace">
    <div className="workspace-header">
      <Link href="/" className="brand"><AudioLines size={22}/> Cermin</Link>
      <span>Offline replay</span>
    </div>
    <div className="room-grid" data-panel={panel} data-awareness={level}>
      <LeftTranscript question={session.plan.questions[0].text} session={ready ? session : null} selected={selected} select={setSelected}/>
      <section className="stage" aria-label="Interviewer">
        <div className="room">
          <div className="window" aria-hidden/><div className="lamp" aria-hidden/>
          <Interviewer expression={expression} amplitude={0}/>
          <div className="dialogue">
            <p className="speaker">Ms. Alina <span>HR Lead, {session.company}</span></p>
            <p>{complete ? session.plan.closing : session.plan.questions[turn.question].text}</p>
          </div>
        </div>
        <div className="controls">
          <span>{formatTime(time)} / 01:30</span>
          <button type="button" className="mic" aria-label={complete ? "Replay again" : running ? "Pause replay" : "Play replay"}
            onClick={complete ? restart : () => setRunning(value => !value)}>
            {complete ? <RotateCcw size={20}/> : running ? <Pause size={20}/> : <Play size={20}/>}
          </button>
          <span>{activeFlag ? flagLabels[activeFlag.type] : "Recorded practice"}</span>
        </div>
        <AwarenessMessage level={level} preference="full" cause={activeFlag}/>
      </section>
      <div className="mobile-panels" aria-label="Interview panels">
        <button type="button" aria-pressed={panel === "transcript"} aria-controls="transcript" onClick={() => setPanel("transcript")}>Transcript</button>
        <button type="button" aria-pressed={panel === "performance"} aria-controls="performance" onClick={() => setPanel("performance")}>Performance</button>
      </div>
      <RightStats live={!complete} effectsEnabled selected={selected} select={flag => { setSelected(flag); setPanel("transcript"); }}/>
      <AwarenessOverlay level={level} preference="full" lastEvent={effects.at(-1)}/>
    </div>
    {complete && <SessionSummary session={session} pending={0} replay/>}
  </main>;
}
