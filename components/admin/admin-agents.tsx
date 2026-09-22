/**
 * The agent roster, where it belongs.
 *
 * What fires each agent, which workflow it sits in, and what it can still do
 * with no model at all. This is operations detail: it answers "is the AI side
 * healthy and what happens when it is not", which is an administrator's
 * question. It used to sit on the student settings page, where it answered
 * nothing anyone was asking and buried the one control they needed.
 *
 * No student data reaches this — it is a constant list compiled into the app.
 */
export function AdminAgents({
  agents,
}: {
  agents: ReadonlyArray<{
    name: string; trigger: string; workflow: string;
    offline: string | null; why?: string | null;
  }>;
}) {
  const withFallback = agents.filter((a) => a.offline).length;

  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="font-display text-lg font-semibold">AI agents</h2>
        <p className="text-xs text-[var(--text-muted)]">
          {withFallback} of {agents.length} keep working with no model
        </p>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
        <ul className="divide-y divide-[var(--border-subtle)]">
          {agents.map((a) => (
            <li key={a.name} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {a.trigger} · {a.workflow}
                  </p>
                </div>
                <span
                  className={
                    a.offline
                      ? 'shrink-0 text-xs px-2 py-1 rounded-full bg-[var(--positive-soft)] text-[var(--positive)]'
                      : 'shrink-0 text-xs px-2 py-1 rounded-full bg-[var(--bg-inset)] text-[var(--text-muted)]'
                  }
                >
                  {a.offline ? 'Works offline' : 'Needs a model'}
                </span>
              </div>
              {/* What it does without a model, or — when it cannot — why not.
                  "No" on its own reads as an omission rather than a limit. */}
              {(a.offline ?? a.why) ? (
                <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                  {a.offline ?? a.why}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
