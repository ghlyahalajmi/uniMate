-- =============================================================================
-- UniMate — 0002 row level security
--
-- Every table carries user_id and every policy compares it to auth.uid().
-- A signed-in student can only ever see their own rows; the frontend filter is
-- a convenience, this is the actual boundary.
-- =============================================================================

-- profiles ------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.profiles force row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "profiles_delete_own" on public.profiles
  for delete to authenticated using ((select auth.uid()) = user_id);

-- grade_scale_entries ------------------------------------------------------------------
alter table public.grade_scale_entries enable row level security;
alter table public.grade_scale_entries force row level security;

create policy "grade_scale_entries_select_own" on public.grade_scale_entries
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "grade_scale_entries_insert_own" on public.grade_scale_entries
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "grade_scale_entries_update_own" on public.grade_scale_entries
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "grade_scale_entries_delete_own" on public.grade_scale_entries
  for delete to authenticated using ((select auth.uid()) = user_id);

-- courses ------------------------------------------------------------------
alter table public.courses enable row level security;
alter table public.courses force row level security;

create policy "courses_select_own" on public.courses
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "courses_insert_own" on public.courses
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "courses_update_own" on public.courses
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "courses_delete_own" on public.courses
  for delete to authenticated using ((select auth.uid()) = user_id);

-- grades ------------------------------------------------------------------
alter table public.grades enable row level security;
alter table public.grades force row level security;

create policy "grades_select_own" on public.grades
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "grades_insert_own" on public.grades
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "grades_update_own" on public.grades
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "grades_delete_own" on public.grades
  for delete to authenticated using ((select auth.uid()) = user_id);

-- syllabi ------------------------------------------------------------------
alter table public.syllabi enable row level security;
alter table public.syllabi force row level security;

create policy "syllabi_select_own" on public.syllabi
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "syllabi_insert_own" on public.syllabi
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "syllabi_update_own" on public.syllabi
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "syllabi_delete_own" on public.syllabi
  for delete to authenticated using ((select auth.uid()) = user_id);

-- syllabus_events ------------------------------------------------------------------
alter table public.syllabus_events enable row level security;
alter table public.syllabus_events force row level security;

create policy "syllabus_events_select_own" on public.syllabus_events
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "syllabus_events_insert_own" on public.syllabus_events
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "syllabus_events_update_own" on public.syllabus_events
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "syllabus_events_delete_own" on public.syllabus_events
  for delete to authenticated using ((select auth.uid()) = user_id);

-- tasks ------------------------------------------------------------------
alter table public.tasks enable row level security;
alter table public.tasks force row level security;

create policy "tasks_select_own" on public.tasks
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "tasks_insert_own" on public.tasks
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "tasks_update_own" on public.tasks
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "tasks_delete_own" on public.tasks
  for delete to authenticated using ((select auth.uid()) = user_id);

-- reminders ------------------------------------------------------------------
alter table public.reminders enable row level security;
alter table public.reminders force row level security;

create policy "reminders_select_own" on public.reminders
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "reminders_insert_own" on public.reminders
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "reminders_update_own" on public.reminders
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "reminders_delete_own" on public.reminders
  for delete to authenticated using ((select auth.uid()) = user_id);

-- study_sessions ------------------------------------------------------------------
alter table public.study_sessions enable row level security;
alter table public.study_sessions force row level security;

create policy "study_sessions_select_own" on public.study_sessions
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "study_sessions_insert_own" on public.study_sessions
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "study_sessions_update_own" on public.study_sessions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "study_sessions_delete_own" on public.study_sessions
  for delete to authenticated using ((select auth.uid()) = user_id);

-- questions ------------------------------------------------------------------
alter table public.questions enable row level security;
alter table public.questions force row level security;

create policy "questions_select_own" on public.questions
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "questions_insert_own" on public.questions
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "questions_update_own" on public.questions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "questions_delete_own" on public.questions
  for delete to authenticated using ((select auth.uid()) = user_id);

-- question_attempts ------------------------------------------------------------------
alter table public.question_attempts enable row level security;
alter table public.question_attempts force row level security;

create policy "question_attempts_select_own" on public.question_attempts
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "question_attempts_insert_own" on public.question_attempts
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "question_attempts_update_own" on public.question_attempts
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "question_attempts_delete_own" on public.question_attempts
  for delete to authenticated using ((select auth.uid()) = user_id);

-- schedules ------------------------------------------------------------------
alter table public.schedules enable row level security;
alter table public.schedules force row level security;

create policy "schedules_select_own" on public.schedules
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "schedules_insert_own" on public.schedules
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "schedules_update_own" on public.schedules
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "schedules_delete_own" on public.schedules
  for delete to authenticated using ((select auth.uid()) = user_id);

-- schedule_courses ------------------------------------------------------------------
alter table public.schedule_courses enable row level security;
alter table public.schedule_courses force row level security;

create policy "schedule_courses_select_own" on public.schedule_courses
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "schedule_courses_insert_own" on public.schedule_courses
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "schedule_courses_update_own" on public.schedule_courses
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "schedule_courses_delete_own" on public.schedule_courses
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ai_runs ------------------------------------------------------------------
alter table public.ai_runs enable row level security;
alter table public.ai_runs force row level security;

create policy "ai_runs_select_own" on public.ai_runs
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "ai_runs_insert_own" on public.ai_runs
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "ai_runs_update_own" on public.ai_runs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "ai_runs_delete_own" on public.ai_runs
  for delete to authenticated using ((select auth.uid()) = user_id);

-- cleaning_log ------------------------------------------------------------------
alter table public.cleaning_log enable row level security;
alter table public.cleaning_log force row level security;

create policy "cleaning_log_select_own" on public.cleaning_log
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "cleaning_log_insert_own" on public.cleaning_log
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "cleaning_log_update_own" on public.cleaning_log
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "cleaning_log_delete_own" on public.cleaning_log
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Anonymous visitors get nothing. No policy is granted to the anon role, so
-- with RLS enabled every table denies by default for unauthenticated requests.

-- Revoke the blanket grants Supabase hands the API roles, so a missing policy
-- can never turn into an accidental read.
revoke all on all tables in schema public from anon;
grant usage on schema public to anon, authenticated;
