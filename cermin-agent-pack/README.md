# Cermin Agent Pack

Context bundle for a coding agent (Claude Code, Cursor, Codex or similar) to build **Cermin**, a 3-panel AI interview practice web app for a university Career Development Center (CDC), during a 24 to 48 hour hackathon.

## Read order for the agent

1. `AGENTS.md` : rules, stack, commands, definition of done (also copied as `CLAUDE.md`)
2. `docs/PRD_SPEC.md` : what to build, with every threshold and number
3. `docs/TECH_STACK.md` : which tools to use, which to skip, and why
4. `docs/DESIGN_BRIEF.md` : look and feel, tied to the 3 reference images in `assets/reference/`
5. `docs/DATA_MODEL.sql` : Supabase/Postgres schema
6. `docs/PROMPTS.md` : LLM prompts and JSON contracts
7. `docs/BUILD_PLAN.md` : ordered tasks with acceptance checks
8. `skills/README.md` : which bundled skill to invoke at which step

## Quick start for the human

```bash
# 1. unzip, open the folder in your agent
# 2. copy env template and fill keys
cp .env.example .env.local
# 3. tell the agent:
"Read README.md, then AGENTS.md, then execute docs/BUILD_PLAN.md phase by phase. Stop after each phase and show me the demo checklist."
```

## Reference images

| File | Informs |
|------|---------|
| `assets/reference/image-1-grammarly-left-panel.png` | Left panel: inline underlines, suggestion card, category bar |
| `assets/reference/image-2-duolingo-center-panel.png` | Center panel: flat animated character, framing, green call button |
| `assets/reference/image-3-chesscom-right-panel.png` | Right panel: graph with dots, blunder card, Retry/Best/Next, event list |

The full PRD lives in the Claude Doc "PRD: Cermin, AI Interview Awareness Coach for CDC". `docs/PRD_SPEC.md` is the agent-ready condensed version.

## Bundled skills note

The folders in `skills/` are copies of skills installed in the author's Claude account. Check each skill's original license before redistributing this pack publicly. `frontend-design` ships with its own LICENSE.txt.
