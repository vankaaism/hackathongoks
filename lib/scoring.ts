import { interview } from "./config";
import type { Flag } from "./analyzers/heuristics";

const bounded = (penalty: number) => Math.round(100 - Math.min(100, Math.max(0, penalty)));

export function liveScore(flags: Flag[], now: number) {
  const weight = flags.reduce((sum, flag) => flag.endMs <= now
    ? sum + flag.weight * 2 ** ((flag.endMs - now) / interview.scoreHalfLifeMs)
    : sum, 0);
  return bounded(weight * interview.livePenaltyMultiplier);
}

export function finalScore(flags: Flag[], spokenMs: number) {
  if (spokenMs <= 0) return 0;
  const weight = flags.reduce((sum, flag) => sum + flag.weight, 0);
  return bounded(weight * interview.finalPenaltyMultiplier / (spokenMs / 60_000));
}

export function demoDeduction(weight: number) {
  return weight === 1 ? 1.5 : weight * 2;
}

export function demoFinalScore(flags: Flag[]) {
  return bounded(flags.reduce((total, flag) => total + demoDeduction(flag.weight), 0));
}
