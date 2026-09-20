'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { Badge, Button, Card, CardHeader, cx } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/states';
import { TextInput, TextArea, Select } from '@/components/ui/form';
import { Modal, useToast } from '@/components/ui/toast';
import { Icon } from '@/components/shell/icons';
import { PageHeader } from '@/components/shell/page-header';
import { createGroup, joinGroup } from '@/lib/groups/actions';
import type { DiscoveredGroup, GroupSummary } from '@/lib/groups/queries';
import { WindowList } from './window-list';

/**
 * Study groups: the ones you are in, and the ones you could join.
 *
 * Every card leads with the same number — how many hours a week that group
 * could actually study together, you included. It is the only thing on the
 * screen that cannot be guessed by reading a title, and it is computed from
 * everybody's timetable rather than asked for in a poll.
 */
export function GroupsView({
  courses, selectedCourse, mine, found, hasTimetable,
}: {
  courses: Array<{ code: string; name: string }>;
  selectedCourse: string;
  mine: GroupSummary[];
  found: DiscoveredGroup[];
  hasTimetable: boolean;
}) {
  const { t, tf, formatNumber } = useI18n();
  const router = useRouter();
  const toast = useToast();

  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [size, setSize] = useState('6');

  const course = courses.find((c) => c.code.toUpperCase() === selectedCourse);
  const notJoined = found.filter((g) => !g.isMember);

  function say(res: { ok: boolean; messageKey?: string }) {
    const key = `msg${(res.messageKey ?? 'failed').charAt(0).toUpperCase()}${(res.messageKey ?? 'failed').slice(1)}`;
    const copy = (t.groups as unknown as Record<string, string>)[key] ?? t.groups.msgFailed;
    if (res.ok) toast.success(copy); else toast.error(copy);
  }

  function onJoin(groupId: string) {
    startTransition(async () => {
      const res = await joinGroup(groupId);
      say(res);
      if (res.ok) router.push(`/groups/${groupId}`);
    });
  }

  function onCreate() {
    if (!selectedCourse) return;
    startTransition(async () => {
      const res = await createGroup({
        courseCode: selectedCourse,
        courseName: course?.name ?? null,
        title,
        note,
        maxMembers: Number(size),
      });
      say(res);
      if (res.ok) {
        setCreating(false);
        setTitle('');
        setNote('');
        if (res.groupId) router.push(`/groups/${res.groupId}`);
      }
    });
  }

  return (
    <>
      <PageHeader
        title={t.groups.title}
        subtitle={t.groups.subtitle}
        action={
          courses.length > 0 ? (
            <Button variant="secondary" onClick={() => setCreating(true)}>
              <Icon.plus size={16} />
              {t.groups.create}
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-4">
        {!hasTimetable ? (
          <Card className="border-[var(--warning-border)] bg-[var(--warning-soft)]">
            <p className="text-[0.8125rem] leading-relaxed">{t.groups.noTimetable}</p>
            <Link
              href="/courses"
              className="inline-flex items-center gap-1.5 min-h-[36px] text-[0.8125rem] font-medium text-[var(--accent-soft-text)] hover:underline mt-1"
            >
              {t.nav.courses}
              <Icon.chevronEnd size={14} className="flip-rtl" />
            </Link>
          </Card>
        ) : null}

        {/* Your groups ------------------------------------------------------ */}
        <Card>
          <CardHeader title={t.groups.mine} />
          {mine.length === 0 ? (
            <EmptyState
              title={t.groups.none}
              body={t.groups.noneBody}
              icon={<Icon.students size={24} />}
              compact
            />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {mine.map((g) => (
                <li key={g.id} className="min-w-0">
                  <Link
                    href={`/groups/${g.id}`}
                    className="h-full flex flex-col gap-1.5 p-3.5 rounded-[var(--radius-md)] border
                               border-[var(--border-subtle)] hover:border-[var(--accent)]
                               hover:bg-[var(--bg-accent-soft)] transition-colors"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Badge tone="accent">{g.courseCode}</Badge>
                      <span className="text-sm font-medium truncate">{g.title}</span>
                    </span>
                    <span className="text-xs text-[var(--text-muted)] tabular-nums">
                      {tf(t.groups.membersOf, {
                        n: formatNumber(g.memberCount), max: formatNumber(g.maxMembers),
                      })}
                      {g.place ? ` · ${g.place}` : ''}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Find a group ----------------------------------------------------- */}
        <Card>
          <CardHeader title={t.groups.find} subtitle={t.groups.findSub} />

          {courses.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">{t.study.empty}</p>
          ) : (
            <>
              <div role="radiogroup" aria-label={t.groups.chooseCourse} className="flex flex-wrap gap-2">
                {courses.map((c) => {
                  const selected = c.code.toUpperCase() === selectedCourse;
                  return (
                    <button
                      key={c.code}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      title={c.name}
                      onClick={() => router.push(`/groups?course=${encodeURIComponent(c.code)}`)}
                      className={cx(
                        'inline-flex items-center px-3 min-h-[38px] rounded-full border text-sm transition-colors',
                        selected
                          ? 'border-[var(--accent)] bg-[var(--bg-accent-soft)] text-[var(--accent-soft-text)] font-medium'
                          : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]',
                      )}
                    >
                      {c.code}
                    </button>
                  );
                })}
              </div>

              {notJoined.length === 0 ? (
                <div className="mt-4">
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    {t.groups.noResults}
                  </p>
                  <Button className="mt-3" onClick={() => setCreating(true)}>
                    <Icon.plus size={16} />
                    {tf(t.groups.createFor, { code: selectedCourse })}
                  </Button>
                </div>
              ) : (
                <ul className="space-y-3 mt-4">
                  {notJoined.map((g) => (
                    <li
                      key={g.id}
                      className="p-3.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{g.title}</p>
                          <p className="text-xs text-[var(--text-muted)] tabular-nums mt-0.5">
                            {tf(t.groups.membersOf, {
                              n: formatNumber(g.memberCount), max: formatNumber(g.maxMembers),
                            })}
                            {g.memberCount < g.maxMembers
                              ? ` · ${tf(t.groups.spotsLeft, { n: formatNumber(g.maxMembers - g.memberCount) })}`
                              : ` · ${t.groups.full}`}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => onJoin(g.id)}
                          loading={pending}
                          disabled={g.memberCount >= g.maxMembers}
                        >
                          {t.groups.join}
                        </Button>
                      </div>

                      {g.note ? (
                        <p className="text-[0.8125rem] text-[var(--text-secondary)] mt-2 leading-relaxed">
                          {g.note}
                        </p>
                      ) : null}

                      {/* The number the whole feature exists to produce. */}
                      <p className="text-[0.8125rem] font-medium text-[var(--accent-soft-text)] mt-2.5">
                        {g.sharedMinutes > 0
                          ? tf(t.groups.sharedWeek, {
                            h: formatNumber(Math.round((g.sharedMinutes / 60) * 10) / 10),
                          })
                          : t.groups.noShared}
                      </p>

                      {g.windows.length > 0 ? (
                        <div className="mt-2.5">
                          <WindowList windows={g.windows} />
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          <p className="text-xs text-[var(--text-muted)] mt-4 leading-relaxed">{t.groups.privacy}</p>
        </Card>
      </div>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title={selectedCourse ? tf(t.groups.createFor, { code: selectedCourse }) : t.groups.create}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(false)}>{t.common.cancel}</Button>
            <Button onClick={onCreate} loading={pending} disabled={!title.trim() || !selectedCourse}>
              {t.groups.createCta}
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <TextInput
            label={t.groups.groupTitle}
            hint={t.groups.groupTitleHint}
            value={title}
            maxLength={80}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <TextArea
            label={t.groups.note}
            value={note}
            maxLength={400}
            onChange={(e) => setNote(e.target.value)}
            hint={t.common.optional}
          />
          <Select
            label={t.groups.size}
            value={size}
            onChange={(e) => setSize(e.target.value)}
            options={['3', '4', '5', '6', '8', '10'].map((n) => ({ value: n, label: formatNumber(Number(n)) }))}
          />
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">{t.groups.needUniversity}</p>
        </div>
      </Modal>
    </>
  );
}
