'use client';

/**
 * The admin side's own small set of controls.
 *
 * Deliberately not the student design system: this is a different product for
 * a different person, and sharing the components would mean every change to
 * the student UI has to be re-checked here. It borrows the colour tokens and
 * nothing else.
 */

export function AdminShell({
  title, subtitle, children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-dvh grid place-items-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            UniMate
          </p>
          <h1 className="font-display text-2xl font-semibold mt-1">{title}</h1>
          {subtitle ? (
            <p className="text-sm text-[var(--text-secondary)] mt-2 leading-relaxed">{subtitle}</p>
          ) : null}
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-soft)]">
          {children}
        </div>
      </div>
    </main>
  );
}

export function AdminField({
  label, name, type = 'text', required, autoComplete, hint,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[0.8125rem] font-medium mb-1.5">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        className="w-full h-10 px-3 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-inset)] text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/25"
      />
      {hint ? <span className="block text-xs text-[var(--text-muted)] mt-1">{hint}</span> : null}
    </label>
  );
}

export function AdminSubmit({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full h-10 rounded-[var(--radius-sm)] bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-60"
    >
      {pending ? 'Working…' : children}
    </button>
  );
}

export function AdminError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-[0.8125rem] text-[var(--danger)]">
      {children}
    </p>
  );
}
