'use client';

import { useId, useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { Card, CardHeader, cx } from '@/components/ui/primitives';
import { Icon } from '@/components/shell/icons';
import type { Course } from '@/types/database';

export interface Contact {
  role: 'instructor' | 'ta';
  name: string | null;
  email: string | null;
  office: string | null;
  officeHours: string | null;
}

/** Pulls the two people off a course row into a shape the panel can loop over. */
export function contactsOf(course: Course): Contact[] {
  return [
    {
      role: 'instructor' as const,
      name: course.instructor,
      email: course.instructor_email,
      office: course.instructor_office,
      officeHours: course.instructor_office_hours,
    },
    {
      role: 'ta' as const,
      name: course.ta_name,
      email: course.ta_email,
      office: course.ta_office,
      officeHours: course.ta_office_hours,
    },
  ].filter((c) => c.name || c.email || c.office || c.officeHours);
}

/**
 * The people who teach the course, one disclosure button each.
 *
 * A button rather than a always-open block because the two things a student
 * opens this page for are the schedule and the grade; a contact is something
 * they reach for deliberately, usually to write an email. Opening one closes
 * the other, so the page never grows two panels deep.
 */
export function CourseContacts({ course }: { course: Course }) {
  const { t } = useI18n();
  const [open, setOpen] = useState<'instructor' | 'ta' | null>(null);
  const baseId = useId();

  const contacts = contactsOf(course);
  if (contacts.length === 0) {
    return (
      <Card>
        <CardHeader title={t.contacts.title} />
        <p className="text-sm text-[var(--text-secondary)]">{t.contacts.none}</p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title={t.contacts.title} subtitle={t.contacts.subtitle} />

      <div className="flex flex-wrap gap-2">
        {contacts.map((c) => {
          const isOpen = open === c.role;
          return (
            <button
              key={c.role}
              type="button"
              aria-expanded={isOpen}
              aria-controls={`${baseId}-${c.role}`}
              onClick={() => setOpen(isOpen ? null : c.role)}
              className={cx(
                'inline-flex items-center gap-2.5 ps-2.5 pe-3.5 min-h-[52px] text-start',
                'rounded-[var(--radius-md)] border transition-colors',
                isOpen
                  ? 'bg-[var(--bg-accent-soft)] border-[var(--accent)] text-[var(--accent-soft-text)]'
                  : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]',
              )}
            >
              <span
                aria-hidden="true"
                className={cx(
                  'w-8 h-8 grid place-items-center rounded-[0.7rem] shrink-0',
                  isOpen ? 'bg-[var(--accent)] text-[var(--text-on-accent)]' : 'bg-[var(--bg-inset)] text-[var(--text-muted)]',
                )}
              >
                <Icon.person size={17} />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                  {c.role === 'instructor' ? t.contacts.instructor : t.contacts.ta}
                </span>
                <span className="block text-sm font-medium truncate max-w-[14rem]">
                  {c.name ?? t.contacts.unnamed}
                </span>
              </span>
              <Icon.chevronDown
                size={16}
                className={cx('ms-auto shrink-0 transition-transform', isOpen && 'rotate-180')}
              />
            </button>
          );
        })}
      </div>

      {contacts.map((c) => (
        <div
          key={c.role}
          id={`${baseId}-${c.role}`}
          hidden={open !== c.role}
          className="mt-4 pt-4 border-t border-[var(--border-subtle)]"
        >
          <ContactDetail contact={c} />
        </div>
      ))}
    </Card>
  );
}

function ContactDetail({ contact }: { contact: Contact }) {
  const { t } = useI18n();

  return (
    <div className="space-y-3">
      <div>
        <p className="font-display text-base font-semibold">{contact.name ?? t.contacts.unnamed}</p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          {contact.role === 'instructor' ? t.contacts.instructor : t.contacts.ta}
        </p>
      </div>

      {contact.email ? (
        <a
          href={`mailto:${encodeURIComponent(contact.email)}`}
          className={cx(
            'inline-flex items-center gap-2 px-3.5 min-h-[42px] rounded-[var(--radius-sm)]',
            'text-sm font-medium bg-[var(--accent)] text-[var(--text-on-accent)]',
            'hover:bg-[var(--accent-hover)] transition-colors',
          )}
        >
          <Icon.mail size={16} />
          {t.contacts.emailThem}
        </a>
      ) : null}

      <dl className="grid sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
        {contact.email ? (
          <Detail icon={<Icon.mail size={15} />} label={t.contacts.email}>
            {/* Selectable as text too, for anyone who would rather copy it. */}
            <span className="break-all">{contact.email}</span>
          </Detail>
        ) : null}
        {contact.office ? (
          <Detail icon={<Icon.location size={15} />} label={t.contacts.office}>
            {contact.office}
          </Detail>
        ) : null}
        {contact.officeHours ? (
          <Detail icon={<Icon.clock size={15} />} label={t.contacts.officeHours}>
            {contact.officeHours}
          </Detail>
        ) : null}
      </dl>

      {!contact.email && !contact.office && !contact.officeHours ? (
        <p className="text-sm text-[var(--text-secondary)]">{t.contacts.nothingRecorded}</p>
      ) : null}
    </div>
  );
}

function Detail({
  icon, label, children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
        <span aria-hidden="true" className="shrink-0">{icon}</span>
        {label}
      </dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}
