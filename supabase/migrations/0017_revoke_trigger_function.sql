-- The streak trigger is not an API endpoint.
--
-- `activity_days_refresh_streak()` returns `trigger` and exists only to fire
-- on `activity_days`. It was created in 0014 without an explicit grant, so it
-- inherited EXECUTE for `public` — which means `anon` and `authenticated`
-- could both reach it over `/rest/v1/rpc/`. Calling it that way cannot do
-- much (a trigger function outside a trigger has no `NEW` row and errors),
-- but a SECURITY DEFINER function reachable by an unauthenticated caller is
-- not something to leave standing on the argument that the damage is small.
--
-- Triggers run as the table owner and ignore EXECUTE grants entirely, so
-- revoking here changes nothing about how the streak is refreshed.

revoke all on function public.activity_days_refresh_streak() from public;
revoke all on function public.activity_days_refresh_streak() from anon;
revoke all on function public.activity_days_refresh_streak() from authenticated;
