create unique index if not exists cermin_turns_session_idx on turns (session_id, idx);
create unique index if not exists cermin_words_turn_idx on words (turn_id, idx);

create or replace function public.save_cermin_session(p jsonb)
returns void language plpgsql set search_path = public as $$
declare
  sid uuid := (p->>'id')::uuid;
  entry jsonb;
  tid uuid;
  answer_ids uuid[] := array[]::uuid[];
begin
  insert into sessions (id,company_name,language,effect_level_pref,cv_json,posting_json,question_plan_json,status,started_at,ended_at,final_score)
  values (sid,p->>'company',p->>'language',p->>'effect',p->'cv',p->'posting',p->'plan','done',
    (p->>'startedAt')::timestamptz,now(),(p->>'finalScore')::int);
  for entry in select * from jsonb_array_elements(p->'turns') loop
    insert into turns(session_id,idx,speaker,text,start_ms,end_ms,question_focus)
    values (sid,(entry->>'question')::int*2,'interviewer',entry->>'prompt',(entry->>'promptStart')::int,
      (entry->>'promptEnd')::int,entry->>'focus');
    insert into turns(session_id,idx,speaker,text,start_ms,end_ms,answer_score)
    values (sid,(entry->>'question')::int*2+1,'student',entry->>'text',(entry->>'startMs')::int,
      (entry->>'endMs')::int,(entry->>'score')::int) returning id into tid;
    answer_ids[(entry->>'question')::int+1] := tid;
    insert into words(turn_id,idx,text,start_ms,end_ms)
    select tid, ord::int-1, w->>'text',(w->>'startMs')::int,(w->>'endMs')::int
    from jsonb_array_elements(entry->'words') with ordinality as x(w,ord);
  end loop;
  insert into blunders(session_id,turn_id,category,type,severity,weight,start_ms,end_ms,word_start_idx,word_end_idx,source,explanation,suggestion,status)
  select sid,answer_ids[(f->>'question')::int+1],f->>'category',f->>'type',(f->>'severity')::int,(f->>'weight')::int,
    (f->>'startMs')::int,(f->>'endMs')::int,(f->>'startWord')::int,(f->>'endWord')::int,
    f->>'source',f->>'explanation',f->>'suggestion',f->>'status'
  from jsonb_array_elements(p->'flags') as x(f);
  insert into score_points(session_id,t_ms,score)
  select sid,(e->>'time')::int,(e->>'score')::int from jsonb_array_elements(p->'scores') as x(e);
  insert into effect_events(session_id,t_ms,level,composure_load)
  select sid,(e->>'time')::int,(e->>'level')::int,(e->>'load')::real from jsonb_array_elements(p->'effects') as x(e);
  insert into marked_spans(session_id,turn_id,word_start_idx,word_end_idx)
  select sid,answer_ids[(m->>'question')::int+1],(m->>'startWord')::int,(m->>'endWord')::int
  from jsonb_array_elements(p->'marks') as x(m);
  insert into summaries(session_id,top_weaknesses_json,strength,recommendations_json)
  values (sid,p->'summary'->'top_weaknesses',p->'summary'->>'strength',p->'summary'->'recommendations');
exception when unique_violation then
  if exists(select 1 from sessions where id = sid and status = 'done') then return; end if;
  raise;
end;
$$;
revoke all on function public.save_cermin_session(jsonb) from public, anon, authenticated;
grant execute on function public.save_cermin_session(jsonb) to service_role;
grant select, insert on public.sessions, public.turns, public.words, public.blunders,
  public.score_points, public.effect_events, public.marked_spans, public.summaries to service_role;
grant usage on sequence public.words_id_seq, public.score_points_id_seq, public.effect_events_id_seq to service_role;
