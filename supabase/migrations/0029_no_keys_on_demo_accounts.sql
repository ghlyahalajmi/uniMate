-- =============================================================================
-- UniMate — 0029 no credential on an account anybody can sign into
--
-- The demo account exists so a visitor can look around without registering, so
-- its password is published and its sign-in is one unguarded button. That is
-- fine for invented coursework. It is not fine for a credential: an account
-- may read its own row, so a key stored on the demo account is a key handed to
-- everyone who clicks the button.
--
-- Deleting the row once would not hold — the next bulk key write would put it
-- straight back. So the rule is in the database, where it is checked on every
-- write rather than remembered by whoever writes the next feature.
--
-- The key that was there is burned. It must be revoked at the provider; this
-- migration only stops the next one being exposed the same way.
-- =============================================================================

create or replace function public.reject_credential_on_demo_account()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1 from public.profiles p
     where p.user_id = new.user_id and p.is_demo
  ) then
    raise exception 'the demonstration account cannot hold an API key';
  end if;
  return new;
end;
$$;

revoke all on function public.reject_credential_on_demo_account() from public, anon, authenticated;

drop trigger if exists reject_credential_on_demo_account on public.ai_credentials;
create trigger reject_credential_on_demo_account
  before insert or update on public.ai_credentials
  for each row execute function public.reject_credential_on_demo_account();

-- Whatever is there now goes, including the burned key.
delete from public.ai_credentials c
 where exists (select 1 from public.profiles p where p.user_id = c.user_id and p.is_demo);

-- -----------------------------------------------------------------------------
-- One key, many readers
-- -----------------------------------------------------------------------------
--
-- These wrote one key onto every student's row. Each of those students can read
-- their own row, so a key shared with forty people was a key forty people
-- could take — and if any one of them leaked it, nothing said which.
--
-- A key meant for everyone belongs in the deployment's environment, where the
-- server reads it and no session can. That path already exists:
-- OPENROUTER_API_KEY is checked before anything stored per account.
drop function if exists public.admin_set_ai_key_for_all(text, text);
drop function if exists public.admin_set_ai_key(uuid, text, text);
