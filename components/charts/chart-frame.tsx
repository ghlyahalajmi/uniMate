'use client';

import { useId, useState } from 'react';
import { Card, cx } from '@/components/ui/primitives';
import { useI18n } from '@/lib/i18n/provider';

/**
 * Shared frame for every chart: title, axis labels, a toggleable data table,
 * and an empty state. The table is not optional decoration — several series
 * colours sit below 3:1 on the light surface, so the table is the required
 * relief, and it doubles as the screen-reader path to the same numbers.
 */
export function ChartFrame({
  title, yLabel, xLabel, empty, emptyBody, children, table, footnote,
}: {
  title: string;
  yLabel: string;
  xLabel: string;
  empty: boolean;
  emptyBody: string;
  children: React.ReactNode;
  table: { head: string[]; rows: Array<Array<string | number>> };
  footnote?: string;
}) {
  const { t } = useI18n();
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();

  return (
    <Card as="section">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {!empty ? (
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            aria-expanded={showTable}
            aria-controls={tableId}
            className="inline-flex items-center min-h-[32px] text-xs text-[var(--accent-soft-text)] hover:underline shrink-0"
          >
            {showTable ? t.common.showLess : t.a11y.dataTable}
          </button>
        ) : null}
      </div>
      <p className="text-xs text-[var(--text-muted)] mb-4">
        {yLabel} · {xLabel}
      </p>

      {empty ? (
        <p className="text-sm text-[var(--text-secondary)] py-6 text-center">{emptyBody}</p>
      ) : (
        <>
          <div className="w-full overflow-hidden">{children}</div>
          {footnote ? (
            <p className="text-xs text-[var(--text-muted)] mt-3">{footnote}</p>
          ) : null}

          <div id={tableId} className={cx('mt-4 overflow-x-auto', !showTable && 'sr-only')}>
            <table className="w-full text-sm">
              <caption className="sr-only">{`${title}. ${t.a11y.chartDescription}`}</caption>
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  {table.head.map((h, i) => (
                    <th
                      key={h}
                      scope="col"
                      className={cx(
                        'py-2 pe-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]',
                        i === 0 ? 'text-start' : 'text-end',
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, ri) => (
                  <tr key={ri} className="border-b border-[var(--border-subtle)] last:border-0">
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className={cx('py-2 pe-3', ci === 0 ? 'text-start' : 'text-end tabular-nums')}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
