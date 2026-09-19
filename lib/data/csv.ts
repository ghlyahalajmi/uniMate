import 'server-only';

/**
 * RFC 4180 CSV. Quotes every field that contains a delimiter, quote or
 * newline, and doubles embedded quotes.
 */
function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = Array.isArray(value)
    ? value.join('; ')
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value);

  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: Array<Record<string, unknown>>, columns?: string[]): string {
  if (rows.length === 0) return '';
  const head = columns ?? Object.keys(rows[0]);
  const lines = [head.map(escapeCell).join(',')];
  for (const row of rows) {
    lines.push(head.map((c) => escapeCell(row[c])).join(','));
  }
  // CRLF and a UTF-8 BOM so Excel opens Arabic text correctly.
  return `﻿${lines.join('\r\n')}\r\n`;
}

export const EXPORTABLE = {
  courses: [
    'course_code','course_name','instructor','credits','semester','difficulty',
    'days','start_time','end_time','room','status','final_grade','final_points',
    'target_grade','source','created_at',
  ],
  grades: [
    'assessment_name','assessment_type','weight','score','max_score','due_date',
    'source','created_at',
  ],
  tasks: [
    'title','description','priority','due_date','estimated_minutes','status',
    'source','completed_at','created_at',
  ],
  study_sessions: [
    'topic','mode','duration_minutes','score','total_questions','correct_answers',
    'started_at','completed_at',
  ],
  syllabi: ['file_name','file_type','processing_status','instructor','office_hours','topics','uploaded_at'],
  syllabus_events: ['title','event_type','event_date','weight','description'],
  reminders: ['title','body','remind_on','status','source','created_at'],
  questions: ['topic','difficulty','question_type','question_text','answer','created_at'],
  ai_runs: ['agent_name','trigger_type','workflow','status','input_summary','output_summary','error_message','duration_ms','started_at','completed_at'],
  cleaning_log: ['table_name','field_name','original_value','cleaned_value','reason','created_at'],
} as const;

export type ExportableTable = keyof typeof EXPORTABLE;

export function isExportable(name: string): name is ExportableTable {
  return name in EXPORTABLE;
}
