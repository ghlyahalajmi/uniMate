-- =============================================================================
-- UniMate — 0028 a reminder is announced once
--
-- Without this the in-app alert fires again on every page load for the rest of
-- the day, which is how people learn to ignore an alert.
--
-- Written by the student's own session under the policies already on this
-- table, so it needs no new grant and no new policy.
-- =============================================================================

alter table public.reminders
  add column if not exists notified_at timestamptz;

-- The watcher asks "anything due and unannounced?" once a minute, per student.
create index if not exists reminders_due_idx
  on public.reminders (user_id, remind_on)
  where notified_at is null;
