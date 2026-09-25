-- =============================================================================
-- Where a phone says "send my reminders here".
--
-- One row per device, not per student: somebody with a laptop and a phone has
-- two, and turning it off on one must not silence the other. The endpoint is
-- the address the browser's own push service hands out; it is unguessable and
-- it is all we ever send to, which is why nothing about a reminder travels
-- through it — see the push route for why the notification is fetched rather
-- than delivered.
-- =============================================================================

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  endpoint    text not null,
  -- Kept for a future encrypted payload; unused while pushes carry none.
  p256dh      text,
  auth        text,
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_sent_at timestamptz,
  -- Re-subscribing the same device must update rather than duplicate.
  unique (endpoint)
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;

revoke all on public.push_subscriptions from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- A student sees and changes only their own devices. Same rule as every other
-- table here, and the reason a stolen endpoint still reaches nobody else.
create policy push_subscriptions_select on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));

create policy push_subscriptions_insert on public.push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy push_subscriptions_update on public.push_subscriptions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy push_subscriptions_delete on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));
