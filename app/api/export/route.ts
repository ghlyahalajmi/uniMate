import { NextResponse } from 'next/server';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { toCsv, EXPORTABLE, isExportable, type ExportableTable } from '@/lib/data/csv';

/**
 * CSV export, scoped to the signed-in user.
 *
 * The user_id filter is belt and braces — row level security already makes it
 * impossible for this query to return another student's rows — but it keeps
 * the intent explicit at the point where data leaves the system.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorised' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const requested = searchParams.get('table');

  const supabase = await createClient();
  const stamp = new Date().toISOString().slice(0, 10);

  // One table → one CSV file.
  if (requested) {
    if (!isExportable(requested)) {
      return NextResponse.json({ ok: false, error: 'unknown_table' }, { status: 400 });
    }
    const columns = EXPORTABLE[requested];
    const { data, error } = await supabase
      .from(requested)
      .select(columns.join(','))
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ ok: false, error: 'export_failed' }, { status: 500 });
    }

    return csvResponse(
      toCsv((data ?? []) as unknown as Array<Record<string, unknown>>, [...columns]),
      `unimate-${requested}-${stamp}.csv`,
    );
  }

  // No table given → everything, as one file with a section per table.
  const chunks: string[] = [];
  for (const table of Object.keys(EXPORTABLE) as ExportableTable[]) {
    const columns = EXPORTABLE[table];
    const { data } = await supabase
      .from(table)
      .select(columns.join(','))
      .eq('user_id', user.id);

    chunks.push(`# ${table}`);
    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
    chunks.push(rows.length ? toCsv(rows, [...columns]).replace(/^﻿/, '') : columns.join(',') + '\r\n');
    chunks.push('');
  }

  return csvResponse(`﻿${chunks.join('\r\n')}`, `unimate-export-${stamp}.csv`);
}

function csvResponse(body: string, filename: string): NextResponse {
  return new NextResponse(body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
}
