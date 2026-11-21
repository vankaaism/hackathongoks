import { useId, useState } from "react";
import { Activity } from "lucide-react";
import { Area, CartesianGrid, ComposedChart, ReferenceLine, ResponsiveContainer, Scatter, XAxis, YAxis } from "recharts";
import { useSession } from "@/lib/store";
import { flagKey, flagLabels, type Flag } from "@/lib/analyzers/heuristics";
import { demoDeduction, demoFinalScore, liveScore } from "@/lib/scoring";

const severity = ["#8bb8ec", "#e4b87a", "#fa978f"];

export function formatTime(ms: number) {
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function RightStats({ live, replayClock, selected, select }: { live: boolean; replayClock?: number; selected?: Flag; select: (flag: Flag) => void }) {
  const { scores, liveFlags, flags, effects, turns, current } = useSession();
  const [tab, setTab] = useState<"Live" | "Review" | "Details">("Live");
  const entries = [...flags, ...liveFlags].sort((a, b) => a.endMs - b.endMs);
  const chartGradient = useId();
  const replay = replayClock !== undefined;
  const scoreAt = (time: number) => replay
    ? demoFinalScore(entries.filter(flag => flag.endMs <= time))
    : liveScore(entries, time);
  const selectedIndex = selected ? entries.findIndex(flag => flagKey(flag) === flagKey(selected)) : -1;
  const shown = selectedIndex >= 0 ? entries[selectedIndex] : entries.at(-1);
  const recoveryTimes = effects.filter(event => event.level === 0).map(event => event.time);
  const latestTime = Math.max(replayClock ?? scores.at(-1)?.time ?? 0, ...entries.map(flag => flag.endMs), ...recoveryTimes);
  const eventTimes = [...new Set(entries.map(flag => flag.endMs))];
  const leadingEdges = eventTimes.map((time, i) => Math.max(eventTimes[i - 1] ?? 0, time - 650));
  const timeline = [...new Set([0, latestTime, ...eventTimes, ...leadingEdges, ...recoveryTimes])].sort((a, b) => a - b);
  const chartData = timeline.map(time => ({ time, score: scoreAt(time) }));
  const points = [
    ...entries.map(flag => ({
      time: flag.endMs, score: scoreAt(flag.endMs), color: severity[(flag.severity ?? flag.weight) - 1],
      flag, active: selected && flagKey(flag) === flagKey(selected),
    })),
    ...recoveryTimes.map(time => ({ time, score: scoreAt(time), color: "#34866f" })),
  ];
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
      <div className="score-title"><h3>Interview score</h3><strong>{scoreAt(latestTime)}</strong></div>
      <div className="performance-chart" aria-label="Interview score over time">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ComposedChart data={chartData} margin={{ left: -27, right: 12, top: 10, bottom: 0 }}>
            <defs><linearGradient id={chartGradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#65b9a2" stopOpacity={.3}/>
              <stop offset="100%" stopColor="#65b9a2" stopOpacity={.045}/>
            </linearGradient></defs>
            <CartesianGrid stroke="#dce4f0" strokeDasharray="3 4" vertical={false}/>
            <XAxis type="number" dataKey="time" domain={[0, Math.max(replay ? 90_000 : 10_000, latestTime)]}
              tickFormatter={formatTime} axisLine={false} tickLine={false} tickMargin={6} tick={{ fill: "#53637d", fontSize: 10 }} tickCount={4}/>
            <YAxis type="number" dataKey="score" domain={[0, 100]} ticks={[0, 50, 100]}
              axisLine={false} tickLine={false} tickMargin={5} tick={{ fill: "#53637d", fontSize: 10 }}/>
            <Area type="linear" dataKey="score" stroke="#257661" strokeWidth={2}
              fill={`url(#${chartGradient})`} isAnimationActive={false}/>
            {live && latestTime > 0 && <ReferenceLine x={latestTime} stroke="#7388a7" strokeDasharray="3 4"/>}
            <Scatter data={points} isAnimationActive={false} shape={({ cx, cy, payload }) =>
              <circle className="chart-dot" cx={cx} cy={cy} r={payload.active ? 5.5 : 3.6} fill={payload.color}
                stroke={payload.active ? "#263c68" : "#fff"} strokeWidth={1.5}
                style={{ cursor: payload.flag ? "pointer" : undefined }}
                onClick={() => { if (payload.flag) select(payload.flag); }}/>}/>
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
        <p className="muted">{replay ? "Skor demo dimulai dari 100. Potongan ringan 1,5, sedang 4, dan berat 6 poin." : "The live score subtracts four points per flag weight. Each penalty halves after one minute."}</p>
      </> : <>
        {shown && <article className="feedback-card">
          <strong>{flagLabels[shown.type]}</strong>
          <p>{shown.explanation}</p>
          <span className="muted">−{replay ? demoDeduction(shown.weight).toLocaleString("id-ID") : shown.weight * 4} {replay ? "poin" : "live points"}</span>
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
