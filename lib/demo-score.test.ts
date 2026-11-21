import { expect, it } from "vitest";
import { seedReplay } from "./replay";
import { demoDeduction, demoFinalScore } from "./scoring";

it("explains the demo score using actual findings across all five categories", () => {
  const { flags } = seedReplay;
  expect(flags.filter(flag => flag.type === "filler")).toHaveLength(3);
  expect(new Set(flags.map(flag => flag.category))).toEqual(new Set(["Fluency", "Clarity", "Evidence", "Consistency", "Composure"]));
  expect(flags.reduce((sum, flag) => sum + demoDeduction(flag.weight), 0)).toBe(38);
  expect(demoFinalScore(flags)).toBe(62);
});
