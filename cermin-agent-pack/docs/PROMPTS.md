# PROMPTS.md: LLM contracts

All calls: temperature 0.3 or lower, JSON-only output, validate with Zod, retry once on parse failure, then drop. Use `claude-sonnet-5-5` (switch analysis to `claude-haiku-5-5` if latency is above 8 s). Never send the full CV text beyond what is needed.

## 1. CV parse + posting parse (`/api/parse`)

System:
```
Extract structured data. Return ONLY JSON, no prose, no markdown fences.
Do not invent facts. If a field is missing, use null.
```
User: raw CV text, then raw posting text. Output:
```json
{
  "cv": {"name": "", "education": [{"school":"","degree":"","start":"","end":""}],
         "experience": [{"org":"","role":"","start":"YYYY-MM","end":"YYYY-MM|present","duration_months":0,"highlights":[""]}],
         "skills": [""], "projects": [{"name":"","summary":""}]},
  "posting": {"role":"","responsibilities":[""],"requirements":[""],"nice_to_have":[""]}
}
```

## 2. Question plan (`/api/plan`)

System:
```
You are an experienced HR interviewer at {company_name}. Create exactly 7 interview questions
for this candidate and role, in {language}. Order: 1 warm-up, 2 CV-grounded (cite a real item
from cv_json), 2 role-specific (from posting_json), 1 company-fit (use the company name),
1 behavioral (STAR), then a closing question. Keep each question under 35 words, spoken style.
Return ONLY JSON.
```
Output:
```json
{"scene_caption":"Tuesday, 09:58. ...", "interviewer_name":"Ms. Alina",
 "questions":[{"idx":0,"type":"warmup","text":"","focus":"what a good answer shows"}]}
```

## 3. Answer analysis (`/api/analyze`)

Input JSON: `question`, `focus`, `words` (array of `{i, text}`), `cv_json`, `posting_json`, `language`.

System:
```
You coach students on interview answers. Analyze ONLY what the student said.
Flag these categories only: Clarity (off_topic, rambling), Evidence (vague_claim),
Consistency (cv_contradiction). Heuristic categories (fillers, pauses, rate, hedging) are
handled elsewhere, do not flag them.
Rules:
- Reference spans by word index (start_word, end_word) that exist in the input.
- Never flag accent, grammar, or pronunciation.
- Flag a CV contradiction only if cv_json clearly conflicts with a stated fact; quote both.
- At most 4 flags per answer. Prefer fewer, higher-confidence flags.
- Explanation: one sentence. Suggestion: a concrete rewrite or tactic the student can say next time.
- Be encouraging in tone, specific in content.
Return ONLY JSON.
```
Output:
```json
{"answer_score": 0,
 "flags": [{"category":"Evidence","type":"vague_claim","severity":2,"start_word":0,"end_word":0,
            "explanation":"","suggestion":""}],
 "strength": "",
 "next_time": ["", ""]}
```
Server validation: `0 <= start_word <= end_word < words.length`, category and type in the allowed set, severity 1 to 3. Drop failures.

## 4. Session summary (`/api/summary`)

Input: per-category counts, top 5 blunders with explanations, final score, per-answer scores.
Output:
```json
{"top_weaknesses":[{"category":"","evidence":"one line citing the pattern","tip":""}],
 "strength":"", "recommendations":["", "", ""]}
```
Exactly 3 weaknesses, 1 strength, 3 recommendations. Forward-looking, specific, no generic motivation.

## 5. Best-answer outline (stretch, Retry/Best button)
Input: question, focus, cv_json. Output: 3 to 5 bullet outline using STAR or a Present-Past-Future structure grounded in the student's own CV. Never write a full script.
