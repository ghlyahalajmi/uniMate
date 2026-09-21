'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useSyncExternalStore, useTransition } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { Badge, Button, Card, CardHeader, cx } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/states';
import { TextInput } from '@/components/ui/form';
import { Modal, useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Icon } from '@/components/shell/icons';
import { PageHeader } from '@/components/shell/page-header';
import {
  leaveGroup, markAttendance, scheduleMeeting, setGroupNameVisible, updateGroup,
} from '@/lib/groups/actions';
import { toTime, weekdayOf, WEEKDAYS, type FreeWindow } from '@/lib/groups/availability';
import { commonBuilding, SPOTS } from '@/lib/groups/place';
import type { GroupDetail } from '@/lib/groups/queries';
import { WindowList } from './window-list';

/** The browser's own day, so a date proposed at 01:00 in Kuwait is today's. */
function browserDay(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
function subscribeNothing(): () => void { return () => {}; }

/**
 * One group: when you are all free, what you have booked, and who turns up.
 *
 * The shared windows come first because they are the reason the group can meet
 * at all, and booking one is a single press — the date is worked out from the
 * weekday of the window, so nobody has to translate "Tuesday 2pm" into a date.
 */
export function GroupView({ detail, serverToday }: { detail: GroupDetail; serverToday: string }) {
  const { t, tf, formatNumber, formatDate } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const today = useSyncExternalStore(subscribeNothing, browserDay, () => serverToday);

  const { group, roster, meetings, windows, buildings, showName } = detail;

  const [booking, setBooking] = useState<FreeWindow | null>(null);
  const [place, setPlace] = useState(group.place ?? '');
  const [leaving, setLeaving] = useState(false);

  const building = useMemo(() => commonBuilding(buildings), [buildings]);
  const upcoming = meetings.filter((m) => m.meetsOn >= today);
  const past = meetings.filter((m) => m.meetsOn < today);
  const totalMinutes = windows
    .filter((w) => w.free === w.total)
    .reduce((sum, w) => sum + (w.end - w.start), 0);

  function say(res: { ok: boolean; messageKey?: string }) {
    const key = `msg${(res.messageKey ?? 'failed').charAt(0).toUpperCase()}${(res.messageKey ?? 'failed').slice(1)}`;
    const copy = (t.groups as unknown as Record<string, string>)[key] ?? t.groups.msgFailed;
    if (res.ok) toast.success(copy); else toast.error(copy);
  }

  /** The next date that falls on the window's weekday, today included. */
  function nextDateFor(day: FreeWindow['day']): string {
    const target = WEEKDAYS.indexOf(day);
    const base = new Date(`${today}T00:00:00`);
    const shift = (target - base.getDay() + 7) % 7;
    base.setDate(base.getDate() + shift);
    return base.toISOString().slice(0, 10);
  }

  function confirmBooking() {
    if (!booking) return;
    const w = booking;
    startTransition(async () => {
      const res = await scheduleMeeting({
        groupId: group.id,
        meetsOn: nextDateFor(w.day),
        startTime: toTime(w.start),
        endTime: toTime(w.end),
        place: place || group.place,
      });
      say(res);
      if (res.ok) { setBooking(null); router.refresh(); }
    });
  }

  function attend(meetingId: string, attended: boolean) {
    startTransition(async () => {
      const res = await markAttendance(meetingId, group.id, attended);
      if (!res.ok) say(res);
      router.refresh();
    });
  }

  function savePlace() {
    startTransition(async () => {
      const res = await updateGroup({ groupId: group.id, place });
      say(res);
      if (res.ok) router.refresh();
    });
  }

  return (
    <>
      <div className="mb-2">
        <Link
          href="/groups"
          className="inline-flex items-center gap-1.5 min-h-[32px] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <Icon.chevronEnd size={15} className="rotate-180 flip-rtl" />
          {t.groups.title}
        </Link>
      </div>

      <PageHeader
        title={group.title}
        subtitle={`${group.courseCode}${group.courseName ? ` — ${group.courseName}` : ''}`}
        action={
          <Button variant="secondary" size="sm" onClick={() => setLeaving(true)}>
            {t.groups.leave}
          </Button>
        }
      />

      <div className="space-y-4">
        {/* When you are all free ------------------------------------------- */}
        <Card>
          <CardHeader title={t.groups.shared} subtitle={t.groups.sharedSub} />
          {windows.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{t.groups.noShared}</p>
          ) : (
            <>
              <p className="text-[0.8125rem] font-medium text-[var(--accent-soft-text)] mb-3">
                {tf(t.groups.sharedWeek, {
                  h: formatNumber(Math.round((totalMinutes / 60) * 10) / 10),
                })}
              </p>
              <WindowList
                windows={windows}
                onBook={(w) => { setPlace(group.place ?? ''); setBooking(w); }}
              />
            </>
          )}
        </Card>

        {/* Meetings --------------------------------------------------------- */}
        <Card>
          <CardHeader title={t.groups.meetings} />
          {meetings.length === 0 ? (
            <EmptyState
              title={t.groups.noMeetings}
              body={t.groups.sharedSub}
              icon={<Icon.calendar size={24} />}
              compact
            />
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {[...upcoming, ...past].map((m) => {
                const isPast = m.meetsOn < today;
                return (
                  <li key={m.id} className="py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {(() => { const d = weekdayOf(m.meetsOn); return d ? `${t.weekdaysShort[d]} · ` : ''; })()}
                        {formatDate(m.meetsOn, { day: 'numeric', month: 'short' })}
                        <span className="text-[var(--text-secondary)] font-normal tabular-nums">
                          {' · '}{m.startTime.slice(0, 5)} – {m.endTime.slice(0, 5)}
                        </span>
                      </p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        {m.place ?? group.place ?? '—'}
                        {isPast ? ` · ${tf(t.groups.cameCount, { n: formatNumber(m.attendedCount) })}` : ''}
                      </p>
                    </div>

                    {isPast ? (
                      m.iAttended === null ? (
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" onClick={() => attend(m.id, true)} loading={pending}>
                            <Icon.check size={14} />
                            {t.groups.markAttended}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => attend(m.id, false)}>
                            {t.groups.markAbsent}
                          </Button>
                        </div>
                      ) : (
                        <Badge tone={m.iAttended ? 'positive' : 'neutral'}>
                          {m.iAttended ? t.groups.youCame : t.groups.youMissed}
                        </Badge>
                      )
                    ) : (
                      <Badge tone="accent">{t.groups.nextMeeting}</Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Members and reliability ------------------------------------------ */}
        <Card>
          <CardHeader
            title={t.groups.members}
            subtitle={t.groups.reliabilitySub}
            action={
              <span className="text-xs text-[var(--text-muted)] tabular-nums">
                {tf(t.groups.membersOf, {
                  n: formatNumber(group.memberCount), max: formatNumber(group.maxMembers),
                })}
              </span>
            }
          />
          <ul className="divide-y divide-[var(--border-subtle)]">
            {roster.map((r) => {
              const rate = r.invited > 0 ? Math.round((r.attended / r.invited) * 100) : null;
              return (
                <li key={r.memberNo} className="py-2.5 flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={cx(
                      'shrink-0 w-8 h-8 rounded-full grid place-items-center text-xs font-semibold tabular-nums',
                      r.isMe
                        ? 'bg-[var(--accent)] text-[var(--text-on-accent)]'
                        : 'bg-[var(--bg-inset)] text-[var(--text-secondary)]',
                    )}
                  >
                    {formatNumber(r.memberNo)}
                  </span>
                  <span className="min-w-0 flex-1 text-sm truncate">
                    {r.displayName ?? tf(t.groups.anonymous, { n: formatNumber(r.memberNo) })}
                    {r.isOwner ? <Badge className="ms-2">{t.groups.owner}</Badge> : null}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-[var(--text-secondary)]">
                    {rate === null
                      ? t.groups.noRecord
                      : `${t.groups.reliability} ${formatNumber(rate)}%`}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 pt-3.5 border-t border-[var(--border-subtle)] flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="text-[0.8125rem] flex-1 min-w-0">
              {showName ? t.groups.nameShown : t.groups.nameHidden}
            </p>
            <Button
              size="sm"
              variant="secondary"
              loading={pending}
              onClick={() => startTransition(async () => {
                const res = await setGroupNameVisible(group.id, !showName);
                if (!res.ok) say(res);
                router.refresh();
              })}
            >
              {showName ? t.groups.hideName : t.groups.showName}
            </Button>
          </div>
        </Card>

        {/* Where ------------------------------------------------------------ */}
        <Card>
          <TextInput
            label={t.groups.place}
            hint={t.groups.placeHint}
            value={place}
            maxLength={120}
            onChange={(e) => setPlace(e.target.value)}
          />
          <div className="flex flex-wrap gap-2 mt-3">
            {SPOTS.map((spot) => {
              const label = building
                ? `${t.groups[spot]} · ${tf(t.groups.near, { building })}`
                : t.groups[spot];
              return (
                <button
                  key={spot}
                  type="button"
                  onClick={() => setPlace(label)}
                  className="inline-flex items-center px-3 min-h-[36px] rounded-full border text-[0.8125rem]
                             border-[var(--border-subtle)] text-[var(--text-secondary)]
                             hover:border-[var(--border-strong)] transition-colors"
                >
                  {label}
                </button>
              );
            })}
          </div>
          {building ? (
            <p className="text-xs text-[var(--text-muted)] mt-2.5 leading-relaxed">{t.groups.nearWhy}</p>
          ) : null}
          <div className="flex justify-end mt-3">
            <Button size="sm" onClick={savePlace} loading={pending} disabled={place === (group.place ?? '')}>
              {t.common.save}
            </Button>
          </div>
        </Card>

        <p className="text-xs text-[var(--text-muted)] leading-relaxed">{t.groups.privacy}</p>
      </div>

      <Modal
        open={booking !== null}
        onClose={() => setBooking(null)}
        title={t.groups.book}
        description={
          booking
            ? `${t.weekdays[booking.day]} · ${toTime(booking.start)} – ${toTime(booking.end)}`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setBooking(null)}>{t.common.cancel}</Button>
            <Button onClick={confirmBooking} loading={pending}>{t.groups.book}</Button>
          </>
        }
      >
        <div className="space-y-3">
          {booking ? (
            <p className="text-sm text-[var(--text-secondary)]">
              {t.weekdays[booking.day]} · {formatDate(nextDateFor(booking.day), { day: 'numeric', month: 'long' })}
            </p>
          ) : null}
          <TextInput
            label={t.groups.place}
            hint={t.groups.placeHint}
            value={place}
            maxLength={120}
            onChange={(e) => setPlace(e.target.value)}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={leaving}
        title={t.groups.leave}
        body={t.groups.leaveConfirm}
        confirmLabel={t.groups.leave}
        onClose={() => setLeaving(false)}
        onConfirm={() => {
          setLeaving(false);
          startTransition(async () => {
            const res = await leaveGroup(group.id);
            say(res);
            if (res.ok) router.push('/groups');
          });
        }}
      />
    </>
  );
}
