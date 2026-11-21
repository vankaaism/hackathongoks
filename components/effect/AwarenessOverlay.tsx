import type { Effect } from "@/lib/llm/schemas";
import type { EffectEvent } from "@/lib/store";
import type { Level } from "@/lib/analyzers/composure";
import type { Flag } from "@/lib/analyzers/heuristics";

export function AwarenessOverlay({ level, preference, lastEvent }: {
  level: Level;
  preference: Effect;
  lastEvent?: EffectEvent;
}) {
  if (preference === "off") return null;
  const display = preference === "gentle" ? Math.min(2, level) : level;
  return <>
    <div className="awareness-vignette" data-level={display} aria-hidden />
    <div className="awareness-vignette awareness-vignette-edge" data-level={display} aria-hidden />
    {display === 0 && lastEvent?.level === 0 && <div className="awareness-recovery" key={lastEvent.time} aria-hidden />}
  </>;
}


export function AwarenessMessage({ level, preference, cause }: { level: Level; preference: Effect; cause?: Flag }) {
  const display = preference === "gentle" ? Math.min(2, level) : level;
  if (preference === "off" || display < 2) return null;
  const message = display === 3 ? "Take a beat. Breathe with the circle, then continue."
    : cause?.type === "rate_spike" ? "You’re speeding up. Slow down at the end of your next thought."
    : cause?.type === "long_pause" ? "Your pauses are getting longer. Take a breath, then start with one point."
    : "Take a short breath and focus on your next sentence.";
  return <div className="awareness-coaching" role="status">
    {display === 3 && <span className="breath" aria-hidden />}
    <span>{message}</span>
  </div>;
}
