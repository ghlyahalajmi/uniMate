'use client';

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { Button, Card, cx } from '@/components/ui/primitives';
import { AiUnavailable, EmptyState } from '@/components/ui/states';
import { Icon } from '@/components/shell/icons';
import { PageHeader } from '@/components/shell/page-header';

interface Message { role: 'user' | 'assistant'; content: string }

export function AssistantView({
  aiEnabled, sampleCourseCode,
}: {
  aiEnabled: boolean;
  sampleCourseCode: string;
}) {
  const { t } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, thinking]);

  const suggestions = [
    t.assistant.suggestion1,
    t.assistant.suggestion2.replace('CE301', sampleCourseCode),
    t.assistant.suggestion3,
    t.assistant.suggestion4,
  ];

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;

    // No provider: answer in the thread rather than silently doing nothing, so
    // the refusal lands where the student pressed and the layout still shows
    // how a real exchange will look.
    if (!aiEnabled) {
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: trimmed },
        { role: 'assistant', content: t.ai.unavailableBody },
      ]);
      setInput('');
      return;
    }

    const history = messages.slice(-10);
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
    setInput('');
    setThinking(true);

    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.ok ? data.answer : t.assistant.error },
      ]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: t.errors.network }]);
    } finally {
      setThinking(false);
    }
  }

  /**
   * Without a provider the screen used to stop at a banner, so the chat itself
   * — the bubbles, the suggestions, the composer — could not be seen at all.
   * The notice now sits above a working interface instead of replacing it: the
   * layout can be judged, and `send` is what declines, where the student
   * pressed, rather than the page refusing to draw.
   */

  return (
    <div className="flex flex-col h-[calc(100dvh-10rem)] lg:h-[calc(100dvh-7rem)]">
      <PageHeader
        title={t.assistant.title}
        subtitle={t.assistant.subtitle}
        action={
          messages.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setMessages([])}>
              {t.assistant.clear}
            </Button>
          ) : undefined
        }
      />

      {!aiEnabled ? (
        <div className="mb-3">
          <AiUnavailable
          title={t.ai.unavailableTitle}
          body={t.ai.unavailableBody}
          action={{ href: "/settings", label: t.ai.ownKeyCta }}
        />
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto -mx-1 px-1">
        {messages.length === 0 ? (
          <Card>
            <EmptyState
              compact
              title={t.assistant.title}
              body={t.assistant.empty}
              icon={<Icon.assistant size={24} />}
            />
            <ul className="grid sm:grid-cols-2 gap-2 mt-2">
              {suggestions.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => void send(s)}
                    className="w-full text-start text-sm px-3.5 py-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] hover:border-[var(--accent)] hover:bg-[var(--bg-accent-soft)] transition-colors"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <ul className="space-y-3 pb-2">
            {messages.map((m, i) => (
              <li
                key={i}
                className={cx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cx(
                    'max-w-[85%] sm:max-w-[75%] px-4 py-3 rounded-[var(--radius-lg)] text-sm leading-relaxed whitespace-pre-wrap',
                    m.role === 'user'
                      ? 'bg-[var(--accent)] text-[var(--text-on-accent)] rounded-ee-[var(--radius-xs)]'
                      : 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-es-[var(--radius-xs)]',
                  )}
                >
                  {m.content}
                </div>
              </li>
            ))}
            {thinking ? (
              <li className="flex justify-start">
                <div className="px-4 py-3 rounded-[var(--radius-lg)] bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                  <span className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                    <span className="flex gap-1" aria-hidden="true">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse-soft"
                          style={{ animationDelay: `${i * 0.18}s` }}
                        />
                      ))}
                    </span>
                    {t.assistant.thinking}
                  </span>
                </div>
              </li>
            ) : null}
            <div ref={endRef} />
          </ul>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); void send(input); }}
        className="pt-3 mt-auto"
      >
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label htmlFor="assistant-input" className="sr-only">{t.assistant.placeholder}</label>
            <textarea
              id="assistant-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input); }
              }}
              rows={1}
              placeholder={t.assistant.placeholder}
              className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-sm min-h-[46px] max-h-32 placeholder:text-[var(--text-muted)]"
            />
          </div>
          <Button type="submit" disabled={!input.trim() || thinking} aria-label={t.assistant.send}>
            <Icon.chevronEnd size={18} className="flip-rtl" />
          </Button>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-2">{t.ai.noInvention}</p>
      </form>
    </div>
  );
}
