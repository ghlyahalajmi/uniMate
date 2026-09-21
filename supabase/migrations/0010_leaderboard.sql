-- =============================================================================
-- UniMate — 0010 leaderboard
--
-- A board of who is keeping their streak going. This is the first thing in
-- UniMate that lets one student see anything about another, so it is built
-- narrowly and deliberately:
--
--   * No table gains a cross-user policy. Every existing table stays private,
--     and the board is served by one security-definer function that returns
--     only a display name and a streak number.
--   * A student chooses whether they are on it at all, and separately whether
--     their name is shown. Appearing is on by default because a board nobody
--     is on is not a board; the *name* is off by default, because publishing
--     someone's name to their classmates should be something they chose, not
--     something they failed to turn off.
--   * Nothing else crosses. Not an email, not a course, not a grade, not a
--     GPA — only the name they agreed to show and the length of their run.
-- =============================================================================

alter table public.profiles
  add column if not exists leaderboard_opt_in   boolean not null default true,
  add column if not exists leaderboard_show_name boolean not null default false;

comment on column public.profiles.leaderboard_opt_in is
  'Whether this student appears on the streak board at all.';
comment on column public.profiles.leaderboard_show_name is
  'Whether their name is shown there. Off by default — they appear anonymously.';

-- ---------------------------------------------------------------------------
-- The board.
--
-- security definer because it must read across students, which no policy
-- allows. That makes the function itself the boundary, so it is written to be
-- boring: a fixed search_path, no arguments, no dynamic SQL, a hard row cap,
-- and a select list that cannot name a column the caller should not see.
--
-- The streak is computed here rather than stored, by the same rule as
-- lib/momentum/engine.ts: consecutive days with a row in activity_days, and
-- the run has to reach today or yesterday to still be running. Deriving it
-- means the board can never drift from the records behind it.
-- ---------------------------------------------------------------------------
create or replace function public.streak_leaderboard()
returns table (
  -- `position` is reserved in Postgres (the POSITION function), so: place.
  place        int,
  display_name text,
  streak       int,
  is_me        boolean
)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  with numbered as (
    select
      a.user_id,
      a.day,
      -- Consecutive days share a value here, which is what groups a run.
      a.day - (row_number() over (partition by a.user_id order by a.day))::int as run_key
    from public.activity_days a
  ),
  runs as (
    select user_id, count(*)::int as length, max(day) as ended_on
    from numbered
    group by user_id, run_key
  ),
  live as (
    -- Yesterday still counts: the day is not over until it is over.
    select user_id, max(length) as streak
    from runs
    where ended_on >= current_date - 1
    group by user_id
  )
  select
    rank() over (order by l.streak desc, p.user_id)::int as place,
    case when p.leaderboard_show_name
         then nullif(btrim(p.full_name), '')
         else null end as display_name,
    l.streak,
    p.user_id = (select auth.uid()) as is_me
  from live l
  join public.profiles p on p.user_id = l.user_id
  where p.leaderboard_opt_in
    and p.momentum_enabled
    and l.streak > 0
  order by l.streak desc, p.user_id
  limit 50;
$$;

-- Signed-in students only. anon gets nothing, and neither does the public role.
revoke all on function public.streak_leaderboard() from public;
revoke all on function public.streak_leaderboard() from anon;
grant execute on function public.streak_leaderboard() to authenticated;
