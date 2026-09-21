-- =============================================================================
-- UniMate — 0018 course materials
--
-- The slides, notes and chapter handouts a course is actually taught from.
--
-- Syllabi already had a table and a bucket, but a syllabus is one document that
-- describes a course; materials are many documents that *are* the course, and
-- Study AI reads them to write a chapter review or set practice on a specific
-- week. Different lifecycle, different table.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('materials', 'materials', false, 26214400,
   array['application/pdf',
         'application/vnd.openxmlformats-officedocument.presentationml.presentation',
         'application/vnd.ms-powerpoint',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/msword',
         'image/png','image/jpeg','image/webp','text/plain','text/markdown'])
on conflict (id) do nothing;

-- The existing storage policies are written against a fixed bucket list, so
-- they are replaced rather than added to; the rule itself is unchanged, and
-- objects still live under a <user-id>/ prefix that the policy checks.
drop policy if exists "own_folder_read"   on storage.objects;
drop policy if exists "own_folder_insert" on storage.objects;
drop policy if exists "own_folder_update" on storage.objects;
drop policy if exists "own_folder_delete" on storage.objects;

create policy "own_folder_read" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('syllabi','timetables','materials')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "own_folder_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('syllabi','timetables','materials')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "own_folder_update" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('syllabi','timetables','materials')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "own_folder_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('syllabi','timetables','materials')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ---------------------------------------------------------------------------
-- course_materials
-- ---------------------------------------------------------------------------
create table if not exists public.course_materials (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  course_id   uuid not null references public.courses (id) on delete cascade,
  -- What the student calls this chapter. Defaults to the filename, and is
  -- editable, because "Week 7 — Z-transform" is what they will look for later,
  -- not "lecture07_final_v2.pdf".
  title       text not null,
  file_name   text not null,
  -- Path inside the `materials` bucket: <user-id>/<course-id>/<uuid>.<ext>.
  file_path   text not null unique,
  file_type   text not null,
  size_bytes  bigint check (size_bytes is null or size_bytes >= 0),
  -- Ordering is the student's, so chapters read in teaching order rather than
  -- upload order.
  position    int not null default 0,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists course_materials_course_idx on public.course_materials (course_id, position);
create index if not exists course_materials_user_idx   on public.course_materials (user_id);

create trigger course_materials_touch before update on public.course_materials
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Thirty files per course, enforced here rather than only in the form.
--
-- A limit that lives in the client is a limit that a second tab, a retried
-- request or a future screen forgets. Counting in a trigger costs one indexed
-- read per insert and cannot be talked out of.
-- ---------------------------------------------------------------------------
create or replace function public.course_materials_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  n int;
begin
  select count(*) into n
    from public.course_materials
   where course_id = new.course_id;

  if n >= 30 then
    raise exception 'course_materials_limit: a course may hold at most 30 files'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- A trigger function is not an API endpoint; triggers ignore EXECUTE grants.
revoke all on function public.course_materials_limit() from public, anon, authenticated;

create trigger course_materials_cap
  before insert on public.course_materials
  for each row execute function public.course_materials_limit();

-- ---------------------------------------------------------------------------
-- Row level security: the same shape as every other student-owned table.
-- ---------------------------------------------------------------------------
alter table public.course_materials enable row level security;
alter table public.course_materials force row level security;
revoke all on public.course_materials from anon;

create policy course_materials_select_own on public.course_materials
  for select to authenticated using ((select auth.uid()) = user_id);
create policy course_materials_insert_own on public.course_materials
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy course_materials_update_own on public.course_materials
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy course_materials_delete_own on public.course_materials
  for delete to authenticated using ((select auth.uid()) = user_id);
