-- =============================================================================
-- UniMate — 0016 notes on the home screen
--
-- One boolean, and it belongs to the student rather than to a heuristic: a note
-- appears on the home screen because they said so, not because it was recent,
-- long, starred or touched today.
--
-- Default false. A home screen that fills itself with every note ever written
-- is a home screen people stop reading, and turning things *off* one by one is
-- a worse first experience than turning the two that matter on.
-- =============================================================================

alter table public.notes
  add column if not exists show_on_home boolean not null default false;

comment on column public.notes.show_on_home is
  'The student chose to pin this note to the home screen. Never set automatically.';

-- The home screen asks one question of this table — "which of mine are pinned"
-- — so the index answers exactly that and nothing else.
create index if not exists notes_home_idx
  on public.notes (user_id, position)
  where show_on_home and not is_archived;
