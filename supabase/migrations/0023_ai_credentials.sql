-- =============================================================================
-- UniMate — 0023 the student's own AI key
--
-- Until now the AI features could only be switched on by whoever deploys the
-- app, by putting a key in the environment. That leaves a student looking at
-- "AI features are not configured" with nothing they can do about it.
--
-- A student may now save their own key — OpenRouter has a free tier — and it
-- powers the agents for their account only. The row is theirs: RLS is on and
-- forced, anon has no grants at all, and nothing but the owner's own session
-- can read it. The key is never sent back to the browser; the screen shows
-- only the last four characters, which come from a generated column so the
-- server does not have to trust the client for them.
-- =============================================================================

create table if not exists public.ai_credentials (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  provider   text not null check (provider in ('openrouter', 'anthropic')),
  api_key    text not null check (length(api_key) between 8 and 400),
  -- What Settings is allowed to display. Generated, so the hint can never
  -- drift from the key and the full value never has to leave the server.
  hint       text generated always as (right(api_key, 4)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_credentials enable row level security;
alter table public.ai_credentials force row level security;

revoke all on public.ai_credentials from anon;
grant select, insert, update, delete on public.ai_credentials to authenticated;

drop policy if exists "ai_credentials_own_select" on public.ai_credentials;
drop policy if exists "ai_credentials_own_insert" on public.ai_credentials;
drop policy if exists "ai_credentials_own_update" on public.ai_credentials;
drop policy if exists "ai_credentials_own_delete" on public.ai_credentials;

create policy "ai_credentials_own_select" on public.ai_credentials
  for select to authenticated using (user_id = (select auth.uid()));

create policy "ai_credentials_own_insert" on public.ai_credentials
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy "ai_credentials_own_update" on public.ai_credentials
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "ai_credentials_own_delete" on public.ai_credentials
  for delete to authenticated using (user_id = (select auth.uid()));
