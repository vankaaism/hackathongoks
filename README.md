# ngblu

ngblu is an interview practice app for students. It uses a CV and a job posting to prepare seven scored questions, transcribes answers, and shows delivery and content feedback in the interview room.

## Run locally

Use Node.js 22 or later and pnpm 10.

```sh
pnpm install
cp .env.example .env.local
pnpm dev
```

Open http://localhost:3000. Upload the fictional [sample CV](seed/cv.pdf) and [job posting](seed/posting.pdf), enter Nusantara Foods as the company, and choose Bahasa Indonesia or English.

- **Token Gateway**: Set `LLM_BASE_URL`, `LLM_MODEL`, and `LLM_API_KEY` for document parsing and coaching.
- **ElevenLabs**: Set `ELEVENLABS_API_KEY` with Text to Speech permission and `ELEVENLABS_VOICE_ID`. Browser speech synthesis handles missing audio.
- **Deepgram**: Set `DEEPGRAM_API_KEY` with Member or higher project permissions so the server can issue temporary browser tokens.
- **Local session storage**: Set `CERMIN_SESSION_STORAGE=local` in `.env.local` to save finished sessions under the ignored `.cermin-local/sessions/` directory.
- **Supabase**: For a new database, apply the [schema](supabase/migrations/202611210001_cermin.sql) first. If the agent pack schema is already installed, apply only the [save function migration](supabase/migrations/202611210002_save_session.sql). Set `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The server saves finished sessions in a database transaction.

The [replay page](http://localhost:3000/replay) runs its 90-second recorded transcript locally once the page loads. It uses the same feedback panels as live practice and skips provider calls.

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

The [build plan](cermin-agent-pack/docs/BUILD_PLAN.md) records demo acceptance checks. See the [Graphify report](graphify-out/GRAPH_REPORT.md) for source context.
