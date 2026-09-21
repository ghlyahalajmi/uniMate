-- =============================================================================
-- UniMate — 0019 study modes and session times
--
-- Study AI gains two things the screens now promise: more ways to be asked a
-- question, and study plans whose sessions sit at a time of day.
-- =============================================================================

-- "Complete the sentence" and "compare" are shapes a student picks, so they
-- belong in the same enum the other five live in rather than being smuggled in
-- as short_answer with a convention on top.
alter type public.question_type add value if not exists 'fill_blank';
alter type public.question_type add value if not exists 'compare';

-- A study session needs a time of day, not only a date. The plan screen
-- promises "the dates, times and days of your sessions", and a date alone
-- cannot keep that promise or be edited into a different slot.
alter table public.study_plan_items
  add column if not exists start_time time,
  add column if not exists course_id uuid references public.courses (id) on delete set null,
  add column if not exists material_id uuid references public.course_materials (id) on delete set null;

create index if not exists study_plan_items_when_idx
  on public.study_plan_items (user_id, scheduled_on, start_time);

-- Which chapter a review or practice set was built from, so a session can say
-- what it revised rather than only how long it lasted.
alter table public.study_sessions
  add column if not exists material_id uuid references public.course_materials (id) on delete set null;
