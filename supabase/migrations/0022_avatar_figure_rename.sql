-- =============================================================================
-- UniMate — 0022 avatar figure rename
--
-- The avatar's figure was named girl/boy and is now female/male.
--
-- Designs already saved carry the old word, and the parser would quietly fall
-- back to the default for it — silently changing a choice somebody made. One
-- account had already built an avatar by the time this landed, so the rows are
-- rewritten rather than left to rot.
-- =============================================================================

update public.profiles
   set avatar_design = jsonb_set(avatar_design, '{figure}', '"female"')
 where avatar_design->>'figure' = 'girl';

update public.profiles
   set avatar_design = jsonb_set(avatar_design, '{figure}', '"male"')
 where avatar_design->>'figure' = 'boy';
