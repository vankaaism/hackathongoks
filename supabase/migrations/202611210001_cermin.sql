-- Supabase / Postgres schema for Cermin
create extension if not exists "pgcrypto";

create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  role text not null default 'student' check (role in ('student','counselor')),
  created_at timestamptz not null default now()
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),            -- nullable for anonymous demo
  company_name text not null,
  language text not null default 'en' check (language in ('en','id')),
  effect_level_pref text not null default 'gentle' check (effect_level_pref in ('off','gentle','full')),
  cv_json jsonb,
  posting_json jsonb,
  question_plan_json jsonb,
  status text not null default 'setup' check (status in ('setup','live','done')),
  started_at timestamptz,
  ended_at timestamptz,
  final_score int,
  share_token text unique,                      -- set only when student presses Share
  created_at timestamptz not null default now()
);

create table turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  idx int not null,
  speaker text not null check (speaker in ('interviewer','student')),
  text text not null,
  start_ms int not null,
  end_ms int,
  answer_score int,
  question_focus text
);

create table words (
  id bigserial primary key,
  turn_id uuid not null references turns(id) on delete cascade,
  idx int not null,
  text text not null,
  start_ms int not null,
  end_ms int not null,
  confidence real,
  is_final boolean not null default true
);

create table blunders (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  turn_id uuid references turns(id) on delete cascade,
  category text not null check (category in ('Fluency','Clarity','Evidence','Consistency','Composure')),
  type text not null,                           -- filler, long_pause, restart, rate_spike, hedging, rambling, off_topic, vague_claim, cv_contradiction
  severity int not null check (severity between 1 and 3),
  weight int not null,
  start_ms int not null,
  end_ms int not null,
  word_start_idx int,
  word_end_idx int,
  source text not null check (source in ('heuristic','llm')),
  explanation text,
  suggestion text,
  status text not null default 'open' check (status in ('open','got_it','dismissed'))
);

create table score_points (
  id bigserial primary key,
  session_id uuid not null references sessions(id) on delete cascade,
  t_ms int not null,
  score int not null check (score between 0 and 100)
);

create table effect_events (
  id bigserial primary key,
  session_id uuid not null references sessions(id) on delete cascade,
  t_ms int not null,
  level int not null check (level between 0 and 3),
  cause_category text,
  composure_load real
);

create table marked_spans (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  turn_id uuid not null references turns(id) on delete cascade,
  word_start_idx int not null,
  word_end_idx int not null,
  note text,
  created_at timestamptz not null default now()
);

create table summaries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references sessions(id) on delete cascade,
  top_weaknesses_json jsonb not null,
  strength text,
  recommendations_json jsonb not null
);

create index on turns (session_id, idx);
create index on words (turn_id, idx);
create index on blunders (session_id, start_ms);
create index on score_points (session_id, t_ms);

-- Hackathon note: enable RLS before real students use it.
-- Students read/write only rows whose session.user_id = auth.uid(); counselors read only sessions with share_token set.

alter table users enable row level security;
alter table sessions enable row level security;
alter table turns enable row level security;
alter table words enable row level security;
alter table blunders enable row level security;
alter table score_points enable row level security;
alter table effect_events enable row level security;
alter table marked_spans enable row level security;
alter table summaries enable row level security;
