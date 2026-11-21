"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { ProgressBar } from "@/components/ProgressBar";
import { CenterStage } from "./CenterStage";
import { LeftTranscript } from "./LeftTranscript";
import { RightStats } from "./RightStats";

import { SessionSummary } from "@/components/SessionSummary";
import { useInterviewAudio } from "@/lib/stt/useInterviewAudio";
import type { Flag } from "@/lib/analyzers/heuristics";
import { useSession } from "@/lib/store";

export function InterviewRoom({ sessionId }: { sessionId: string }) {
  const [selected, setSelected] = useState<Flag>();
  const [panel, setPanel] = useState<"transcript" | "performance">("transcript");
  const stored = useSession(state => state.session);
  const session = stored?.id === sessionId ? stored : null;
  const audio = useInterviewAudio(session);
  if (!session && sessionId !== "demo") {
    return <main className="home"><h1>Start a new practice session</h1><Link href="/" className="primary">Back to setup</Link></main>;
  }
  const question = session?.plan.questions[audio.index].text ?? "Tell me a little about yourself and what drew you to this role.";
  return <main className="workspace">
    <div className="workspace-header">
      <Link href="/" className="brand"><BrandMark/></Link>
      {session && <ProgressBar label="Progres wawancara" value={audio.phase === "complete" ? 100 : Math.round(audio.index * 100 / session.plan.questions.length)}/>}
    </div>
    <div className="room-grid" data-panel={panel}>
      <LeftTranscript question={question} session={session} selected={selected} select={setSelected}/>
      <CenterStage question={question} session={session} audio={audio} />
      <div className="mobile-panels" aria-label="Interview panels">
        <button type="button" aria-pressed={panel === "transcript"} aria-controls="transcript" onClick={() => setPanel("transcript")}>Transcript</button>
        <button type="button" aria-pressed={panel === "performance"} aria-controls="performance" onClick={() => setPanel("performance")}>Performance</button>
      </div>
      <RightStats live={audio.phase !== "complete"} selected={selected} select={flag => { setSelected(flag); setPanel("transcript"); }}/>
    </div>
    {session && audio.phase === "complete" && <SessionSummary session={session} pending={audio.pending}/>}
  </main>;
}
