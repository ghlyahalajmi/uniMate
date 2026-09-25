-- =============================================================================
-- The minute hand, inside the database.
--
-- A reminder set for 19:03 is wrong at 19:30, and nothing else here keeps time
-- to the minute: Vercel's scheduler runs daily on this plan. Postgres has one,
-- and the reminders are already in Postgres, so the clock lives beside the
-- data rather than a network away from it.
--
-- What crosses the network is a list of push addresses and nothing else. The
-- endpoint route holds no database credential and cannot read a reminder; the
-- phone asks for the words itself, over its owner's own session.
--
-- The two secrets are created by hand in the Vault, not here:
--   push_endpoint_url  — https://<deployment>/api/reminders/push
--   push_cron_secret   — the same value as PUSH_CRON_SECRET in the environment
-- =============================================================================

create extension if not exists pg_cron  with schema extensions;
create extension if not exists pg_net   with schema extensions;

create or replace function public.push_due_reminders()
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault', 'pg_temp'
as $$
declare
  v_endpoints text[];
  v_url       text;
  v_secret    text;
  v_gone      jsonb;
begin
  -- The previous answer, if the pusher has replied since the last run: every
  -- address it reports gone is one the browser has thrown away, and retrying
  -- it every minute for ever is the only way this job could become expensive.
  select (r.content::jsonb -> 'gone')
    into v_gone
    from net._http_response r
   where r.status_code = 200
     and r.created > now() - interval '10 minutes'
   order by r.created desc
   limit 1;

  if v_gone is not null and jsonb_typeof(v_gone) = 'array' then
    delete from public.push_subscriptions
     where endpoint in (select jsonb_array_elements_text(v_gone));
  end if;

  /*
   * Who has something waiting.
   *
   * The window is the whole of today and anything earlier, not this minute:
   * a reminder is stored as a day plus a wall-clock time in a timezone this
   * database was never told. The device knows its own clock and makes the
   * real decision — woken early it shows nothing, woken late it still shows.
   */
  select array_agg(distinct s.endpoint)
    into v_endpoints
    from public.reminders r
    join public.push_subscriptions s on s.user_id = r.user_id
   where r.status = 'scheduled'
     and r.notified_at is null
     and r.remind_on <= current_date;

  if v_endpoints is null or array_length(v_endpoints, 1) is null then
    return;
  end if;

  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'push_endpoint_url';
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'push_cron_secret';

  if v_url is null or v_secret is null then
    return;
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-unimate-push', v_secret
               ),
    body    := jsonb_build_object('endpoints', to_jsonb(v_endpoints)),
    timeout_milliseconds := 20000
  );
end;
$$;

-- Nobody signs in as this. It is the scheduler's, and only the scheduler's.
revoke all on function public.push_due_reminders() from public, anon, authenticated;

select cron.unschedule('push-due-reminders')
  where exists (select 1 from cron.job where jobname = 'push-due-reminders');

select cron.schedule(
  'push-due-reminders',
  '* * * * *',
  $CRON$select public.push_due_reminders()$CRON$
);
