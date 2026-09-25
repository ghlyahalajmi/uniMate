-- =============================================================================
-- UniMate — 0032 a task that slipped past its date says so
--
-- "Overdue" was a red word on a list nobody had opened. The student who missed
-- the deadline is exactly the student who is not looking at the task screen,
-- so the app has to come to them: the same alert a reminder gets, and the same
-- push to a phone, for a task whose day has gone.
--
-- Told once, not every minute — that is what the column is for. It is written
-- by the student's own session under the policies already on this table, so
-- there is no new grant and no new policy here.
-- =============================================================================

alter table public.tasks
  add column if not exists overdue_notified_at timestamptz;

-- The watcher asks "anything late and unannounced?" once a minute, per student.
create index if not exists tasks_overdue_idx
  on public.tasks (user_id, due_date)
  where overdue_notified_at is null and status <> 'completed';

/*
 * Re-open a task and it is a live task again.
 *
 * Finishing something late and then re-opening it is ordinary — a mark comes
 * back, a draft is rejected — and if the notice stayed marked, the app would
 * never mention it again. Clearing the mark when the status leaves 'completed'
 * means the second chance gets the same nudge the first one did.
 */
create or replace function public.clear_overdue_notice()
returns trigger
language plpgsql
as $$
begin
  if new.status <> 'completed' and old.status = 'completed' then
    new.overdue_notified_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_clear_overdue_notice on public.tasks;
create trigger tasks_clear_overdue_notice
  before update on public.tasks
  for each row execute function public.clear_overdue_notice();

-- ---------------------------------------------------------------------------
-- The minute hand now watches deadlines as well as reminders.
--
-- Only the "who has something waiting" query changes: a device is woken for a
-- reminder that is due *or* for a task whose date has passed. As before, the
-- push itself carries nothing — the phone asks UniMate for the words over its
-- owner's own session, and decides against its own clock.
-- ---------------------------------------------------------------------------
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

  select array_agg(distinct endpoint)
    into v_endpoints
    from (
      select s.endpoint
        from public.reminders r
        join public.push_subscriptions s on s.user_id = r.user_id
       where r.status = 'scheduled'
         and r.notified_at is null
         and r.remind_on <= current_date
      union
      /*
       * A task is late only once the whole of its day has gone: due today is
       * not late, it is today. current_date here is the database's day and the
       * device re-checks against its own, which can only ever delay the notice
       * by hours — never announce something early.
       */
      select s.endpoint
        from public.tasks t
        join public.push_subscriptions s on s.user_id = t.user_id
       where t.status <> 'completed'
         and t.overdue_notified_at is null
         and t.due_date is not null
         and t.due_date < current_date
         /*
          * The fortnight the app itself will show, less the day this database
          * can be out by. Without a floor, the job would wake a phone every
          * minute for ever over a task from last term that the app has
          * already decided is not worth mentioning — the device asks, is told
          * nothing is due, and marks nothing. Thirteen rather than fourteen
          * because current_date here is UTC and the device's day can be
          * either side of it: a day narrower is a wake that does not happen,
          * which the app catches next time it is opened; a day wider is that
          * silent loop.
          */
         and t.due_date >= current_date - interval '13 days'
    ) waiting;

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
