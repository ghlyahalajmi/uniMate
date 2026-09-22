-- =============================================================================
-- UniMate — 0026 the admin side
--
-- Administrators are not students with a flag set. They are separate accounts
-- with their own credentials, and the two sets cannot collide: an admin signs
-- in with a username, which is mapped to an address in a domain no student can
-- register, so "same password as a student" is not a thing that can happen by
-- accident or on purpose.
--
-- What an admin can see is deliberately narrow. Managing accounts needs who
-- exists, when they joined, whether they are suspended and whether they have
-- an AI key — it does not need anyone's grades, notes, tasks or questions, and
-- none of those are reachable from here. The isolation rules the rest of this
-- schema enforces are not relaxed for administrators.
--
-- Every function below is SECURITY DEFINER and refuses anyone who is not in
-- the admins table, so being able to call it is not the same as being allowed.
-- =============================================================================

create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  username   text not null unique check (username ~ '^[a-z0-9_.-]{3,32}$'),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table public.admins enable row level security;
alter table public.admins force row level security;

revoke all on public.admins from anon, authenticated;

-- An admin may read their own row and nothing else. The list of who else is an
-- administrator is not something any session needs.
drop policy if exists "admins_own_row" on public.admins;
create policy "admins_own_row" on public.admins
  for select to authenticated using (user_id = (select auth.uid()));

grant select on public.admins to authenticated;

-- Suspension lives on the profile because that is what the app already reads
-- on every request.
alter table public.profiles
  add column if not exists suspended_at timestamptz;

-- -----------------------------------------------------------------------------
-- Who is asking
-- -----------------------------------------------------------------------------

/**
 * Whether the caller is an administrator.
 *
 * Safe for any signed-in session to call: it answers about the caller only and
 * reveals nothing about anyone else.
 */
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()));
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- -----------------------------------------------------------------------------
-- The first administrator
-- -----------------------------------------------------------------------------

/**
 * Claim the first administrator account.
 *
 * Works exactly once: the moment one administrator exists this raises, so the
 * bootstrap page cannot be used to add a second. The caller becomes the admin,
 * so whoever runs it has already proved they hold that account's password.
 */
create or replace function public.admin_bootstrap(p_username text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  if exists (select 1 from public.admins) then
    raise exception 'an administrator already exists';
  end if;

  insert into public.admins (user_id, username, created_by)
  values (v_uid, lower(p_username), v_uid);
end;
$$;

revoke all on function public.admin_bootstrap(text) from public, anon;
grant execute on function public.admin_bootstrap(text) to authenticated;

-- -----------------------------------------------------------------------------
-- Managing accounts
-- -----------------------------------------------------------------------------

/**
 * The accounts, as an administrator needs to see them.
 *
 * Account facts only: who, when, whether suspended, whether they have an AI key
 * of their own, and how much they have entered. Not one row of anyone's
 * academic content — an administrator has no more right to read a student's
 * grades than another student does.
 */
create or replace function public.admin_list_users()
returns table (
  user_id      uuid,
  email        text,
  full_name    text,
  university   text,
  is_demo      boolean,
  suspended    boolean,
  joined_at    timestamptz,
  last_sign_in timestamptz,
  ai_key_hint  text,
  course_count integer,
  task_count   integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    u.id,
    u.email::text,
    p.full_name,
    p.university,
    coalesce(p.is_demo, false),
    p.suspended_at is not null,
    u.created_at,
    u.last_sign_in_at,
    c.hint,
    (select count(*)::int from public.courses x where x.user_id = u.id),
    (select count(*)::int from public.tasks x where x.user_id = u.id)
  from auth.users u
  left join public.profiles p on p.user_id = u.id
  left join public.ai_credentials c on c.user_id = u.id
  where public.is_admin()
    -- Administrators are accounts, not students, and do not belong in a
    -- student list.
    and not exists (select 1 from public.admins a where a.user_id = u.id)
  order by u.created_at desc
  limit 500;
$$;

revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

/** Suspend or restore one account. A suspended student is signed out on their next request. */
create or replace function public.admin_set_suspended(p_user uuid, p_suspended boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'not an administrator';
  end if;
  if exists (select 1 from public.admins a where a.user_id = p_user) then
    raise exception 'administrators cannot be suspended from here';
  end if;

  update public.profiles
     set suspended_at = case when p_suspended then now() else null end
   where user_id = p_user;
end;
$$;

revoke all on function public.admin_set_suspended(uuid, boolean) from public, anon;
grant execute on function public.admin_set_suspended(uuid, boolean) to authenticated;

/**
 * Remove a student's stored AI key.
 *
 * The one key operation an administrator needs: a key that has been revoked at
 * the provider, or pasted wrong, leaves every AI screen failing for that
 * student until it is cleared. Note what this cannot do — read it. The value is
 * not returned anywhere in this file.
 */
create or replace function public.admin_clear_ai_key(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'not an administrator';
  end if;

  delete from public.ai_credentials where user_id = p_user;
end;
$$;

revoke all on function public.admin_clear_ai_key(uuid) from public, anon;
grant execute on function public.admin_clear_ai_key(uuid) to authenticated;

/** How many students hold a key, for the summary at the top of the screen. */
create or replace function public.admin_ai_summary()
returns table (accounts integer, with_key integer, suspended integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    (select count(*)::int from auth.users u
      where not exists (select 1 from public.admins a where a.user_id = u.id)),
    (select count(*)::int from public.ai_credentials),
    (select count(*)::int from public.profiles where suspended_at is not null)
  where public.is_admin();
$$;

revoke all on function public.admin_ai_summary() from public, anon;
grant execute on function public.admin_ai_summary() to authenticated;

/**
 * Whether the admin side has been claimed yet.
 *
 * The first-run page has to know this before anyone has signed in, and it is
 * the only admin fact a signed-out visitor can learn: a yes or a no, never a
 * name. Without it the bootstrap page could not refuse a second attempt.
 */
create or replace function public.admin_exists()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.admins);
$$;

revoke all on function public.admin_exists() from public;
grant execute on function public.admin_exists() to anon, authenticated;

/**
 * Which side the caller belongs to, and whether they are allowed in.
 *
 * Middleware runs on every request, so the two things it must know — is this
 * an administrator, and is this account suspended — are one round trip rather
 * than two. It answers about the caller only.
 */
create or replace function public.session_state()
returns table (is_admin boolean, suspended boolean)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    exists (select 1 from public.admins a where a.user_id = (select auth.uid())),
    exists (
      select 1 from public.profiles p
       where p.user_id = (select auth.uid()) and p.suspended_at is not null
    );
$$;

revoke all on function public.session_state() from public, anon;
grant execute on function public.session_state() to authenticated;

-- -----------------------------------------------------------------------------
-- Keys are an administrator's job
-- -----------------------------------------------------------------------------

/**
 * Set one student's AI key.
 *
 * The key still lives on that student's own row, which is what keeps it
 * readable by their session and nobody else's — including other students, and
 * including the administrator who set it. An administrator can write a key and
 * clear a key. No function here returns one.
 */
create or replace function public.admin_set_ai_key(p_user uuid, p_provider text, p_key text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'not an administrator';
  end if;
  if length(coalesce(p_key, '')) < 8 then
    raise exception 'key too short';
  end if;

  insert into public.ai_credentials (user_id, provider, api_key, updated_at)
  values (p_user, coalesce(nullif(p_provider, ''), 'openrouter'), p_key, now())
  on conflict (user_id) do update
    set provider = excluded.provider,
        api_key = excluded.api_key,
        updated_at = now();
end;
$$;

revoke all on function public.admin_set_ai_key(uuid, text, text) from public, anon;
grant execute on function public.admin_set_ai_key(uuid, text, text) to authenticated;

/**
 * The same key on every student account, in one statement.
 *
 * A loop from the browser would be dozens of round trips and could stop
 * halfway, leaving half a deployment working and no way to tell which half.
 */
create or replace function public.admin_set_ai_key_for_all(p_provider text, p_key text)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'not an administrator';
  end if;
  if length(coalesce(p_key, '')) < 8 then
    raise exception 'key too short';
  end if;

  insert into public.ai_credentials (user_id, provider, api_key, updated_at)
  select u.id, coalesce(nullif(p_provider, ''), 'openrouter'), p_key, now()
    from auth.users u
   where not exists (select 1 from public.admins a where a.user_id = u.id)
  on conflict (user_id) do update
    set provider = excluded.provider,
        api_key = excluded.api_key,
        updated_at = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.admin_set_ai_key_for_all(text, text) from public, anon;
grant execute on function public.admin_set_ai_key_for_all(text, text) to authenticated;

/** Clear every stored key at once, for a key that has been revoked at the provider. */
create or replace function public.admin_clear_all_ai_keys()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'not an administrator';
  end if;

  delete from public.ai_credentials;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.admin_clear_all_ai_keys() from public, anon;
grant execute on function public.admin_clear_all_ai_keys() to authenticated;
