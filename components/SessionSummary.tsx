"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "./ui/button";
import { flagKey, flagLabels, type Category, type Flag } from "@/lib/analyzers/heuristics";
import { useSession, type PreparedSession, type Turn } from "@/lib/store";
import { demoDeduction, demoFinalScore, finalScore } from "@/lib/scoring";
import { practiceSummary, summarySchema, type Summary } from "@/lib/llm/summary";

const categories: Category[] = ["Fluency", "Clarity", "Evidence", "Consistency", "Composure"];
const labels: Partial<Record<Flag["type"], string>> = {
  filler: "Kata pengisi", long_pause: "Jeda panjang", restart: "Pengulangan awal",
  off_topic: "Keluar topik", vague_claim: "Klaim kurang spesifik", cv_contradiction: "Perbedaan dengan CV",
  rate_spike: "Lonjakan tempo", hedging: "Ungkapan ragu",
};

type Result = { summary: Summary; score: number; saved: boolean | null; flags: Flag[]; turns: Turn[] };

function DemoEvidence({ flags, turns }: { flags: Flag[]; turns: Turn[] }) {
  const total = flags.reduce((sum, flag) => sum + demoDeduction(flag.weight), 0);
  return <div className="summary-evidence">
    <h3>Rincian skor</h3>
    <p>{flags.length} temuan dalam {turns.filter(turn => turn.words.length).length} jawaban. Skor dimulai dari 100 dan dikurangi {total} poin.</p>
    <p className="muted">Temuan ringan −1,5 poin, sedang −4 poin, dan berat −6 poin.</p>
    <ul>{categories.map(category => {
      const findings = flags.filter(flag => flag.category === category);
      const points = findings.reduce((sum, flag) => sum + demoDeduction(flag.weight), 0);
      const types = [...new Set(findings.map(flag => flag.type))];
      const sample = [...findings].sort((a, b) => b.weight - a.weight)[0];
      const words = sample && turns.find(turn => turn.question === sample.question)?.words;
      const quote = sample && sample.startWord >= 0 && sample.type !== "long_pause"
        ? words?.slice(sample.startWord, sample.endWord + 1).map(word => word.text).join(" ") : null;
      const seconds = sample ? Math.floor(sample.endMs / 1000) : 0;
      return <li key={category}>
        <div><strong>{category}</strong><span>{findings.length} temuan · −{points.toLocaleString("id-ID")}</span></div>
        {types.length > 0 && <p>{types.map(type => `${findings.filter(flag => flag.type === type).length} ${(labels[type] ?? flagLabels[type]).toLowerCase()}`).join(" · ")}</p>}
        {sample && <p className="muted">
          <time>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</time>
          {" · "}{quote && <>“{quote}” — </>}{sample.explanation}
        </p>}
      </li>;
    })}</ul>
  </div>;
}

export function SessionSummary({ session, pending, replay = false }: { session: PreparedSession; pending: number; replay?: boolean }) {
  const [result, setResult] = useState<Result>();
  const [open, setOpen] = useState(true);
  const panel = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open && !panel.current?.open) panel.current?.showModal();
    if (!open && panel.current?.open) panel.current.close();
  }, [open]);

  useEffect(() => {
    if (pending > 0) return;
    const controller = new AbortController();
    async function generate() {
      const state = useSession.getState();
      const spokenMs = state.turns.reduce((sum, turn) =>
        sum + Math.max(0, (turn.words.at(-1)?.endMs ?? 0) - (turn.words[0]?.startMs ?? 0)), 0);
      const score = replay ? demoFinalScore(state.flags) : finalScore(state.flags, spokenMs);
      const evidence = { flags: state.flags, turns: state.turns };
      const ranked = [...state.flags].sort((a, b) => (b.severity ?? b.weight) - (a.severity ?? a.weight));
      const counts = ranked.reduce<Record<string, number>>((acc, flag) => {
        acc[flag.category] = (acc[flag.category] ?? 0) + 1; return acc;
      }, {});
      const input = {
        language: session.language, score, counts,
        flags: ranked.slice(0, 5).map(({ category, explanation, suggestion }) => ({
          category, explanation: explanation.slice(0, 400), suggestion,
        })),
        strengths: Object.values(state.analyses).map(answer => answer.strength),
        answerScores: Object.values(state.analyses).map(answer => answer.answer_score),
      };
      let summary = practiceSummary(input);
      if (!replay) {
        try {
          const response = await fetch("/api/summary", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input), signal: controller.signal,
          });
          if (response.ok) summary = summarySchema.parse(await response.json());
        } catch { /* Local feedback remains available. */ }
      }
      if (controller.signal.aborted) return;
      setResult({ ...evidence, summary, score, saved: null });
      if (replay || !state.turns.some(turn => turn.words.length > 0)) return;
      try {
        const response = await fetch("/api/session", {
          method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
          body: JSON.stringify({
            ...session.documents, id: session.id, company: session.company, language: session.language,
            effect: session.effect, plan: session.plan, startedAt: session.startedAt, finalScore: score, summary,
            turns: state.turns.map(turn => ({
              question: turn.question, prompt: session.plan.questions[turn.question].text,
              focus: session.plan.questions[turn.question].focus, promptStart: turn.promptStart, promptEnd: turn.promptEnd,
              text: turn.words.map(word => word.text).join(" "), words: turn.words,
              startMs: turn.words[0]?.startMs ?? turn.promptEnd, endMs: turn.words.at(-1)?.endMs ?? turn.promptEnd,
              score: state.analyses[turn.question] ? Math.round(state.analyses[turn.question].answer_score) : null,
            })),
            flags: state.flags.map(flag => ({
              ...flag, source: flag.source ?? "heuristic", severity: flag.severity ?? flag.weight,
              status: state.flagStatus[flagKey(flag)] ?? "open",
            })),
            scores: state.scores, effects: state.effects, marks: state.marks,
          }),
        });
        if (!controller.signal.aborted) setResult({ ...evidence, summary, score, saved: response.ok });
      } catch {
        if (!controller.signal.aborted) setResult({ ...evidence, summary, score, saved: false });
      }
    }
    void generate();
    return () => controller.abort();
  }, [pending, replay, session]);

  return <>
    {!open && <Button className="primary summary-trigger" onClick={() => setOpen(true)}>{replay ? "Ringkasan sesi" : "Session summary"}</Button>}
    <dialog ref={panel} className="summary-dialog" onClose={() => setOpen(false)}>
      <div className="summary-header">
        <h2>{replay ? "Ringkasan sesi" : "Session summary"}</h2>
        <Button onClick={() => setOpen(false)}>{replay ? "Tutup" : "Close"}</Button>
      </div>
      {result ? <>
        <p className="result-score"><strong>{result.score}</strong> / 100</p>
        {replay ? <>
          <DemoEvidence flags={result.flags} turns={result.turns}/>
          <h3>Bukti yang sudah kuat</h3>
          <p>Di jawaban ketiga, Rania menyebut hasil yang bisa dibayangkan: “jumlah laporan stok yang hilang turun 25 persen.”</p>
        </> : <>
        <h3>Strength</h3><p>{result.summary.strength}</p>
        <h3>Areas to practice</h3>
        <ul>{result.summary.top_weaknesses.map((item, i) => <li key={i}><strong>{item.category}</strong> · {item.evidence}</li>)}</ul>
        <h3>Next steps</h3>
        <ol>{result.summary.recommendations.map((item, i) => <li key={i}>{item}</li>)}</ol>
        </>}
        {result.saved !== null && <p className="muted">{result.saved ? "Session saved." : "Session could not be saved."}</p>}
        <Link className="preview-link" href="/">{replay ? "Mulai sesi latihan" : "Start another practice session"}</Link>
      </> : <p role="status">Preparing your feedback…</p>}
    </dialog>
  </>;
}
