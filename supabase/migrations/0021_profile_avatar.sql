-- =============================================================================
-- UniMate — 0021 profile avatar
--
-- A face for the account: an uploaded photo, or a character the student builds.
-- Initials stay the default, because an account that has never been decorated
-- should still say whose it is.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 5242880,
        array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

-- The storage policies are written against a fixed bucket list, so they are
-- replaced rather than extended. The rule is unchanged: objects live under a
-- <user-id>/ prefix and the policy checks it.
drop policy if exists "own_folder_read"   on storage.objects;
drop policy if exists "own_folder_insert" on storage.objects;
drop policy if exists "own_folder_update" on storage.objects;
drop policy if exists "own_folder_delete" on storage.objects;

create policy "own_folder_read" on storage.objects
  for select to authenticated
  using (bucket_id in ('syllabi','timetables','materials','avatars')
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "own_folder_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('syllabi','timetables','materials','avatars')
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "own_folder_update" on storage.objects
  for update to authenticated
  using (bucket_id in ('syllabi','timetables','materials','avatars')
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "own_folder_delete" on storage.objects
  for delete to authenticated
  using (bucket_id in ('syllabi','timetables','materials','avatars')
         and (storage.foldername(name))[1] = (select auth.uid())::text);

-- The built avatar is a set of *keys*, never styles: the database stores
-- "hair: curly", the drawing decides what curly looks like, and nothing a
-- student picks ever reaches a style attribute.
alter table public.profiles
  add column if not exists avatar_kind text not null default 'initials'
    check (avatar_kind in ('initials','photo','character')),
  add column if not exists avatar_path text,
  add column if not exists avatar_design jsonb not null default '{}'::jsonb;
