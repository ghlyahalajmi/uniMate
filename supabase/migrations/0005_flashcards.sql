-- =============================================================================
-- UniMate — 0005 flashcards
--
-- Spaced repetition over cards the student writes or generates from their own
-- courses. Scheduling is Leitner rather than full SM-2 on purpose: a student
-- can predict when a card comes back, which a floating ease factor does not
-- allow. The intervals live in lib/flashcards/scheduler.ts, which is pure and
-- unit tested; this table only stores where each card currently sits.
--
-- A finished review session is recorded as a practice session in
-- activity_days, because that is what it is. No new XP rule, no new counter.
-- =============================================================================

create type public.flashcard_source as enum ('manual', 'generated');

create table public.flashcards (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  -- Cards outlive the course row they came from; losing the link is better
  -- than losing the card.
  course_id  uuid references public.courses (id) on delete set null,
  front      text not null check (length(btrim(front)) between 1 and 500),
  back       text not null check (length(btrim(back)) between 1 and 2000),
  topic      text check (topic is null or length(btrim(topic)) <= 120),
  source     public.flashcard_source not null default 'manual',

  -- Leitner box 1–5. A recalled card climbs one box and waits longer; a card
  -- that is missed drops straight back to box 1 and returns the same day.
  box        smallint not null default 1 check (box between 1 and 5),
  due_on     date not null default current_date,
  reviews    int not null default 0 check (reviews >= 0),
  lapses     int not null default 0 check (lapses >= 0),
  last_reviewed_at timestamptz,

  is_demo    boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The review queue is always "mine, due on or before today", so the index
-- matches the query rather than the column order.
create index flashcards_user_due_idx on public.flashcards (user_id, due_on);
create index flashcards_user_course_idx on public.flashcards (user_id, course_id);

create trigger flashcards_touch before update on public.flashcards
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Same row level security as every other table: enabled and forced, one
-- policy per operation, and nothing readable by anon.
-- ---------------------------------------------------------------------------
alter table public.flashcards enable row level security;
alter table public.flashcards force row level security;

create policy flashcards_select_own on public.flashcards
  for select to authenticated using ((select auth.uid()) = user_id);
create policy flashcards_insert_own on public.flashcards
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy flashcards_update_own on public.flashcards
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy flashcards_delete_own on public.flashcards
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.flashcards from anon;
