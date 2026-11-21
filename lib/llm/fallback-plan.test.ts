import { expect, it } from "vitest";
import { groundedPlan } from "./fallback-plan";

it("keeps seven short questions grounded in the CV and posting for both languages", () => {
  const input = {
    company: "Nusantara Foods",
    cv: {
      name: "Rania", education: [], projects: [], skills: ["Excel"],
      experience: [{ org: "Campus Cooperative", role: "Operations Intern", start: null, end: null, duration_months: null, highlights: [] }],
    },
    posting: {
      role: "Management Trainee", responsibilities: ["check weekly inventory"],
      requirements: ["present recommendations to store managers"], nice_to_have: [],
    },
  };

  for (const language of ["id", "en"] as const) {
    const plan = groundedPlan({ ...input, language });
    expect(plan.questions.map(question => question.type)).toEqual(["warmup", "cv", "cv", "role", "role", "company", "behavioral"]);
    expect(plan.questions[1].text).toContain("Operations Intern");
    expect(plan.questions[2].text).toContain("Excel");
    expect(plan.questions[3].text).toContain("check weekly inventory");
    expect(plan.questions[5].text).toContain("Nusantara Foods");
  }
});
