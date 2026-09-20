-- =============================================================================
-- UniMate — 0011 study groups
--
-- Finding people to study a course with, using the timetable UniMate already
-- holds. Every student's courses carry their meeting days and times — read off
-- a photographed timetable in most cases — so the shared free hours of a group
-- can be computed rather than negotiated in a chat.
--
-- This is the second thing in UniMate that crosses between students, and it
-- follows the rule set by 0010 (the streak board):
--
--   * No existing table gains a cross-user policy. Courses, grades, tasks and
--     everything else stay private to their owner, with RLS still forced.
--   * What crosses does so through security-definer functions whose select
--     lists cannot name a column the caller should not see.
--   * Availability crosses as *anonymised blocks*: "member 2 is busy Sunday
--     09:00–10:00". No user id, no course code, no course name. The building
--     is included only for a group you are actually in, because suggesting a
--     place to meet needs to know roughly where people already are.
--   * A group is keyed by course CODE and university, not by a course row:
--     course rows are per-student, so CE301 in one student's records is a
--     different row from CE301 in another's.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.study_groups (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  -- Snapshotted from the owner's profile: the discovery scope. A group is
  -- offered to students of the same university, nobody else.
  university  text not null,
  -- Normalised on the way in (upper, no spaces) so "ce 301" finds "CE301".
  course_code text not null,
  course_name text,
  title       text not null check (btrim(title) <> ''),
  note        text,
  max_members int not null default 6 check (max_members between 2 and 20),
  is_open     boolean not null default true,
  -- Where they meet, once they have decided. Suggested from the timetable.
  place       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists study_groups_discovery_idx
  on public.study_groups (university, course_code)
  where is_open;

create table if not exists public.group_members (
  id        uuid primary key default gen_random_uuid(),
  group_id  uuid not null references public.study_groups (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  role      text not null default 'member' check (role in ('owner', 'member')),
  -- Inside a group you joined on purpose, showing your name is the default —
  -- but it stays a choice, as it is on the streak board. Discovery shows no
  -- names at all, whatever this says.
  show_name boolean not null default true,
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create index if not exists group_members_user_idx on public.group_members (user_id);

create table if not exists public.group_meetings (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.study_groups (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  meets_on   date not null,
  start_time time not null,
  end_time   time not null,
  place      text,
  created_at timestamptz not null default now(),
  constraint group_meetings_time_order check (end_time > start_time)
);

create index if not exists group_meetings_group_idx
  on public.group_meetings (group_id, meets_on desc);

-- Attendance is what makes a commitment score mean anything: it is recorded
-- per person per meeting, and the score is derived from these rows rather than
-- stored, so it can never drift from what actually happened.
create table if not exists public.meeting_attendance (
  id         uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.group_meetings (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  attended   boolean not null,
  marked_at  timestamptz not null default now(),
  unique (meeting_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Membership test
--
-- A policy on group_members that reads group_members recurses, so the test is
-- a security-definer function: it answers one boolean about the caller and
-- nothing else.
-- ---------------------------------------------------------------------------
create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = p_group_id and m.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_group_member(uuid) from public, anon;
grant execute on function public.is_group_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.study_groups      enable row level security;
alter table public.study_groups      force  row level security;
alter table public.group_members     enable row level security;
alter table public.group_members     force  row level security;
alter table public.group_meetings    enable row level security;
alter table public.group_meetings    force  row level security;
alter table public.meeting_attendance enable row level security;
alter table public.meeting_attendance force  row level security;

-- study_groups: members and the owner read it directly. Everyone else reaches
-- it only through discover_groups(), which returns a fixed, narrow row.
create policy "study_groups_select_member" on public.study_groups
  for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_group_member(id));

create policy "study_groups_insert_own" on public.study_groups
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "study_groups_update_owner" on public.study_groups
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "study_groups_delete_owner" on public.study_groups
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- group_members: visible to the group. Joining goes through join_group(),
-- which is the only place capacity can be enforced without a race.
create policy "group_members_select_member" on public.group_members
  for select to authenticated
  using (public.is_group_member(group_id));

create policy "group_members_update_own" on public.group_members
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Leaving is your own row; an owner can also remove a member.
create policy "group_members_delete_own_or_owner" on public.group_members
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.study_groups g
      where g.id = group_id and g.owner_id = (select auth.uid())
    )
  );

create policy "group_meetings_select_member" on public.group_meetings
  for select to authenticated using (public.is_group_member(group_id));

create policy "group_meetings_insert_member" on public.group_meetings
  for insert to authenticated
  with check (public.is_group_member(group_id) and created_by = (select auth.uid()));

create policy "group_meetings_update_member" on public.group_meetings
  for update to authenticated
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

create policy "group_meetings_delete_creator" on public.group_meetings
  for delete to authenticated using (created_by = (select auth.uid()));

create policy "meeting_attendance_select_member" on public.meeting_attendance
  for select to authenticated
  using (exists (
    select 1 from public.group_meetings m
    where m.id = meeting_id and public.is_group_member(m.group_id)
  ));

-- You mark your own attendance, and only for a meeting of a group you are in.
create policy "meeting_attendance_insert_own" on public.meeting_attendance
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.group_meetings m
      where m.id = meeting_id and public.is_group_member(m.group_id)
    )
  );

create policy "meeting_attendance_update_own" on public.meeting_attendance
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.study_groups       from anon;
revoke all on public.group_members      from anon;
revoke all on public.group_meetings     from anon;
revoke all on public.meeting_attendance from anon;

-- ---------------------------------------------------------------------------
-- Discovery
--
-- Open groups for one course code, inside the caller's own university. Counts
-- and capacity only: no names, no emails, no member ids.
-- ---------------------------------------------------------------------------
create or replace function public.discover_groups(p_course_code text)
returns table (
  group_id     uuid,
  title        text,
  course_code  text,
  course_name  text,
  note         text,
  place        text,
  member_count int,
  max_members  int,
  is_member    boolean
)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  with me as (
    select coalesce(nullif(btrim(p.university), ''), '~none~') as university
    from public.profiles p
    where p.user_id = (select auth.uid())
  )
  select
    g.id,
    g.title,
    g.course_code,
    g.course_name,
    g.note,
    g.place,
    (select count(*) from public.group_members m where m.group_id = g.id)::int,
    g.max_members,
    exists (
      select 1 from public.group_members m
      where m.group_id = g.id and m.user_id = (select auth.uid())
    )
  from public.study_groups g, me
  where g.is_open
    and upper(regexp_replace(g.course_code, '\s+', '', 'g'))
        = upper(regexp_replace(coalesce(p_course_code, ''), '\s+', '', 'g'))
    and lower(btrim(g.university)) = lower(me.university)
  order by g.created_at desc
  limit 30;
$$;

revoke all on function public.discover_groups(text) from public, anon;
grant execute on function public.discover_groups(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Availability
--
-- The engine's input: when the members of a group are already busy, as
-- anonymous blocks. One `member_no` per student so partial overlap can be
-- ranked ("4 of 5 free"), but the number is meaningless outside this result —
-- it is assigned by the query, not stored, and carries no identity.
--
-- Callable for a group you are in, and for an open group in your university
-- that you have not joined: seeing the overlap *before* joining is the whole
-- point. The building is withheld in that case; it is only returned to members.
-- ---------------------------------------------------------------------------
create or replace function public.group_busy_blocks(p_group_ids uuid[])
returns table (
  group_id  uuid,
  member_no int,
  day       text,
  starts_at time,
  ends_at   time,
  building  text
)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  with me as (
    select coalesce(nullif(btrim(p.university), ''), '~none~') as university
    from public.profiles p
    where p.user_id = (select auth.uid())
  ),
  allowed as (
    select
      g.id,
      public.is_group_member(g.id) as mine
    from public.study_groups g, me
    -- Hard cap: a page asks about a handful of groups, never a fishing list.
    where g.id = any (p_group_ids[1:20])
      and (
        public.is_group_member(g.id)
        or (g.is_open and lower(btrim(g.university)) = lower(me.university))
      )
  ),
  numbered as (
    select
      a.id as group_id,
      a.mine,
      m.user_id,
      dense_rank() over (partition by a.id order by m.joined_at, m.user_id)::int as member_no
    from allowed a
    join public.group_members m on m.group_id = a.id
  )
  select
    n.group_id,
    n.member_no,
    d.day,
    c.start_time,
    c.end_time,
    -- "A5-210" → "A5". Enough to suggest somewhere near, not enough to say
    -- which class it is, and only for members.
    case when n.mine
         then nullif(split_part(btrim(coalesce(c.room, '')), '-', 1), '')
         else null end
  from numbered n
  join public.courses c on c.user_id = n.user_id
  cross join lateral unnest(c.days) as d(day)
  where c.status = 'active'
    and c.start_time is not null
    and c.end_time is not null;
$$;

revoke all on function public.group_busy_blocks(uuid[]) from public, anon;
grant execute on function public.group_busy_blocks(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Joining
--
-- A function rather than an insert policy, because capacity has to be checked
-- and the row written in one statement or two students can take the last seat
-- at the same time.
-- ---------------------------------------------------------------------------
create or replace function public.join_group(p_group_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := (select auth.uid());
  v_group public.study_groups;
  v_my_university text;
  v_count int;
begin
  if v_me is null then return 'not_signed_in'; end if;

  select * into v_group from public.study_groups where id = p_group_id for update;
  if not found then return 'not_found'; end if;

  select coalesce(nullif(btrim(university), ''), '~none~') into v_my_university
  from public.profiles where user_id = v_me;

  if lower(btrim(v_group.university)) <> lower(coalesce(v_my_university, '~none~')) then
    return 'other_university';
  end if;
  if not v_group.is_open then return 'closed'; end if;

  if exists (select 1 from public.group_members where group_id = p_group_id and user_id = v_me) then
    return 'already_member';
  end if;

  select count(*) into v_count from public.group_members where group_id = p_group_id;
  if v_count >= v_group.max_members then return 'full'; end if;

  insert into public.group_members (group_id, user_id, role) values (p_group_id, v_me, 'member');
  return 'joined';
end;
$$;

revoke all on function public.join_group(uuid) from public, anon;
grant execute on function public.join_group(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Who is in it, and who turns up
--
-- Names only for fellow members, and only from those who left `show_name` on.
-- The commitment score is derived: meetings of this group that had already
-- happened while the student was a member, against the ones they marked
-- themselves present at.
-- ---------------------------------------------------------------------------
create or replace function public.group_roster(p_group_id uuid)
returns table (
  member_no     int,
  display_name  text,
  is_me         boolean,
  is_owner      boolean,
  invited       int,
  attended      int
)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  with numbered as (
    select
      m.user_id,
      m.role,
      m.show_name,
      m.joined_at,
      dense_rank() over (order by m.joined_at, m.user_id)::int as member_no
    from public.group_members m
    where m.group_id = p_group_id
      and public.is_group_member(p_group_id)
  ),
  past as (
    select mt.id, mt.meets_on
    from public.group_meetings mt
    where mt.group_id = p_group_id and mt.meets_on <= current_date
  )
  select
    n.member_no,
    case when n.show_name then nullif(btrim(p.full_name), '') else null end,
    n.user_id = (select auth.uid()),
    n.role = 'owner',
    (select count(*) from past where past.meets_on >= n.joined_at::date)::int,
    (select count(*) from past
      join public.meeting_attendance a on a.meeting_id = past.id
     where a.user_id = n.user_id and a.attended)::int
  from numbered n
  left join public.profiles p on p.user_id = n.user_id
  order by n.member_no;
$$;

revoke all on function public.group_roster(uuid) from public, anon;
grant execute on function public.group_roster(uuid) to authenticated;
