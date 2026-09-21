-- =============================================================================
-- UniMate — 0012 harden the two functions the linter flagged
--
-- Neither is a hole today, but both are the kind of thing that becomes one
-- later, and a project that lets other students' data cross has no business
-- leaving them:
--
--   * `handle_new_user` is a trigger function, and trigger functions have no
--     reason to be callable over the REST API. It was reachable by `anon` as a
--     security-definer RPC, so EXECUTE is revoked from everyone; the trigger
--     itself runs as the table owner and is unaffected.
--   * `touch_updated_at` ran with whatever search_path the caller had. Pinning
--     it means a schema planted ahead of `public` cannot change what it calls.
-- =============================================================================

alter function public.touch_updated_at() set search_path = public, pg_temp;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;
