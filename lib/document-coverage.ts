import type { Documents } from "./llm/schemas";

const stop = new Set("dan atau dengan yang untuk pada dalam mampu memiliki menguasai memahami pengalaman kemampuan dasar a an the with and or in using experience ability knowledge of to required".split(" "));
const words = (text: string) => [...new Set((text.toLowerCase().match(/[\p{L}\p{N}+#]+/gu) ?? []).filter(word => word.length > 1 && !stop.has(word)))];

export function documentCoverage({ cv, posting }: Documents) {
  const evidence = [
    ...cv.skills,
    ...cv.education.map(item => [item.degree, item.school].filter(Boolean).join(" ")),
    ...cv.experience.flatMap(item => [[item.role, item.org].filter(Boolean).join(" "), ...item.highlights]),
    ...cv.projects.map(item => [item.name, item.summary].filter(Boolean).join(" ")),
  ].filter(Boolean).map(text => ({ text, tokens: new Set(words(text)) }));
  const requirements = new Map<string, { requirement: string; optional: boolean }>();
  for (const [list, optional] of [[posting.requirements, false], [posting.nice_to_have, true]] as const) {
    for (const raw of list) {
      const requirement = raw.trim();
      if (requirement && !requirements.has(requirement.toLowerCase())) requirements.set(requirement.toLowerCase(), { requirement, optional });
    }
  }
  const rows = [...requirements.values()].map(row => {
    const tokens = words(row.requirement);
    let best = { text: "", count: 0 };
    for (const item of evidence) {
      const count = tokens.filter(token => item.tokens.has(token)).length;
      if (count > best.count) best = { text: item.text, count };
    }
    const status = best.count === 0 ? "none" : best.count === tokens.length && !/\b(?:or|atau|and|dan)\b/i.test(row.requirement) ? "full" : "partial";
    return { ...row, evidence: best.text, status };
  });
  const total = rows.reduce((sum, row) => sum + (row.optional ? 1 : 2), 0);
  const score = rows.reduce((sum, row) => sum + (row.optional ? 1 : 2) * (row.status === "full" ? 1 : row.status === "partial" ? .5 : 0), 0);
  return { rows, percent: total ? Math.round(score * 100 / total) : 0 };
}
