-- =============================================================================
-- UniMate — 0001 schema
-- Core academic tables, enums, relationships and indexes.
-- =============================================================================

create extension if not exists "pgcrypto" with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums: controlled values instead of free-text strings.
-- ---------------------------------------------------------------------------
create type public.app_language      as enum ('en', 'ar');
create type public.course_status     as enum ('active', 'completed', 'planned', 'withdrawn');
create type public.assessment_type   as enum ('quiz','assignment','midterm','final','project','lab','participation','presentation','other');
create type public.task_status       as enum ('todo','in_progress','completed');
create type public.task_priority     as enum ('low','medium','high');
create type public.record_source     as enum ('manual','ai');
create type public.processing_status as enum ('pending','processing','completed','failed');
create type public.ai_run_status     as enum ('pending','running','completed','failed');
create type public.workload_level    as enum ('light','balanced','intensive');
create type public.question_type     as enum ('multiple_choice','true_false','short_answer','calculation','conceptual','scenario');
create type public.difficulty_level  as enum ('easy','medium','hard');
create type public.syllabus_event_type as enum ('exam','midterm','final','quiz','assignment','project','presentation','deadline','lecture','holiday','other');
create type public.reminder_status   as enum ('scheduled','done','dismissed');

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles — one row per auth user
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null unique references auth.users (id) on delete cascade,
  full_name          text,
  university         text,
  major              text,
  academic_year      text,
  preferred_language public.app_language not null default 'en',
  target_gpa         numeric(4,2) check (target_gpa is null or (target_gpa >= 0 and target_gpa <= 5)),
  gpa_scale          numeric(3,2) not null default 4.00 check (gpa_scale > 0 and gpa_scale <= 5),
  preferred_study_minutes int not null default 45 check (preferred_study_minutes between 5 and 480),
  study_availability text,
  theme              text not null default 'light',
  reminders_enabled  boolean not null default true,
  onboarding_completed boolean not null default false,
  is_demo            boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Grade scale rows are per user so no single university's mapping is baked in.
create table public.grade_scale_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  letter      text not null,
  min_percent numeric(5,2) not null check (min_percent >= 0 and min_percent <= 100),
  points      numeric(4,2) not null check (points >= 0),
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  unique (user_id, letter)
);
create index grade_scale_entries_user_idx on public.grade_scale_entries (user_id, sort_order);

-- ---------------------------------------------------------------------------
-- courses
-- ---------------------------------------------------------------------------
create table public.courses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  course_code  text not null,
  course_name  text not null,
  instructor   text,
  credits      numeric(4,2) not null default 3 check (credits >= 0 and credits <= 24),
  semester     text,
  difficulty   int check (difficulty is null or difficulty between 1 and 5),
  days         text[] not null default '{}',
  start_time   time,
  end_time     time,
  room         text,
  color        text,
  status       public.course_status not null default 'active',
  final_grade  text,
  final_points numeric(4,2) check (final_points is null or final_points >= 0),
  target_grade text,
  source       public.record_source not null default 'manual',
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint courses_time_order check (start_time is null or end_time is null or end_time > start_time)
);
create index courses_user_idx        on public.courses (user_id);
create index courses_user_status_idx on public.courses (user_id, status);
create unique index courses_user_code_semester_key
  on public.courses (user_id, upper(course_code), coalesce(semester, ''));
create trigger courses_touch before update on public.courses
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- grades — one row per assessment inside a course
-- ---------------------------------------------------------------------------
create table public.grades (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  course_id       uuid not null references public.courses (id) on delete cascade,
  assessment_name text not null,
  assessment_type public.assessment_type not null default 'other',
  weight          numeric(5,2) not null check (weight >= 0 and weight <= 100),
  score           numeric(7,2) check (score is null or score >= 0),
  max_score       numeric(7,2) not null default 100 check (max_score > 0),
  due_date        date,
  target_grade    text,
  source          public.record_source not null default 'manual',
  is_demo         boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint grades_score_within_max check (score is null or score <= max_score)
);
create index grades_user_idx   on public.grades (user_id);
create index grades_course_idx on public.grades (course_id);
create trigger grades_touch before update on public.grades
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- syllabi and the events extracted from them
-- ---------------------------------------------------------------------------
create table public.syllabi (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  course_id         uuid references public.courses (id) on delete set null,
  file_name         text,
  file_url          text,
  file_type         text,
  extracted_text    text,
  summary           text,
  instructor        text,
  office_hours      text,
  policies          text,
  required_material text,
  topics            text[] not null default '{}',
  processing_status public.processing_status not null default 'pending',
  error_message     text,
  is_demo           boolean not null default false,
  uploaded_at       timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index syllabi_user_idx   on public.syllabi (user_id);
create index syllabi_course_idx on public.syllabi (course_id);
create trigger syllabi_touch before update on public.syllabi
  for each row execute function public.touch_updated_at();

create table public.syllabus_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  syllabus_id uuid references public.syllabi (id) on delete cascade,
  course_id   uuid references public.courses (id) on delete cascade,
  title       text not null,
  event_type  public.syllabus_event_type not null default 'other',
  event_date  date,
  weight      numeric(5,2) check (weight is null or (weight >= 0 and weight <= 100)),
  description text,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index syllabus_events_user_idx   on public.syllabus_events (user_id, event_date);
create index syllabus_events_course_idx on public.syllabus_events (course_id);

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create table public.tasks (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  course_id         uuid references public.courses (id) on delete set null,
  title             text not null,
  description       text,
  priority          public.task_priority not null default 'medium',
  due_date          date,
  estimated_minutes int check (estimated_minutes is null or estimated_minutes between 1 and 1440),
  status            public.task_status not null default 'todo',
  source            public.record_source not null default 'manual',
  is_demo           boolean not null default false,
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index tasks_user_idx        on public.tasks (user_id, status);
create index tasks_user_due_idx    on public.tasks (user_id, due_date);
create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- study reminders produced by the Study Reminder Agent
-- ---------------------------------------------------------------------------
create table public.reminders (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  course_id    uuid references public.courses (id) on delete cascade,
  event_id     uuid references public.syllabus_events (id) on delete cascade,
  title        text not null,
  body         text,
  remind_on    date not null,
  status       public.reminder_status not null default 'scheduled',
  source       public.record_source not null default 'ai',
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index reminders_user_date_idx on public.reminders (user_id, remind_on);
create trigger reminders_touch before update on public.reminders
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- study sessions, questions and attempts
-- ---------------------------------------------------------------------------
create table public.study_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  course_id        uuid references public.courses (id) on delete set null,
  topic            text,
  mode             text,
  duration_minutes int check (duration_minutes is null or duration_minutes >= 0),
  score            numeric(5,2) check (score is null or (score >= 0 and score <= 100)),
  total_questions  int not null default 0,
  correct_answers  int not null default 0,
  is_demo          boolean not null default false,
  started_at       timestamptz not null default now(),
  completed_at     timestamptz
);
create index study_sessions_user_idx on public.study_sessions (user_id, completed_at desc);

create table public.questions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  course_id     uuid references public.courses (id) on delete cascade,
  session_id    uuid references public.study_sessions (id) on delete cascade,
  topic         text,
  difficulty    public.difficulty_level not null default 'medium',
  question_type public.question_type not null default 'multiple_choice',
  question_text text not null,
  options       jsonb,
  answer        text not null,
  explanation   text,
  is_demo       boolean not null default false,
  created_at    timestamptz not null default now()
);
create index questions_user_idx    on public.questions (user_id);
create index questions_session_idx on public.questions (session_id);

create table public.question_attempts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  question_id   uuid not null references public.questions (id) on delete cascade,
  session_id    uuid references public.study_sessions (id) on delete cascade,
  given_answer  text,
  is_correct    boolean not null default false,
  answered_at   timestamptz not null default now()
);
create index question_attempts_user_idx on public.question_attempts (user_id, answered_at desc);

-- ---------------------------------------------------------------------------
-- candidate semester schedules from the Course Planner
-- ---------------------------------------------------------------------------
create table public.schedules (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  semester       text,
  name           text not null,
  total_credits  numeric(5,2) not null default 0,
  workload_level public.workload_level not null default 'balanced',
  rationale      text,
  assumptions    text[] not null default '{}',
  is_selected    boolean not null default false,
  is_demo        boolean not null default false,
  created_at     timestamptz not null default now()
);
create index schedules_user_idx on public.schedules (user_id, created_at desc);

create table public.schedule_courses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  schedule_id uuid not null references public.schedules (id) on delete cascade,
  course_id   uuid not null references public.courses (id) on delete cascade,
  note        text,
  unique (schedule_id, course_id)
);
create index schedule_courses_schedule_idx on public.schedule_courses (schedule_id);

-- ---------------------------------------------------------------------------
-- ai_runs — every automated AI operation leaves a row here
-- ---------------------------------------------------------------------------
create table public.ai_runs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  agent_name     text not null,
  trigger_type   text not null,
  workflow       text,
  status         public.ai_run_status not null default 'pending',
  input_summary  text,
  output_summary text,
  error_message  text,
  duration_ms    int,
  started_at     timestamptz not null default now(),
  completed_at   timestamptz
);
create index ai_runs_user_idx on public.ai_runs (user_id, started_at desc);

-- ---------------------------------------------------------------------------
-- cleaning_log — every data-cleaning decision is recorded
-- ---------------------------------------------------------------------------
create table public.cleaning_log (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  table_name     text not null,
  record_id      uuid,
  field_name     text,
  original_value text,
  cleaned_value  text,
  reason         text not null,
  created_at     timestamptz not null default now()
);
create index cleaning_log_user_idx on public.cleaning_log (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- New auth users get a profile and a default 4.0 grade scale automatically.
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

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
