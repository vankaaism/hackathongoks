import { describe, expect, it } from "vitest";
import { detectFlags } from "./heuristics";
import { evaluateComposure, initialComposure } from "./composure";
import { finalScore, liveScore } from "../scoring";

const words = ["Um", "uh", "like", "you", "know", "I", "worked."].map((text, i) => ({
  text, startMs: 100 + i * 200, endMs: 200 + i * 200, isFinal: true,
}));

describe("delivery analysis", () => {
  it("groups spoken fillers, includes a trailing pause, escalates, and waits eight seconds to recover", () => {
    const flags = detectFlags(words, 0, "en", 0, 5400);
    expect(flags.filter(flag => flag.type === "filler")).toHaveLength(4);
    expect(flags.find(flag => flag.type === "long_pause")?.endMs).toBe(4400);
    const raised = evaluateComposure(initialComposure, flags, 5400);
    expect(raised.level).toBe(1);
    const cooling = evaluateComposure(raised, flags, 50_000);
    expect(evaluateComposure(cooling, flags, 57_999).level).toBe(1);
    expect(evaluateComposure(cooling, flags, 58_000).level).toBe(0);
  });

  it("flags a first-word delay once and recognizes repeated phrase starts", () => {
    const repeated = ["Saya", "bisa", "saya", "bisa"].map((text, i) => ({
      text, startMs: 3100 + i * 200, endMs: 3200 + i * 200, isFinal: true,
    }));
    const flags = detectFlags(repeated, 0, "id", 0, 4000);
    expect(flags.map(flag => flag.type)).toEqual(["long_pause", "restart"]);
  });

  it("decays live penalties and bounds final performance", () => {
    const flags = detectFlags(words, 0, "en", 0, 5400);
    expect(liveScore(flags, 5400)).toBeLessThan(liveScore(flags, 65_400));
    expect(finalScore(flags, 60_000)).toBe(64);
    expect(finalScore(flags, 1000)).toBe(0);
  });
});
