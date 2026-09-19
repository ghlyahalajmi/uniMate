-- =============================================================================
-- UniMate — 0004 momentum
--
-- Streaks, XP and achievements. Every point here is earned by something the
-- student actually did and that is already recorded elsewhere: a task moved to
-- completed, a practice session finished, focus minutes logged. Nothing in
-- this layer invents progress.
-- =============================================================================

create type public.activity_kind as enum ('task','practice','focus','grade');

-- ---------------------------------------------------------------------------
-- activity_days — one row per student per day they did something.
-- The streak is derived from which days have a row, so it can never drift
-- from the underlying records.
-- ---------------------------------------------------------------------------
create table public.activity_days (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  day                date not null,
  tasks_completed    int  not null default 0 check (tasks_completed >= 0),
  practice_sessions  int  not null default 0 check (practice_sessions >= 0),
  questions_answered int  not null default 0 check (questions_answered >= 0),
  focus_minutes      int  not null default 0 check (focus_minutes >= 0),
  grades_logged      int  not null default 0 check (grades_logged >= 0),
  -- Capped per day by the engine so the streak rewards showing up, not grinding.
  xp                 int  not null default 0 check (xp >= 0 and xp <= 400),
  is_demo            boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, day)
);
create index activity_days_user_day_idx on public.activity_days (user_id, day desc);
create trigger activity_days_touch before update on public.activity_days
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- achievements — unlocked once, never revoked.
-- `code` is validated by the application against a fixed catalogue; keeping it
-- text means adding one is a code change, not a migration.
-- ---------------------------------------------------------------------------
create table public.achievements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  code        text not null,
  -- The record that earned it, so the UI can say why rather than just "unlocked".
  evidence    text,
  is_demo     boolean not null default false,
  unlocked_at timestamptz not null default now(),
  unique (user_id, code)
);
create index achievements_user_idx on public.achievements (user_id, unlocked_at desc);

-- ---------------------------------------------------------------------------
-- Profile additions.
-- A freeze covers one missed day. Two is enough to survive an exam week
-- without making the streak meaningless.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column streak_freezes int not null default 2 check (streak_freezes between 0 and 5),
  add column momentum_enabled boolean not null default true;

-- ---------------------------------------------------------------------------
-- Same row level security as every other table.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['activity_days','achievements']
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

revoke all on public.activity_days, public.achievements from anon;
