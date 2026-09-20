-- =============================================================================
-- UniMate — 0008 course contacts
--
-- Renumbered from 0005 on merge: 0005 was already taken by the flashcards
-- table on the branch this landed on. Migrations are append-only, so the file
-- moves rather than the existing one.
-- Who teaches the course, and how to reach them.
--
-- `courses.instructor` was a bare name with nowhere to put an email, an office
-- or the hours that office is open, and there was no room at all for a teaching
-- assistant. A syllabus carries all of it, so the course row now has somewhere
-- to keep it.
--
-- Additive only: every column is nullable, so existing rows stay valid and the
-- existing `instructor` column keeps its meaning as the instructor's name.
-- =============================================================================

alter table public.courses
  add column if not exists instructor_email       text,
  add column if not exists instructor_office      text,
  add column if not exists instructor_office_hours text,
  add column if not exists ta_name                text,
  add column if not exists ta_email               text,
  add column if not exists ta_office              text,
  add column if not exists ta_office_hours        text;

-- A stored address that is not an address would render a mailto: link that
-- silently goes nowhere, so reject it at the edge rather than in the UI.
-- Deliberately loose: it rules out obvious nonsense without trying to be a
-- full RFC 5322 parser.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'courses_instructor_email_shape'
  ) then
    alter table public.courses
      add constraint courses_instructor_email_shape
      check (instructor_email is null or instructor_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'courses_ta_email_shape'
  ) then
    alter table public.courses
      add constraint courses_ta_email_shape
      check (ta_email is null or ta_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');
  end if;
end $$;

comment on column public.courses.instructor_email        is 'Instructor email, used to build a mailto: link.';
comment on column public.courses.instructor_office       is 'Building and room where the instructor holds office hours.';
comment on column public.courses.instructor_office_hours is 'Free text as printed on the syllabus, e.g. "Sun/Tue 10:00–11:30".';
comment on column public.courses.ta_name                 is 'Teaching assistant name. Null when the course has no TA.';
comment on column public.courses.ta_email                is 'Teaching assistant email, used to build a mailto: link.';
comment on column public.courses.ta_office               is 'Building and room where the TA holds office hours.';
comment on column public.courses.ta_office_hours         is 'Free text as printed on the syllabus.';

-- Row level security needs no change: these are columns on public.courses,
-- which already forces RLS and restricts every statement to the owning user.
