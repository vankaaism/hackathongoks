import { Mic, Play, Square, RotateCcw, SkipForward } from "lucide-react";
import { AwarenessMessage, AwarenessOverlay } from "@/components/effect/AwarenessOverlay";
import { useEffect, useState } from "react";
import { Interviewer } from "@/components/character/Interviewer";
import { useSession } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { interview } from "@/lib/config";
import type { PreparedSession } from "@/lib/store";
import type { useInterviewAudio } from "@/lib/stt/useInterviewAudio";

export function CenterStage({ question, session, audio }: {
  question: string;
  session: PreparedSession | null;
  audio: ReturnType<typeof useInterviewAudio>;
}) {
  const { index, phase, level, error, playback, playQuestion, startAnswer, endAnswer, skip, continueAfterBreath } = audio;
  const [explaining, setExplaining] = useState(false);
  useEffect(() => {
    if (!session || session.effect === "off" || phase === "ready" || sessionStorage.getItem("cermin-awareness-intro")) return;
    sessionStorage.setItem("cermin-awareness-intro", "shown");
    setExplaining(true);
  }, [phase, session]);
  useEffect(() => {
    if (!explaining) return;
    const timer = setTimeout(() => setExplaining(false), 10_000);
    return () => clearTimeout(timer);
  }, [explaining]);
  const cause = useSession(state => state.liveFlags.at(-1) ?? state.flags.at(-1));
  const lastEffect = useSession(state => state.effects.at(-1));
  const awareness = useSession(state => state.composure.level);
  const visibleQuestion = phase === "playing" ? question.slice(0, playback.characters) : question;
  const label = { ready: "Start interview", playing: "Playing question", answer: "Start answering", connecting: "Connecting microphone", listening: "Finish answer", finishing: "Finishing answer", breathing: "Continue interview", complete: "Interview complete" }[phase];
  const canAct = !!session && ["ready", "answer", "listening", "breathing"].includes(phase);
  const controls = phase === "ready" ? () => playQuestion(0) : phase === "listening" ? endAnswer : phase === "breathing" ? continueAfterBreath : startAnswer;

  return <section className="stage" aria-label="Interviewer">
    <div className="room">
      {session && phase !== "complete" && <AwarenessOverlay level={awareness} preference={session.effect} lastEvent={lastEffect}/>}
      <Interviewer speaking={phase === "playing"} amplitude={playback.amplitude}/>
      </div>
      <div className="dialogue">
        <p className="speaker">Ms. Alina <span>{session ? `HR Lead, ${session.company}` : "HR Lead"}</span></p>
        <p aria-label={phase === "playing" ? question : undefined}>
          {phase === "complete" ? session?.plan.closing : <span aria-hidden={phase === "playing"}>{visibleQuestion}</span>}
        </p>
      </div>
    {error && <p role="alert" className="muted px-2 pt-2">{error}</p>}
    <div className="controls">
      <span>Question {index + 1} of {interview.questions}</span>
      <Button className="mic" aria-label={session ? label : "Microphone unavailable in preview"} title={label} disabled={!canAct} onClick={controls}>
        {phase === "ready" || phase === "breathing" ? <Play size={22}/> : phase === "listening" ? <Square size={20}/> : <Mic size={22}/>}
      </Button>
      <span aria-live="polite">{session ? label : "Room preview"}</span>
    </div>
    {session && <div className="question-tools">
      <Button onClick={() => playQuestion(index)} disabled={phase !== "answer"}><RotateCcw size={15}/>Repeat</Button>
      <span className="progress-dots" aria-hidden>{session.plan.questions.map((_, i) => <i key={i} data-active={i === index} data-done={i < index}/>)}</span>
      <Button onClick={skip} disabled={phase !== "answer"}>Skip<SkipForward size={15}/></Button>
    </div>}
    {session && <AwarenessMessage level={awareness} preference={session.effect} cause={cause}/>}
    {explaining && awareness < 2 && <p className="effect-intro muted">The Awareness Effect appears when delivery issues cluster. Use it as a cue to pause and take a breath.</p>}
    {phase === "listening" && <meter className="mic-meter" aria-label="Microphone level" min={0} max={1} value={level}/>}
  </section>;
}
