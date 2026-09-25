-- =============================================================================
-- UniMate — 0033 one streak, counted one way
--
-- The board counted a day as any row in activity_days. The app counts a day
-- when that row earned XP — "opening it is not enough" is written on the
-- Momentum screen, and it is what computeStreak does. Two rules meant the
-- class board could show a student a number their own Momentum screen
-- disagreed with, and a figure that changes by page is a figure nobody
-- believes.
--
-- Nothing else here changes: same columns, same opt-in, same nothing about
-- anyone's courses, grades or answers.
-- =============================================================================

drop function if exists public.streak_leaderboard();

create function public.streak_leaderboard()
returns table (
  place integer,
  display_name text,
  streak integer,
  is_me boolean,
  focus_minutes integer,
  tasks_completed integer,
  active_days integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with counted as (
    -- A day counts when it earned XP. The same line the app draws.
    select a.user_id, a.day
    from public.activity_days a
    where a.xp > 0
  ),
  numbered as (
    select
      c.user_id,
      c.day,
      c.day - (row_number() over (partition by c.user_id order by c.day))::int as run_key
    from counted c
  ),
  runs as (
    select user_id, count(*)::int as length, max(day) as ended_on
    from numbered
    group by user_id, run_key
  ),
  live as (
    -- Alive today, or alive yesterday and still rescuable — exactly the two
    -- cases computeStreak treats as a running streak.
    select user_id, max(length) as streak
    from runs
    where ended_on >= current_date - 1
    group by user_id
  ),
  effort as (
    select
      user_id,
      coalesce(sum(focus_minutes), 0)::int as focus_minutes,
      coalesce(sum(tasks_completed), 0)::int as tasks_completed,
      count(*) filter (where xp > 0)::int as active_days
    from public.activity_days
    group by user_id
  )
  select
    rank() over (order by l.streak desc, p.user_id)::int as place,
    case when p.leaderboard_show_name
         then nullif(btrim(p.full_name), '')
         else null end as display_name,
    l.streak,
    p.user_id = (select auth.uid()) as is_me,
    coalesce(e.focus_minutes, 0),
    coalesce(e.tasks_completed, 0),
    coalesce(e.active_days, 0)
  from live l
  join public.profiles p on p.user_id = l.user_id
  left join effort e on e.user_id = l.user_id
  where p.leaderboard_opt_in
    and p.momentum_enabled
    and l.streak > 0
  order by l.streak desc, p.user_id
  limit 50;
$$;

revoke all on function public.streak_leaderboard() from public, anon;
grant execute on function public.streak_leaderboard() to authenticated;
