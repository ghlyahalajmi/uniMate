-- =============================================================================
-- UniMate — row level security isolation test
--
-- Run against a database that already has the migrations and the demo seed:
--   psql "$DATABASE_URL" -f supabase/tests/rls_isolation_test.sql
--
-- Every line must print PASS. A FAIL means one student can reach another
-- student's records.
-- =============================================================================

\set dana  '4f6d1a52-9c8e-4c0b-9a1e-0b7c2d5e8f31'
\set yousef 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

-- A second student to test against.
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', :'yousef', 'authenticated', 'authenticated',
        'yousef.alrashid@demo.unimate.app', '{"full_name":"Yousef Al-Rashid"}'::jsonb, now(), now())
on conflict (id) do nothing;

insert into public.courses (user_id, course_code, course_name, credits, semester, status)
values (:'yousef', 'BUS101', 'Principles of Management', 3, 'Fall 2026', 'active')
on conflict do nothing;

-- A note of Dana's, with a line in it, to read against.
with n as (
  insert into public.notes (user_id, title) values (:'dana', 'Before Sunday')
  returning id
)
insert into public.note_items (user_id, note_id, content, position)
select :'dana', n.id, 'Return library books', 0 from n;

-- Study-layer and coach rows of Dana's, so the reads below are tested against
-- data that genuinely exists rather than an empty table.
insert into public.study_plans (user_id, title, goal, status)
values (:'dana', 'Midterm revision', 'Two weeks of spaced revision', 'active')
on conflict do nothing;

insert into public.milestones (user_id, code, target, current_progress)
values (:'dana', 'tasks_10', 10, 7)
on conflict (user_id, code) do nothing;

insert into public.motivation_logs (user_id, message, trigger, tone)
values (:'dana', 'A strong week — keep the momentum going.', 'daily_coach', 'positive');

set role authenticated;
set request.jwt.claim.sub = :'yousef';

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s courses'
  from public.courses where user_id = :'dana';

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s grades'
  from public.grades where user_id = :'dana';

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s tasks'
  from public.tasks where user_id = :'dana';

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s syllabi'
  from public.syllabi where user_id = :'dana';

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s AI activity'
  from public.ai_runs where user_id = :'dana';

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s study history'
  from public.study_sessions where user_id = :'dana';

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s notes'
  from public.notes where user_id = :'dana';

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s note lines'
  from public.note_items where user_id = :'dana';

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s profile'
  from public.profiles where user_id = :'dana';

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s study plans'
  from public.study_plans where user_id = :'dana';

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s streak'
  from public.streaks where user_id = :'dana';

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s milestones'
  from public.milestones where user_id = :'dana';

-- What a student was told is as private as the records behind it.
select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s coaching history'
  from public.motivation_logs where user_id = :'dana';

-- The agreed-name views must be exactly as isolated as the tables behind them.
select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s assessments (view)'
  from public.assessments where user_id = :'dana';

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s study_tasks (view)'
  from public.study_tasks where user_id = :'dana';

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s quiz_attempts (view)'
  from public.quiz_attempts where user_id = :'dana';

with u as (update public.courses set course_name = 'TAMPERED'
           where user_id = :'dana' returning 1)
select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot update another student''s courses' from u;

with d as (delete from public.grades where user_id = :'dana' returning 1)
select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot delete another student''s grades' from d;

with p as (update public.profiles set full_name = 'TAMPERED'
           where user_id = :'dana' returning 1)
select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot update another student''s profile' from p;

with s as (update public.streaks set current_streak = 999
           where user_id = :'dana' returning 1)
select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot inflate another student''s streak' from s;

with m as (update public.milestones set current_progress = 10, status = 'completed',
                                        completed_at = now()
           where user_id = :'dana' returning 1)
select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot complete another student''s milestone' from m;

-- A write through a view must be refused for the same reason a direct one is.
with v as (update public.study_tasks set title = 'TAMPERED'
           where user_id = :'dana' returning 1)
select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot update another student''s tasks through study_tasks' from v;

-- ---------------------------------------------------------------------------
-- Naming the row directly, which is what "change the id in the URL" means.
--
-- Every check above filters by `user_id`, so a policy that scoped on the wrong
-- column could still pass them. These ask for one specific row by its primary
-- key instead — the shape /courses/<id> actually takes, and the shape
-- `getCourse(id)` uses, which filters by id alone and leans on RLS entirely.
-- ---------------------------------------------------------------------------
reset role;

create temp table dana_rows as
select (select id from public.courses where user_id = :'dana' limit 1) as course_id,
       (select id from public.grades  where user_id = :'dana' limit 1) as grade_id,
       (select id from public.tasks   where user_id = :'dana' limit 1) as task_id,
       (select id from public.notes   where user_id = :'dana' limit 1) as note_id;

-- A temp table belongs to the session role, and the checks below run as
-- `authenticated`, which would otherwise be refused before RLS is even
-- consulted — a permission error, not a PASS.
grant select on dana_rows to authenticated;

set role authenticated;
set request.jwt.claim.sub = :'yousef';

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s course by its id'
  from public.courses where id = (select course_id from dana_rows);

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s grade by its id'
  from public.grades where id = (select grade_id from dana_rows);

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s task by its id'
  from public.tasks where id = (select task_id from dana_rows);

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s note by its id'
  from public.notes where id = (select note_id from dana_rows);

-- The lines inside a note are the note; reaching them by the parent's id must
-- fail for the same reason reaching the note does.
select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s note lines by the note id'
  from public.note_items where note_id = (select note_id from dana_rows);

-- ---------------------------------------------------------------------------
-- Writing INTO another student's account.
--
-- The update and delete checks above prove existing rows cannot be changed.
-- This is the other direction: planting a new row that claims to be theirs.
-- RLS raises rather than returning zero here, so the failure is caught.
-- ---------------------------------------------------------------------------
do $$
declare ok boolean := false;
begin
  begin
    insert into public.tasks (user_id, title)
    values ('4f6d1a52-9c8e-4c0b-9a1e-0b7c2d5e8f31', 'planted by another student');
  exception when insufficient_privilege or check_violation then
    ok := true;
  end;
  raise notice '% — cannot plant a task in another student''s account',
    case when ok then 'PASS' else 'FAIL' end;
end $$;

do $$
declare ok boolean := false;
begin
  begin
    insert into public.notes (user_id, title)
    values ('4f6d1a52-9c8e-4c0b-9a1e-0b7c2d5e8f31', 'planted note');
  exception when insufficient_privilege or check_violation then
    ok := true;
  end;
  raise notice '% — cannot plant a note in another student''s account',
    case when ok then 'PASS' else 'FAIL' end;
end $$;

-- ---------------------------------------------------------------------------
-- Study groups are shared on purpose, which makes them the easiest place to
-- over-share. Membership is the boundary: a student who has joined nothing
-- must see no roster, no meeting and no attendance.
-- ---------------------------------------------------------------------------
select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — sees no group roster without joining a group'
  from public.group_members;

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — sees no meetings of groups not joined'
  from public.group_meetings;

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — sees no attendance of groups not joined'
  from public.meeting_attendance;

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

-- The new tables and views get the same anonymous check as everything else.
do $$
declare v text; ok boolean;
begin
  foreach v in array array['assessments','study_tasks','quiz_attempts',
                           'study_plans','streaks','milestones','motivation_logs']
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
