-- =============================================================================
-- UniMate — 0013 note design
--
-- Paper and stickers. A note people want to open is a note they keep using, so
-- a note can be given a paper pattern, a tint, and a handful of stickers placed
-- where the student wants them.
--
-- Both columns hold *keys*, never CSS: the pattern is one of a fixed list and
-- the tint reuses the `color` column the table already had. Nothing a student
-- types ever reaches a style attribute, so a note cannot be used to smuggle
-- styling — or anything else — into the page.
--
-- Stickers are jsonb rather than a table because they are decoration, not
-- records: nothing joins to them, nothing reports on them, and they are always
-- read and written with the note. The constraint here bounds the shape (an
-- array, at most twelve); the exact fields are validated in the server action,
-- and anything unrecognised is dropped when the note is read.
-- =============================================================================

alter table public.notes
  add column if not exists theme text not null default 'plain',
  add column if not exists stickers jsonb not null default '[]'::jsonb;

comment on column public.notes.theme is
  'Paper pattern key: plain, lined, grid or dots. Never CSS.';
comment on column public.notes.color is
  'Paper tint key: default, yellow, mint, sky, rose, lilac or kraft. Never a hex value.';
comment on column public.notes.stickers is
  'Up to twelve placed stickers: [{ "k": key, "x": 0-100, "y": 0-100, "r": -30..30 }].';

do $$
begin
  alter table public.notes add constraint notes_theme_known
    check (theme in ('plain', 'lined', 'grid', 'dots'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.notes add constraint notes_color_known
    check (
      color is null
      or color in ('default', 'yellow', 'mint', 'sky', 'rose', 'lilac', 'kraft')
    );
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.notes add constraint notes_stickers_shape
    check (jsonb_typeof(stickers) = 'array' and jsonb_array_length(stickers) <= 12);
exception when duplicate_object then null;
end $$;
