-- =============================================================================
-- UniMate — 0006 hub
--
-- A launch page the student owns: their projects, their university links, the
-- handful of pages they open every day. Rows rather than hard-coded markup,
-- because the whole point is that they edit it without a deploy.
--
-- `url` is constrained to https at the database level, not only in the form.
-- These links are rendered as anchors, so a `javascript:` or `data:` URL that
-- slipped past client validation would be a script-injection vector on their
-- own page. The check is the backstop the UI cannot bypass.
-- =============================================================================

create type public.hub_link_kind as enum ('project', 'university', 'resource');

create table public.hub_links (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null check (length(btrim(title)) between 1 and 120),
  url         text not null check (url ~* '^https://' and length(url) <= 2000),
  description text check (description is null or length(btrim(description)) <= 300),
  kind        public.hub_link_kind not null default 'resource',
  -- Manual ordering within a group; ties fall back to creation order.
  position    int not null default 0,
  is_pinned   boolean not null default false,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index hub_links_user_idx on public.hub_links (user_id, kind, position);

create trigger hub_links_touch before update on public.hub_links
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Same row level security as every other table: enabled and forced, one
-- policy per operation, nothing readable by anon.
-- ---------------------------------------------------------------------------
alter table public.hub_links enable row level security;
alter table public.hub_links force row level security;

create policy hub_links_select_own on public.hub_links
  for select to authenticated using ((select auth.uid()) = user_id);
create policy hub_links_insert_own on public.hub_links
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy hub_links_update_own on public.hub_links
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy hub_links_delete_own on public.hub_links
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.hub_links from anon;
