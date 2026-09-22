-- =============================================================================
-- UniMate — 0024 sign up and be in
--
-- The product does not want a confirmation step: a student signs up and
-- expects to be inside, not waiting on a mail server. The provider setting for
-- that lives in a dashboard rather than in this repository, so the same thing
-- is done where a migration can do it — the confirmation time is stamped as
-- the row is written, which is exactly the state a confirmed account is in.
--
-- It only ever fills a blank, so an account that already carries a
-- confirmation time is left alone, and the trigger touches nothing but the row
-- being inserted.
-- =============================================================================

create or replace function public.confirm_new_user_email()
returns trigger
language plpgsql
set search_path = pg_temp
as $$
begin
  if new.email_confirmed_at is null then
    new.email_confirmed_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.confirm_new_user_email() from public, anon, authenticated;

drop trigger if exists confirm_new_user_email on auth.users;
create trigger confirm_new_user_email
  before insert on auth.users
  for each row execute function public.confirm_new_user_email();
