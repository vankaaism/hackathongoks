import { useState } from "react";
import { Activity } from "lucide-react";
import { Area, CartesianGrid, ComposedChart, ReferenceLine, ResponsiveContainer, Scatter, XAxis, YAxis } from "recharts";
import { useSession } from "@/lib/store";
import { flagKey, flagLabels, type Flag } from "@/lib/analyzers/heuristics";
import { liveScore } from "@/lib/scoring";

const severity = ["#8bb8ec", "#e4b87a", "#fa978f"];

export function formatTime(ms: number) {
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function RightStats({ live, effectsEnabled, selected, select }: { live: boolean; effectsEnabled: boolean; selected?: Flag; select: (flag: Flag) => void }) {
  const { scores, liveFlags, flags, effects, turns, current } = useSession();
  const [tab, setTab] = useState<"Live" | "Review" | "Details">("Live");
  const entries = [...flags, ...liveFlags].sort((a, b) => a.endMs - b.endMs);
  const lastEffect = effects.at(-1);
  const points = [
    ...entries.map(flag => ({ time: flag.endMs, score: liveScore(entries, flag.endMs), color: severity[(flag.severity ?? flag.weight) - 1] })),
    ...effects.filter(event => event.level === 0).map(event => ({ time: event.time, score: liveScore(entries, event.time), color: "#a8d77f" })),
  ];
  const selectedIndex = selected ? entries.findIndex(flag => flagKey(flag) === flagKey(selected)) : -1;
  const shown = selectedIndex >= 0 ? entries[selectedIndex] : entries.at(-1);
  const latestTime = Math.max(scores.at(-1)?.time ?? 0, ...points.map(point => point.time));
  const chartData = scores.length > 0 ? scores : [{ time: 0, score: 100 }];
  const allTurns = current ? [...turns, current] : turns;
  const words = allTurns.flatMap(turn => turn.words);
  const spokenMs = allTurns.reduce((sum, turn) => sum + Math.max(0, (turn.words.at(-1)?.endMs ?? 0) - (turn.words[0]?.startMs ?? 0)), 0);
  const pauses = entries.filter(flag => flag.type === "long_pause");
  const rate = (count: number) => spokenMs ? Math.round(count * 60_000 / spokenMs) : 0;

  return <section className="panel performance" aria-label="Performance" id="performance">
    <header><Activity size={17}/><h2>Performance</h2></header>
    <div className="stats-body">
      <div className="review-tabs" aria-label="Performance view">
        {(["Live", "Review", "Details"] as const).map(item => <button type="button" key={item} aria-pressed={tab === item} onClick={() => setTab(item)}>{item}</button>)}
      </div>
      <div className="score-title"><h3>Interview score</h3><strong>{scores.at(-1)?.score ?? "—"}</strong></div>
      <div className="performance-chart" data-pulse={effectsEnabled && lastEffect?.level === 1 && live} aria-label="Interview score over time">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ComposedChart data={chartData} margin={{ left: -24, right: 16, top: 8, bottom: 0 }}>
            <CartesianGrid stroke="#413d33" vertical={false}/>
            <XAxis type="number" dataKey="time" domain={[0, Math.max(10_000, latestTime)]} tickFormatter={formatTime} tick={{ fill: "#b9b0a0", fontSize: 10 }} tickCount={4}/>
            <YAxis type="number" dataKey="score" domain={[0, 100]} ticks={[0, 50, 100]} tick={{ fill: "#b9b0a0", fontSize: 10 }}/>
            <Area type="monotone" dataKey="score" stroke="#a9c988" fill="#495838" isAnimationActive={false}/>
            {live && latestTime > 0 && <ReferenceLine x={latestTime} stroke="#d2d2b3" strokeDasharray="3 3"/>}
            <Scatter data={points} isAnimationActive={false} shape={({ cx, cy, payload }) => <circle className="chart-dot" cx={cx} cy={cy} r={4} fill={payload.color}/>}/>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {tab === "Details" ? <>
        <h3>Delivery metrics</h3>
        <dl className="metric-grid">
          <div><dt>Words / min</dt><dd>{rate(words.length)}</dd></div>
          <div><dt>Fillers / min</dt><dd>{rate(entries.filter(flag => flag.type === "filler").length)}</dd></div>
          <div><dt>Average logged pause</dt><dd>{pauses.length ? (pauses.reduce((sum, flag) => sum + flag.endMs - flag.startMs, 0) / pauses.length / 1000).toFixed(1) : "—"} s</dd></div>
          <div><dt>Flags / answer</dt><dd>{turns.length ? (flags.length / turns.length).toFixed(1) : "—"}</dd></div>
        </dl>
        <p className="muted">The live score subtracts four points per flag weight. Each penalty halves after one minute.</p>
      </> : <>
        {shown && <article className="feedback-card">
          <strong>{flagLabels[shown.type]}</strong>
          <p>{shown.explanation}</p>
          <span className="muted">−{shown.weight * 4} live points</span>
          {tab === "Review" && <button type="button" disabled={selectedIndex === entries.length - 1} onClick={() => select(entries[selectedIndex + 1])}>Next</button>}
        </article>}
        <h3>Session events</h3>
        <ul className="event-list">
          {[...entries.map(flag => ({
            time: flag.endMs, id: flagKey(flag), item: <button type="button" onClick={() => select(flag)}>
              <time>{formatTime(flag.endMs)}</time> <span data-category={flag.category}>{flagLabels[flag.type]}</span><small>Q{flag.question + 1}</small>
            </button>,
          })), ...effects.map(change => ({
            time: change.time, id: `effect:${change.time}`, item: <div><time>{formatTime(change.time)}</time> {change.level ? `Awareness level ${change.level}` : "Composure recovered"}</div>,
          }))].sort((a, b) => b.time - a.time).map(event => <li key={event.id}>{event.item}</li>)}
        </ul>
        {!shown && !effects.length && <p className="muted">Feedback and recovery moments will appear here.</p>}
      </>}
    </div>
  </section>;
}
