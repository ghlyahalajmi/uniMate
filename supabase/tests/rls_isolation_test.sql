-- =============================================================================
-- UniMate — row level security isolation test
--
-- Run against a database that already has the migrations and the demo seed:
--   psql "$DATABASE_URL" -f supabase/tests/rls_isolation_test.sql
--
-- Every line must print PASS. A FAIL means one student can reach another
-- student's records.
-- =============================================================================

\set danah  '4f6d1a52-9c8e-4c0b-9a1e-0b7c2d5e8f31'
\set yousef 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

-- A second student to test against.
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', :'yousef', 'authenticated', 'authenticated',
        'yousef.alrashid@demo.unimate.app', '{"full_name":"Yousef Al-Rashid"}'::jsonb, now(), now())
on conflict (id) do nothing;

insert into public.courses (user_id, course_code, course_name, credits, semester, status)
values (:'yousef', 'BUS101', 'Principles of Management', 3, 'Fall 2026', 'active')
on conflict do nothing;

-- Study-layer rows owned by Danah, so the reads below are tested against data
-- that genuinely exists rather than an empty table.
insert into public.study_plans (user_id, title, goal, status)
values (:'danah', 'Midterm revision', 'Two weeks of spaced revision', 'active')
on conflict do nothing;

insert into public.flashcards (user_id, front, back, topic)
values (:'danah', 'What does RLS stand for?', 'Row level security', 'Databases')
on conflict do nothing;

set role authenticated;
set request.jwt.claim.sub = :'yousef';

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s courses'
  from public.courses where user_id = :'danah';

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s grades'
  from public.grades where user_id = :'danah';

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s tasks'
  from public.tasks where user_id = :'danah';

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s syllabi'
  from public.syllabi where user_id = :'danah';

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s AI activity'
  from public.ai_runs where user_id = :'danah';

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s study history'
  from public.study_sessions where user_id = :'danah';

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s study plans'
  from public.study_plans where user_id = :'danah';

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s flashcards'
  from public.flashcards where user_id = :'danah';

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s streak'
  from public.streaks where user_id = :'danah';

-- The agreed-name views must be exactly as isolated as the tables behind them.
select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s assessments (view)'
  from public.assessments where user_id = :'danah';

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s study_tasks (view)'
  from public.study_tasks where user_id = :'danah';

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s quiz_attempts (view)'
  from public.quiz_attempts where user_id = :'danah';

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s profile'
  from public.profiles where user_id = :'danah';

with u as (update public.courses set course_name = 'TAMPERED'
           where user_id = :'danah' returning 1)
select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot update another student''s courses' from u;

with d as (delete from public.grades where user_id = :'danah' returning 1)
select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot delete another student''s grades' from d;

with p as (update public.profiles set full_name = 'TAMPERED'
           where user_id = :'danah' returning 1)
select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot update another student''s profile' from p;

with f as (update public.flashcards set back = 'TAMPERED'
           where user_id = :'danah' returning 1)
select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot update another student''s flashcards' from f;

with s as (update public.streaks set current_streak = 999
           where user_id = :'danah' returning 1)
select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot inflate another student''s streak' from s;

-- A write through a view must be refused for the same reason a direct one is.
with v as (update public.study_tasks set title = 'TAMPERED'
           where user_id = :'danah' returning 1)
select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot update another student''s tasks through study_tasks' from v;

-- Ownership is checked on write, not just on read: a row cannot be filed
-- under someone else's user_id.
do $$
declare ok boolean := false;
begin
  begin
    insert into public.flashcards (user_id, front, back)
    values ('4f6d1a52-9c8e-4c0b-9a1e-0b7c2d5e8f31', 'planted', 'planted');
  exception when insufficient_privilege then
    ok := true;
  end;
  raise notice '% — cannot insert a flashcard owned by another student',
    case when ok then 'PASS' else 'FAIL' end;
end $$;

reset role;

-- Anonymous visitors hold no grants at all.
do $$
declare ok boolean := false;
begin
  begin
    set local role anon;
    perform count(*) from public.courses;
  exception when insufficient_privilege then
    ok := true;
  end;
  reset role;
  raise notice '% — anonymous role cannot read courses', case when ok then 'PASS' else 'FAIL' end;
end $$;

-- The views are new API surface, so they get the same anonymous check.
do $$
declare
  v    text;
  ok   boolean;
begin
  foreach v in array array['assessments','study_tasks','quiz_attempts','study_plans','flashcards','streaks']
  loop
    ok := false;
    begin
      set local role anon;
      execute format('select count(*) from public.%I', v);
    exception when insufficient_privilege then
      ok := true;
    end;
    reset role;
    raise notice '% — anonymous role cannot read %', case when ok then 'PASS' else 'FAIL' end, v;
  end loop;
end $$;
