-- =============================================================================
-- UniMate — row level security isolation test
--
-- Run against a database that already has the migrations and the demo seed:
--   psql "$DATABASE_URL" -f supabase/tests/rls_isolation_test.sql
--
-- Every line must print PASS. A FAIL means one student can reach another
-- student's records.
-- =============================================================================

\set sara   '4f6d1a52-9c8e-4c0b-9a1e-0b7c2d5e8f31'
\set yousef 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

-- A second student to test against.
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', :'yousef', 'authenticated', 'authenticated',
        'yousef.alrashid@demo.unimate.app', '{"full_name":"Yousef Al-Rashid"}'::jsonb, now(), now())
on conflict (id) do nothing;

insert into public.courses (user_id, course_code, course_name, credits, semester, status)
values (:'yousef', 'BUS101', 'Principles of Management', 3, 'Fall 2026', 'active')
on conflict do nothing;

set role authenticated;
set request.jwt.claim.sub = :'yousef';

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s courses'
  from public.courses where user_id = :'sara';

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s grades'
  from public.grades where user_id = :'sara';

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s tasks'
  from public.tasks where user_id = :'sara';

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s syllabi'
  from public.syllabi where user_id = :'sara';

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s AI activity'
  from public.ai_runs where user_id = :'sara';

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s study history'
  from public.study_sessions where user_id = :'sara';

select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot read another student''s profile'
  from public.profiles where user_id = :'sara';

with u as (update public.courses set course_name = 'TAMPERED'
           where user_id = :'sara' returning 1)
select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot update another student''s courses' from u;

with d as (delete from public.grades where user_id = :'sara' returning 1)
select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot delete another student''s grades' from d;

with p as (update public.profiles set full_name = 'TAMPERED'
           where user_id = :'sara' returning 1)
select case when count(*) = 0 then 'PASS' else 'FAIL' end
       || ' — cannot update another student''s profile' from p;

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
