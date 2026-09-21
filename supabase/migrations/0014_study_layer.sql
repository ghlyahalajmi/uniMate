-- =============================================================================
-- UniMate — 0014 study layer
--
-- Completes the backend contract with the three tables the earlier migrations
-- never had — study_plans and streaks — and publishes the agreed
-- names for the three that already exist under different ones.
--
-- Nothing here renames or drops an existing table: `grades`, `tasks` and
-- `question_attempts` carry live data and are referenced throughout the app, so
-- the agreed names are exposed as updatable views over them instead. A view
-- declared `security_invoker` runs the base table's own policies as the caller,
-- so reading `assessments` is exactly as isolated as reading `grades`.
--
-- Flashcards are deliberately not here: main already defines them in
-- 0005_flashcards.sql with Leitner boxes, and that is the one the app uses.
-- =============================================================================

create type public.study_plan_status as enum ('active','completed','archived');

-- ---------------------------------------------------------------------------
-- study_plans — how a student intends to get ready for something.
--
-- A plan hangs off a course and, when it is exam preparation, off the specific
-- assessment it is preparing for. Deleting either takes the plan with it: a
-- revision plan for a dropped course is not a record worth keeping.
-- ---------------------------------------------------------------------------
create table public.study_plans (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  course_id     uuid references public.courses (id) on delete cascade,
  assessment_id uuid references public.grades (id) on delete cascade,
  title         text not null,
  goal          text,
  status        public.study_plan_status not null default 'active',
  starts_on     date,
  ends_on       date,
  -- What the plan asks for in total, so progress can be stated as a fraction
  -- of the commitment rather than as a vague sense of being behind.
  total_minutes int check (total_minutes is null or total_minutes >= 0),
  source        public.record_source not null default 'ai',
  is_demo       boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint study_plans_date_order check (starts_on is null or ends_on is null or ends_on >= starts_on)
);
create index study_plans_user_idx       on public.study_plans (user_id, status);
create index study_plans_course_idx     on public.study_plans (course_id);
create index study_plans_assessment_idx on public.study_plans (assessment_id);
create trigger study_plans_touch before update on public.study_plans
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- study_plan_items — the individual sittings a plan breaks down into.
--
-- An item may point at the task the student actually works from; if that task
-- is deleted the item stays, because the plan is still what was intended.
-- ---------------------------------------------------------------------------
create table public.study_plan_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  plan_id      uuid not null references public.study_plans (id) on delete cascade,
  task_id      uuid references public.tasks (id) on delete set null,
  session_id   uuid references public.study_sessions (id) on delete set null,
  topic        text not null,
  scheduled_on date,
  minutes      int check (minutes is null or minutes between 1 and 1440),
  position     int not null default 0,
  completed_at timestamptz,
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now()
);
create index study_plan_items_plan_idx on public.study_plan_items (plan_id, position);
create index study_plan_items_user_idx  on public.study_plan_items (user_id, scheduled_on);

-- ---------------------------------------------------------------------------
-- streaks — one row per student, derived from activity_days.
--
-- This is a roll-up, never an input. It is rewritten by a trigger whenever the
-- underlying activity changes, so it cannot drift away from the days the
-- student actually did something. The rules match lib/momentum/engine.ts: a day
-- counts when it earned XP, and the current run must end today or yesterday.
-- ---------------------------------------------------------------------------
create table public.streaks (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null unique references auth.users (id) on delete cascade,
  current_streak    int  not null default 0 check (current_streak >= 0),
  longest_streak    int  not null default 0 check (longest_streak >= 0),
  last_active_on    date,
  total_active_days int  not null default 0 check (total_active_days >= 0),
  total_xp          int  not null default 0 check (total_xp >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint streaks_longest_covers_current check (longest_streak >= current_streak)
);
create trigger streaks_touch before update on public.streaks
  for each row execute function public.touch_updated_at();

create or replace function public.refresh_streak(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today   date := current_date;
  v_last    date;
  v_total   int  := 0;
  v_xp      int  := 0;
  v_current int  := 0;
  v_longest int  := 0;
  v_run     int  := 0;
  v_prev    date;
  d         date;
begin
  -- Deleting an account cascades into activity_days, which fires the trigger
  -- below once per day deleted. By then the user is gone, so there is no
  -- streak left to roll up and re-inserting one would violate the key.
  if not exists (select 1 from auth.users where id = p_user_id) then
    return;
  end if;

  select max(day), count(*), coalesce(sum(xp), 0)
    into v_last, v_total, v_xp
    from public.activity_days
   where user_id = p_user_id and xp > 0;

  -- Longest run in the whole history.
  for d in
    select day from public.activity_days
     where user_id = p_user_id and xp > 0
     order by day
  loop
    v_run := case when v_prev is not null and d = v_prev + 1 then v_run + 1 else 1 end;
    if v_run > v_longest then v_longest := v_run; end if;
    v_prev := d;
  end loop;

  -- Current run. A streak that ended yesterday is still alive but unclaimed;
  -- anything older has already been broken.
  if v_last is not null and v_last >= v_today - 1 then
    v_prev := v_last;
    while exists (
      select 1 from public.activity_days
       where user_id = p_user_id and day = v_prev and xp > 0
    ) loop
      v_current := v_current + 1;
      v_prev := v_prev - 1;
    end loop;
  end if;

  insert into public.streaks
    (user_id, current_streak, longest_streak, last_active_on, total_active_days, total_xp)
  values
    (p_user_id, v_current, greatest(v_longest, v_current), v_last, v_total, v_xp)
  on conflict (user_id) do update
     set current_streak    = excluded.current_streak,
         longest_streak    = excluded.longest_streak,
         last_active_on    = excluded.last_active_on,
         total_active_days = excluded.total_active_days,
         total_xp          = excluded.total_xp,
         updated_at        = now();
end;
$$;

-- Nothing needs to call this directly: the trigger below is security definer,
-- so it runs the roll-up as the owner whoever wrote the activity row. Left
-- callable by service_role alone, for operational backfills.
revoke all on function public.refresh_streak(uuid) from public, anon, authenticated;
grant execute on function public.refresh_streak(uuid) to service_role;

create or replace function public.activity_days_refresh_streak()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_streak(coalesce(new.user_id, old.user_id));
  return null;
end;
$$;

create trigger activity_days_streak
  after insert or update or delete on public.activity_days
  for each row execute function public.activity_days_refresh_streak();

-- Every existing student gets a row, so a dashboard never has to cope with a
-- missing streak — a student who has done nothing has a streak of zero.
insert into public.streaks (user_id)
select id from auth.users
on conflict (user_id) do nothing;

do $$
declare u uuid;
begin
  for u in select distinct user_id from public.activity_days loop
    perform public.refresh_streak(u);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- New users get a profile, a grade scale and now a streak row too.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name, preferred_language)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce((new.raw_user_meta_data ->> 'preferred_language')::public.app_language, 'en')
  )
  on conflict (user_id) do nothing;

  insert into public.grade_scale_entries (user_id, letter, min_percent, points, sort_order)
  values
    (new.id, 'A',  93, 4.00, 1),
    (new.id, 'A-', 90, 3.67, 2),
    (new.id, 'B+', 87, 3.33, 3),
    (new.id, 'B',  83, 3.00, 4),
    (new.id, 'B-', 80, 2.67, 5),
    (new.id, 'C+', 77, 2.33, 6),
    (new.id, 'C',  73, 2.00, 7),
    (new.id, 'C-', 70, 1.67, 8),
    (new.id, 'D+', 67, 1.33, 9),
    (new.id, 'D',  60, 1.00, 10),
    (new.id, 'F',   0, 0.00, 11)
  on conflict (user_id, letter) do nothing;

  insert into public.streaks (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row level security, identical in shape to every other table.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['study_plans','study_plan_items','streaks']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',
      t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)',
      t || '_delete_own', t);
  end loop;
end $$;

revoke all on public.study_plans, public.study_plan_items, public.streaks from anon;

-- ---------------------------------------------------------------------------
-- Agreed names for the tables that already existed under different names.
--
-- These are simple single-table views, so PostgreSQL makes them automatically
-- updatable: inserts, updates and deletes go straight through to the base
-- table and pick up its defaults. `security_invoker = true` means the base
-- table's policies are evaluated as the caller, not as the view's owner, so a
-- student still sees only their own rows.
-- ---------------------------------------------------------------------------
create view public.assessments   with (security_invoker = true) as select * from public.grades;
create view public.study_tasks   with (security_invoker = true) as select * from public.tasks;
create view public.quiz_attempts with (security_invoker = true) as select * from public.question_attempts;

comment on view public.assessments   is 'Agreed name for public.grades — one row per graded assessment in a course.';
comment on view public.study_tasks   is 'Agreed name for public.tasks — the student''s to-do items.';
comment on view public.quiz_attempts is 'Agreed name for public.question_attempts — one row per answered practice question.';

grant select, insert, update, delete
  on public.assessments, public.study_tasks, public.quiz_attempts
  to authenticated;
revoke all on public.assessments, public.study_tasks, public.quiz_attempts from anon;

-- 0012 revoked these; this migration replaces the function, so they are
-- restated rather than left to CREATE OR REPLACE's grant-preserving behaviour.
revoke all on function public.handle_new_user() from public, anon, authenticated;
