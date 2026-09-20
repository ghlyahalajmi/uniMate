-- =============================================================================
-- UniMate — 0006 notes
--
-- A quick checklist the student writes themselves: a note holds lines, a line
-- is ticked off when it is done, and a line can carry a reminder time.
--
-- This is deliberately not the tasks table. A task belongs to a course, carries
-- a priority and a due date, and feeds the planner and the XP rules. A note
-- line is whatever the student typed, and nothing else in the app depends on
-- it. Keeping them apart means neither has to compromise for the other.
-- =============================================================================

create table public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  -- Untitled is a normal state: a student opens a note and starts typing lines,
  -- and being forced to name it first would defeat the point.
  title       text not null default '',
  color       text,
  position    int  not null default 0,
  is_archived boolean not null default false,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint notes_title_length check (char_length(title) <= 200)
);
create index notes_user_idx on public.notes (user_id, is_archived, position);
create trigger notes_touch before update on public.notes
  for each row execute function public.touch_updated_at();

create table public.note_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  note_id      uuid not null references public.notes (id) on delete cascade,
  -- Also allowed to be empty: pressing + creates the line, then it is typed
  -- into. A line that is still blank when the student leaves is swept up by
  -- the screen rather than rejected here.
  content      text not null default '',
  is_done      boolean not null default false,
  -- A timestamp, not a date: "remind me at 7pm" is the point of it.
  remind_at    timestamptz,
  position     int  not null default 0,
  completed_at timestamptz,
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint note_items_content_length check (char_length(content) <= 2000),
  -- completed_at and is_done can only ever tell the same story.
  constraint note_items_done_has_time check (is_done = (completed_at is not null))
);
create index note_items_note_idx on public.note_items (note_id, position);
-- Only outstanding reminders are ever queried, so the index carries only those.
create index note_items_due_idx on public.note_items (user_id, remind_at)
  where remind_at is not null and is_done = false;
create trigger note_items_touch before update on public.note_items
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security, identical in shape to every other table.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['notes','note_items']
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

revoke all on public.notes, public.note_items from anon;
