-- =============================================================================
-- UniMate — 0003 storage
--
-- Two private buckets. Objects live under a <user-id>/ prefix and the policies
-- check that prefix, so one student can never fetch another student's upload.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('syllabi', 'syllabi', false, 10485760,
   array['application/pdf',
         'application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'image/png','image/jpeg','image/webp','text/plain']),
  ('timetables', 'timetables', false, 10485760,
   array['image/png','image/jpeg','image/webp','application/pdf'])
on conflict (id) do nothing;

create policy "own_folder_read" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('syllabi','timetables')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "own_folder_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('syllabi','timetables')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "own_folder_update" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('syllabi','timetables')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "own_folder_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('syllabi','timetables')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
