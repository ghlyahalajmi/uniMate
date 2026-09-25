-- =============================================================================
-- UniMate — 0035 a device is woken once for a thing, not once a minute
--
-- The job asks "is anything waiting for this device?" every minute, and the
-- thing that stops it asking again is the device marking the item announced
-- once it has shown it. When the device cannot do that — its session has
-- expired, it is offline at the moment it is woken, the browser killed the
-- fetch — nothing is marked, so the answer is still yes a minute later, and
-- the phone is woken again. And again. For ever.
--
-- That is what was really behind the string of notifications: not the words
-- in them, but a retry with no bound on it. So the job now remembers what it
-- last woke each device for. A new item wakes it at once, as before; the same
-- unhandled item waits an hour before being raised again.
--
-- The count is per device rather than per student, because a laptop that
-- showed the reminder must not silence the phone that did not.
-- =============================================================================

alter table public.push_subscriptions
  add column if not exists last_wake_key text,
  add column if not exists last_wake_at  timestamptz;

comment on column public.push_subscriptions.last_wake_key is
  'Fingerprint of the items this device was last woken for; unchanged means the same unhandled thing.';

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

  with device as (
    -- Every subscribed device, with the moment it is living in. A zone this
    -- server does not know is read as UTC rather than allowed to throw.
    select
      s.endpoint,
      s.user_id,
      (now() at time zone coalesce(z.name, 'UTC')) as local_now
    from public.push_subscriptions s
    left join pg_timezone_names z on z.name = s.time_zone
  ),
  waiting as (
    -- A reminder that has actually arrived on that device's clock.
    select d.endpoint, r.id::text as item
      from device d
      join public.reminders r on r.user_id = d.user_id
     where r.status = 'scheduled'
       and r.notified_at is null
       and (
         r.remind_on < d.local_now::date
         or (r.remind_on = d.local_now::date
             and (r.remind_at is null or r.remind_at <= d.local_now::time))
       )
    union all
    -- A task whose whole day has gone there, recently enough to be worth
    -- saying. Due today is not late; it is today.
    select d.endpoint, t.id::text
      from device d
      join public.tasks t on t.user_id = d.user_id
     where t.status <> 'completed'
       and t.overdue_notified_at is null
       and t.due_date is not null
       and t.due_date < d.local_now::date
       and t.due_date >= d.local_now::date - 14
  ),
  keyed as (
    select endpoint, md5(string_agg(item, ',' order by item)) as wake_key
      from waiting
     group by endpoint
  ),
  ring as (
    select k.endpoint, k.wake_key
      from keyed k
      join public.push_subscriptions s on s.endpoint = k.endpoint
     -- Something new to say, or an hour since the last unanswered attempt.
     where s.last_wake_key is distinct from k.wake_key
        or s.last_wake_at is null
        or s.last_wake_at < now() - interval '60 minutes'
  ),
  marked as (
    update public.push_subscriptions s
       set last_wake_key = r.wake_key,
           last_wake_at  = now(),
           last_sent_at  = now()
      from ring r
     where s.endpoint = r.endpoint
    returning s.endpoint
  )
  select array_agg(endpoint) into v_endpoints from marked;

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
