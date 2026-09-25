-- =============================================================================
-- UniMate — 0034 wake a phone only when there is something to say
--
-- The job knew a reminder's day but not the device's clock, so it woke every
-- device of anybody with anything pending *today* — from midnight UTC, every
-- minute, until the thing was finally due. Each of those wakes reached a
-- service worker that asked the app, was told nothing had arrived yet, and
-- put up a quiet "nothing is due yet" notice. A reminder set for 19:00 in
-- Kuwait produced sixteen hours of those before it produced the reminder.
--
-- So the device now says which clock it keeps, once, when it subscribes, and
-- the decision is made in that clock. A wake means something is genuinely
-- due there — which is what lets the service worker stop announcing nothing.
--
-- Still nothing about a reminder crosses the network: the push carries no
-- payload, and the phone fetches the words over its owner's own session.
-- =============================================================================

alter table public.push_subscriptions
  add column if not exists time_zone text;

comment on column public.push_subscriptions.time_zone is
  'IANA name reported by the device, e.g. Asia/Kuwait. Null means UTC.';

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
   * Every subscribed device, with the moment it is living in.
   *
   * A zone the server does not recognise would throw and take the whole run
   * down with it, so an unknown name is read as UTC rather than trusted.
   */
  with device as (
    select
      s.endpoint,
      s.user_id,
      (now() at time zone coalesce(z.name, 'UTC')) as local_now
    from public.push_subscriptions s
    left join pg_timezone_names z on z.name = s.time_zone
  ),
  waiting as (
    -- A reminder that has actually arrived on that device's clock.
    select d.endpoint
      from device d
      join public.reminders r on r.user_id = d.user_id
     where r.status = 'scheduled'
       and r.notified_at is null
       and (
         r.remind_on < d.local_now::date
         or (r.remind_on = d.local_now::date
             and (r.remind_at is null or r.remind_at <= d.local_now::time))
       )
    union
    /*
     * A task whose whole day has gone there — and gone recently enough to be
     * worth saying. Due today is not late; it is today.
     */
    select d.endpoint
      from device d
      join public.tasks t on t.user_id = d.user_id
     where t.status <> 'completed'
       and t.overdue_notified_at is null
       and t.due_date is not null
       and t.due_date < d.local_now::date
       and t.due_date >= d.local_now::date - 14
  )
  select array_agg(distinct endpoint) into v_endpoints from waiting;

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

revoke all on function public.push_due_reminders() from public, anon, authenticated;
