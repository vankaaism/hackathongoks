export type Expression = "idle" | "speaking" | "thinking" | "positive" | "skeptical" | "concerned";

export function Interviewer({ expression, amplitude }: { expression: Expression; amplitude: number }) {
  const skeptical = expression === "skeptical";
  const concerned = expression === "concerned";
  const smile = expression === "positive" || expression === "idle";
  const eyeOffset = skeptical ? 6 : expression === "thinking" ? -4 : 0;
  return <svg className="interviewer-art" data-expression={expression} viewBox="0 0 300 292" aria-hidden="true">
    <ellipse cx="150" cy="279" rx="132" ry="11" fill="#151c17" opacity=".35"/>
    <path d="M92 99c-10-47 17-72 58-72 39 0 69 27 64 75l-5 89H94Z" fill="#32251f"/>
    <path d="M33 280c5-64 39-90 92-100h50c55 10 87 37 92 100Z" fill="#86976a"/>
    <path d="m124 173 26 32 26-32 26 15-52 62-52-62Z" fill="#f6e5cb"/>
    <path d="m108 187 42 63-22 30H52c6-48 20-74 56-93Zm84 0-42 63 22 30h75c-5-48-20-74-55-93Z" fill="#75875c"/>
    <path d="M132 152h36v36l-18 17-18-17Z" fill="#b67454"/>
    <path d="M101 109c-17-11-21 14-8 23l10 4Zm98 0c17-11 21 14 8 23l-10 4Z" fill="#cd916d"/>
    <path d="M104 77c4-33 90-35 93 5l2 37c0 29-20 54-49 54-28 0-49-24-49-53Z" fill="#df9e76"/>
    <path d="M96 109c-6-27 0-57 24-67 25-12 55-7 74 11 12 10 16 25 12 52-20-7-32-19-41-37-13 22-37 32-69 41Z" fill="#3f2e26"/>
    <path d="M103 91c24-4 45-17 56-34" fill="none" stroke="#644a3b" strokeWidth="3" strokeLinecap="round"/>
    <path d="M146 113l-3 16 8 1" fill="none" stroke="#a95f49" strokeWidth="2.5" strokeLinecap="round"/>
    <path d={skeptical ? "M113 106q8-2 16 0m39-3q8-7 16-6" : concerned ? "M114 105l15-5m39 0 16 5" : "M113 104q8-4 16 0m39 0q8-4 16 0"} stroke="#49322a" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
    <ellipse cx={121 + eyeOffset} cy="116" rx="4.5" ry="5.5" fill="#322620"/>
    <ellipse cx={176 + eyeOffset} cy="116" rx="4.5" ry="5.5" fill="#322620"/>
    <circle cx={122 + eyeOffset} cy="114" r="1.2" fill="#fff4e1"/>
    <circle cx={177 + eyeOffset} cy="114" r="1.2" fill="#fff4e1"/>
    <circle cx="103" cy="135" r="3.5" fill="#f0cf86"/>
    <circle cx="197" cy="135" r="3.5" fill="#f0cf86"/>
    {expression === "speaking"
      ? <ellipse cx="150" cy="146" rx={6 + amplitude * 7} ry={2 + amplitude * 9} fill="#744136"/>
      : <path d={smile ? "M140 144q10 9 21 0" : concerned ? "M142 148q8-7 17 0" : "M143 146l15-1"} fill="none" stroke="#814739" strokeWidth="3" strokeLinecap="round"/>}
    <path d="M0 280h300v12H0z" fill="#4d3a2d"/>
    <path d="M0 280h300" stroke="#83674a" strokeWidth="2"/>
  </svg>;
}
