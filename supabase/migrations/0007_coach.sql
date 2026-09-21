-- =============================================================================
-- UniMate — 0007 coach
--
-- The progress and motivation layer. Two tables only, because almost
-- everything the coach says is *derived* from records that already exist:
-- activity_days, tasks, study_sessions, question_attempts, grades, streaks.
-- Storing a computed figure would let it drift from the work behind it.
--
-- What genuinely needs storing is what cannot be recomputed:
--   * which milestone the student is currently working toward, and when each
--     was reached, so a milestone is celebrated once and never re-celebrated;
--   * what the coach has already said, so it does not repeat itself and so
--     every message can be audited against the data it claimed.
-- =============================================================================

create type public.milestone_status as enum ('active','completed');

-- ---------------------------------------------------------------------------
-- milestones — the next achievable goal, one row per goal per student.
--
-- `code` names a rule in lib/coach/milestones.ts; `target` and `current_progress`
-- are cached there so the bar can render without recomputing the whole history,
-- but the code remains the source of truth and refreshes them.
-- ---------------------------------------------------------------------------
create table public.milestones (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  code             text not null,
  target           int  not null check (target > 0),
  current_progress int  not null default 0 check (current_progress >= 0),
  status           public.milestone_status not null default 'active',
  completed_at     timestamptz,
  -- Set once the celebration has been shown, so it happens exactly once even
  -- if the student reloads the page.
  celebrated_at    timestamptz,
  is_demo          boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, code),
  constraint milestones_completed_has_time check (status = 'active' or completed_at is not null)
);
create index milestones_user_idx on public.milestones (user_id, status);
create trigger milestones_touch before update on public.milestones
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- motivation_logs — every line the coach has shown the student.
--
-- `context` carries the figures the message was built from. That is what makes
-- the "never invent progress" rule checkable after the fact rather than a
-- promise: the claim and its evidence are stored together.
-- ---------------------------------------------------------------------------
create table public.motivation_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  message    text not null,
  -- Which moment produced it: daily_coach, task_completed, milestone_reached…
  trigger    text not null,
  -- positive | steady | encouraging — never negative. The interface tones on
  -- this, and there is deliberately no "bad" value to tone on.
  tone       text not null default 'steady',
  context    jsonb,
  -- Set when the AI wrote it rather than the deterministic rules, so the two
  -- can be told apart when reviewing what a student was told.
  from_ai    boolean not null default false,
  is_demo    boolean not null default false,
  created_at timestamptz not null default now(),
  constraint motivation_logs_tone check (tone in ('positive','steady','encouraging')),
  constraint motivation_logs_message_length check (char_length(message) between 1 and 2000)
);
create index motivation_logs_user_idx on public.motivation_logs (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Profile addition: how many credits this degree actually needs.
--
-- Graduation progress was the one figure the coach could not source from a
-- record. Rather than hard-code a number and present it as the student's, it
-- is asked for; until it is set, the app falls back to a stated default and
-- says so.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column degree_credits int check (degree_credits is null or degree_credits between 30 and 400);

-- ---------------------------------------------------------------------------
-- Row level security, identical in shape to every other table.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['milestones','motivation_logs']
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

revoke all on public.milestones, public.motivation_logs from anon;
