'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { cx } from './primitives';

type ToastTone = 'success' | 'error' | 'info';
interface Toast { id: number; message: string; tone: ToastTone }

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: ToastTone) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-2), { id, message, tone }]);
    // Errors linger — they usually need reading twice.
    const ttl = tone === 'error' ? 7000 : 4000;
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), ttl);
  }, []);

  const api = useMemo<ToastApi>(() => ({
    success: (m) => push(m, 'success'),
    error: (m) => push(m, 'error'),
    info: (m) => push(m, 'info'),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        // Errors are assertive; the rest wait their turn.
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-20 sm:bottom-6 inset-x-0 sm:inset-x-auto sm:end-6 z-[60] flex flex-col items-center sm:items-end gap-2 px-4 sm:px-0 pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={cx(
              'animate-fade-up pointer-events-auto w-full sm:w-auto sm:max-w-sm',
              'flex items-start gap-2.5 px-4 py-3 rounded-[var(--radius-md)]',
              'border shadow-[var(--shadow-float)] text-sm',
              t.tone === 'success' && 'bg-[var(--positive-soft)] border-[var(--positive-border)] text-[var(--positive)]',
              t.tone === 'error' && 'bg-[var(--danger-soft)] border-[var(--danger-border)] text-[var(--danger)]',
              t.tone === 'info' && 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-primary)]',
            )}
          >
            <span aria-hidden="true" className="font-semibold leading-5">
              {t.tone === 'success' ? '✓' : t.tone === 'error' ? '⚠' : 'ⓘ'}
            </span>
            <span className="leading-5">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

// --- Modal -------------------------------------------------------------------

export function Modal({
  open, onClose, title, description, children, footer, size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-[var(--color-ink-950)]/45 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'relative w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)]',
          'rounded-t-[var(--radius-xl)] sm:rounded-[var(--radius-xl)] shadow-[var(--shadow-float)]',
          'max-h-[92vh] overflow-y-auto animate-fade-up',
          size === 'sm' ? 'sm:max-w-sm' : size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg',
        )}
      >
        <div className="p-5 sm:p-6">
          <h2 className="font-display text-xl font-semibold pe-8">{title}</h2>
          {description ? (
            <p className="text-sm text-[var(--text-secondary)] mt-1.5">{description}</p>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 end-4 w-9 h-9 grid place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          {children ? <div className="mt-5">{children}</div> : null}
          {footer ? <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
