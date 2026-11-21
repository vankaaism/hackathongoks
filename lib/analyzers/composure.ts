import { interview } from "../config";
import type { Flag } from "./heuristics";

export type Level = 0 | 1 | 2 | 3;
export type Composure = { level: Level; lowerSince: number | null; candidate: Level; load: number };
export const initialComposure: Composure = { level: 0, lowerSince: null, candidate: 0, load: 0 };

export function evaluateComposure(previous: Composure, flags: Flag[], now: number): Composure {
  const load = flags.reduce((sum, flag) => {
    const age = now - flag.endMs;
    return age >= 0 ? sum + flag.weight * Math.max(0, 1 - age / interview.composureWindowMs) : sum;
  }, 0);
  const candidate = interview.composureThresholds.filter(threshold => load >= threshold).length as Level;
  if (candidate >= previous.level) return { level: candidate, candidate, load, lowerSince: null };
  const since = previous.lowerSince ?? now;
  if (now - since >= interview.recoveryMs) return { level: candidate, candidate, load, lowerSince: null };
  return { level: previous.level, candidate, load, lowerSince: since };
}
