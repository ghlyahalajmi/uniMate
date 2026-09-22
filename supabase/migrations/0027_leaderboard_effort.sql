-- =============================================================================
-- UniMate — 0027 the work behind the streak
--
-- The board showed a number of days and nothing about what those days took.
-- Focus minutes, completed tasks and active days are added for the students
-- already on it — that is, the ones who switched `leaderboard_opt_in` on.
--
-- Nothing new is exposed about anyone who did not: no name unless they chose
-- to show one, no row at all unless they opted in, and still nothing about
-- anyone's courses, grades, notes or answers.
--
-- The figures come from activity_days, which is the same table the student's
-- own momentum screen counts, so a number here can never disagree with the
-- number they see for themselves.
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
  with numbered as (
    select
      a.user_id,
      a.day,
      a.day - (row_number() over (partition by a.user_id order by a.day))::int as run_key
    from public.activity_days a
  ),
  runs as (
    select user_id, count(*)::int as length, max(day) as ended_on
    from numbered
    group by user_id, run_key
  ),
  live as (
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
      count(*)::int as active_days
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
