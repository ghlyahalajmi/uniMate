-- =============================================================================
-- UniMate — 0007 class links
--
-- The Student Hub is a page inside UniMate rather than a jump to another site,
-- so its links need somewhere to live. They are the same shape as the personal
-- hub links — a name, an https address, a note — so they share the table and
-- gain a kind rather than getting one of their own.
--
-- Still per-student rows under the same row level security: each student keeps
-- their own copy of the class list. Making one row visible to every signed-in
-- account would be a different security model, and not one to adopt silently.
-- =============================================================================

alter type public.hub_link_kind add value if not exists 'class';
