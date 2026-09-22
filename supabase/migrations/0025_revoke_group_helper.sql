-- =============================================================================
-- UniMate — 0025 the helper is not an endpoint
--
-- is_group_member is what the other group functions ask before they answer.
-- Nothing in the app calls it over the API, and a SECURITY DEFINER function
-- sitting at /rest/v1/rpc is worth having only when something actually needs
-- it there.
--
-- The functions that use it are unaffected: each is SECURITY DEFINER itself,
-- so the call inside is made as its owner rather than as the student.
-- =============================================================================

revoke execute on function public.is_group_member(uuid) from public, anon, authenticated;
