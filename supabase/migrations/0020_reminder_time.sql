-- =============================================================================
-- UniMate — 0020 reminder time of day
--
-- The calendar's reminder button promises "remind me on this day, at this
-- time". A date-only column cannot keep the second half of that promise, so a
-- time joins it. Null stays meaningful: a reminder for a day, with no hour
-- attached, is a normal thing to want.
-- =============================================================================

alter table public.reminders
  add column if not exists remind_at time;

create index if not exists reminders_when_idx
  on public.reminders (user_id, remind_on, remind_at);
