import { getCourses } from '@/lib/data/queries';
import { getDeck } from '@/lib/flashcards/queries';
import { FlashcardsView } from '@/components/flashcards/flashcards-view';

export const metadata = { title: 'Flashcards' };
export const dynamic = 'force-dynamic';

export default async function FlashcardsPage() {
  // The server's day, not the browser's. The client re-checks against its own
  // local day once mounted, so a student studying past midnight in Kuwait is
  // not shown yesterday's queue.
  const today = new Date().toISOString().slice(0, 10);
  const [deck, courses] = await Promise.all([getDeck(today), getCourses()]);
  const codes = Object.fromEntries(courses.map((c) => [c.id, c.course_code]));

  return (
    <FlashcardsView
      serverToday={today}
      courseOptions={courses
        .filter((c) => c.status === 'active')
        .map((c) => ({ value: c.id, label: `${c.course_code} — ${c.course_name}` }))}
      cards={deck.cards.map((c) => ({
        id: c.id,
        front: c.front,
        back: c.back,
        topic: c.topic,
        courseId: c.course_id,
        courseCode: c.course_id ? codes[c.course_id] ?? null : null,
        box: c.box,
        dueOn: c.due_on,
        reviews: c.reviews,
      }))}
    />
  );
}
