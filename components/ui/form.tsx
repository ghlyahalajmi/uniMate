'use client';

import { forwardRef, useId } from 'react';
import { cx } from './primitives';

const CONTROL =
  'w-full rounded-[var(--radius-sm)] border bg-[var(--bg-surface)] text-[var(--text-primary)] ' +
  'px-3 py-2.5 text-sm min-h-[42px] transition-colors duration-150 ' +
  'placeholder:text-[var(--text-muted)] ' +
  'disabled:opacity-60 disabled:bg-[var(--bg-inset)]';

function controlClass(invalid?: boolean) {
  return cx(CONTROL, invalid ? 'border-[var(--danger)]' : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)]');
}

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  requiredLabel?: string;
  children: (props: { id: string; describedBy: string | undefined; invalid: boolean }) => React.ReactNode;
  className?: string;
}

/**
 * One wiring point for label, hint and error so every control in the app is
 * labelled and every error is announced.
 */
export function Field({
  label, hint, error, required, requiredLabel = 'required', children, className,
}: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cx('w-full', className)}>
      <label htmlFor={id} className="block text-[0.8125rem] font-medium mb-1.5 text-[var(--text-primary)]">
        {label}
        {required ? (
          <span className="text-[var(--danger)] ms-1" aria-label={requiredLabel}>*</span>
        ) : null}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-[var(--text-muted)] mt-1.5">{hint}</p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-[var(--danger)] mt-1.5 flex items-start gap-1">
          <span aria-hidden="true">⚠</span>
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

export interface TextInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  hint?: string;
  error?: string;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { label, hint, error, required, className, ...rest }, ref,
) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {({ id, describedBy, invalid }) => (
        <input
          {...rest}
          ref={ref}
          id={id}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cx(controlClass(invalid), className)}
        />
      )}
    </Field>
  );
});

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, hint, error, required, className, rows = 3, ...rest }, ref,
) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {({ id, describedBy, invalid }) => (
        <textarea
          {...rest}
          ref={ref}
          id={id}
          rows={rows}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cx(controlClass(invalid), 'resize-y', className)}
        />
      )}
    </Field>
  );
});

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, required, options, placeholder, className, ...rest }, ref,
) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {({ id, describedBy, invalid }) => (
        <select
          {...rest}
          ref={ref}
          id={id}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cx(controlClass(invalid), 'appearance-none pe-9 bg-no-repeat', className)}
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1.5 6 6.5l5-5' stroke='%236b7589' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
            backgroundPosition: 'right 0.75rem center',
          }}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
    </Field>
  );
});

export function Checkbox({
  label, description, checked, onChange, name, disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  name?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input
        type="checkbox"
        id={id}
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-[18px] h-[18px] rounded-[4px] shrink-0 accent-[var(--accent)] cursor-pointer"
      />
      <label htmlFor={id} className="text-sm cursor-pointer select-none">
        <span className="font-medium">{label}</span>
        {description ? (
          <span className="block text-xs text-[var(--text-secondary)] mt-0.5">{description}</span>
        ) : null}
      </label>
    </div>
  );
}

/** Segmented control. Arrow keys move between options, as a radio group should. */
export function SegmentedControl<T extends string>({
  label, value, options, onChange, className,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; hint?: string }>;
  onChange: (next: T) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx('inline-flex flex-wrap gap-1 p-1 rounded-[var(--radius-md)] bg-[var(--bg-inset)]', className)}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={cx(
              'px-3 py-1.5 rounded-[var(--radius-sm)] text-[0.8125rem] font-medium min-h-[34px]',
              'transition-colors duration-150',
              selected
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[var(--shadow-card)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
            )}
          >
            {o.label}
            {o.hint ? (
              <span className="block text-[0.6875rem] font-normal opacity-70">{o.hint}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({
  label, description, checked, onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="text-sm cursor-pointer">
        <span className="font-medium">{label}</span>
        {description ? (
          <span className="block text-xs text-[var(--text-secondary)] mt-0.5">{description}</span>
        ) : null}
      </label>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200',
          checked ? 'bg-[var(--accent)]' : 'bg-[var(--border-strong)]',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-[inset-inline-start] duration-200',
          )}
          style={{ insetInlineStart: checked ? '1.375rem' : '0.125rem' }}
        />
      </button>
    </div>
  );
}
