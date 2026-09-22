import 'server-only';
import type { AssistantInput, AssistantOutput } from '../agents/assistant';
import type { StudentContext } from '../context';
import type { Weekday } from '@/types/database';

/**
 * Mate, answering from the records alone.
 *
 * Without a model there is no conversation, but most of what students actually
 * ask is a lookup: what is due, what is my GPA, what have I got today, when is
 * the next exam. Those answers are arithmetic over rows that are already here,
 * and refusing to give them because a model is unavailable would be a refusal
 * to read the student their own diary.
 *
 * Anything that needs judgement gets the honest line instead of an imitation
 * of one.
 */

const ARABIC = /[؀-ۿ]/;

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Intent = 'due' | 'gpa' | 'today' | 'exam' | 'course' | 'unknown';

/** What the question is asking for, in either language. */
function intentOf(message: string): Intent {
  const m = message.toLowerCase();
  const has = (...words: string[]) => words.some((w) => m.includes(w));

  if (has('due', 'deadline', 'overdue', 'task', 'todo', 'مهام', 'مهمة', 'تسليم', 'موعد', 'متأخر')) return 'due';
  if (has('gpa', 'average', 'grade', 'mark', 'معدل', 'درجة', 'درجاتي', 'علامات')) return 'gpa';
  if (has('today', 'now', 'class', 'lecture', 'schedule', 'timetable', 'اليوم', 'محاضرة', 'جدول', 'حصة')) return 'today';
  if (has('exam', 'midterm', 'final', 'quiz', 'test', 'اختبار', 'امتحان', 'كويز', 'نهائي')) return 'exam';
  if (has('course', 'subject', 'مقرر', 'مادة', 'مواد')) return 'course';
  return 'unknown';
}

function dueLines(context: StudentContext, ar: boolean): string[] {
  const today = todayIso();
  const open = context.tasks
    .filter((t) => t.status !== 'completed')
    .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))
    .slice(0, 6);

  if (open.length === 0) return [ar ? 'لا توجد مهام مفتوحة في سجلك.' : 'Nothing is open in your task list.'];

  return open.map((t) => {
    const late = t.due_date !== null && t.due_date < today;
    const when = t.due_date ?? (ar ? 'بدون تاريخ' : 'no date');
    return ar
      ? `• ${t.title} — ${when}${late ? ' (متأخرة)' : ''}`
      : `• ${t.title} — ${when}${late ? ' (overdue)' : ''}`;
  });
}

function examLines(context: StudentContext, ar: boolean): string[] {
  const today = todayIso();
  const ahead = [
    ...context.events
      .filter((e) => e.event_date && e.event_date >= today)
      .map((e) => ({ title: e.title, date: e.event_date as string, courseId: e.course_id })),
    ...context.grades
      .filter((g) => g.score === null && g.due_date && g.due_date >= today)
      .map((g) => ({ title: g.assessment_name, date: g.due_date as string, courseId: g.course_id })),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  if (ahead.length === 0) return [ar ? 'لا توجد تقييمات قادمة مسجّلة.' : 'No upcoming assessments are recorded.'];

  return ahead.map((x) => {
    const code = context.courses.find((c) => c.id === x.courseId)?.course_code ?? '';
    return `• ${code ? `${code} — ` : ''}${x.title} — ${x.date}`;
  });
}

function todayLines(context: StudentContext, ar: boolean): string[] {
  const WEEK: Weekday[] = [
    'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
  ];
  const key = WEEK[new Date().getDay()];
  const classes = context.courses
    .filter((c) => c.status === 'active' && Array.isArray(c.days) && c.days.includes(key))
    .sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''));

  if (classes.length === 0) return [ar ? 'لا توجد محاضرات اليوم في جدولك.' : 'No classes on your timetable today.'];

  return classes.map((c) =>
    `• ${c.course_code} — ${c.start_time ?? '—'}${c.end_time ? `–${c.end_time}` : ''}${c.room ? ` · ${c.room}` : ''}`,
  );
}

/**
 * The deterministic answer, or null when the question genuinely needs a model.
 *
 * Null matters: an imitation of an answer would be indistinguishable from a
 * real one to the student, and this whole product is built on that difference.
 */
export function answerFromRecords(
  input: AssistantInput, computed: string,
): AssistantOutput | null {
  const ar = ARABIC.test(input.message);
  const intent = intentOf(input.message);
  if (intent === 'unknown') return null;

  const note = ar
    ? '\n\n(هذه إجابة من سجلاتك مباشرة، بدون ذكاء اصطناعي. أضف مفتاحاً في الإعدادات لإجابات مفصّلة.)'
    : '\n\n(Answered straight from your records, without AI. Add a key in Settings for a fuller answer.)';

  switch (intent) {
    case 'due':
      return {
        answer: [ar ? 'المهام المفتوحة، الأقرب أولاً:' : 'What is open, nearest first:', ...dueLines(input.context, ar)].join('\n') + note,
      };
    case 'exam':
      return {
        answer: [ar ? 'التقييمات القادمة المسجّلة:' : 'Upcoming assessments on file:', ...examLines(input.context, ar)].join('\n') + note,
      };
    case 'today':
      return {
        answer: [ar ? 'محاضرات اليوم:' : 'Today:', ...todayLines(input.context, ar)].join('\n') + note,
      };
    case 'gpa':
      return {
        answer: [ar ? 'الأرقام كما هي محسوبة من سجلك:' : 'The figures, computed from your records:', computed].join('\n') + note,
      };
    case 'course': {
      const active = input.context.courses.filter((c) => c.status === 'active');
      if (active.length === 0) return null;
      return {
        answer: [
          ar ? 'مقرراتك النشطة:' : 'Your active courses:',
          ...active.map((c) => `• ${c.course_code} — ${c.course_name}${c.credits ? ` (${c.credits})` : ''}`),
        ].join('\n') + note,
      };
    }
    default:
      return null;
  }
}
