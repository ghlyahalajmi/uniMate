import { getNotes } from '@/lib/data/queries';
import { NotesView } from '@/components/notes/notes-view';

export const metadata = { title: 'Notes' };
export const dynamic = 'force-dynamic';

export default async function NotesPage() {
  const notes = await getNotes();
  return <NotesView notes={notes} />;
}
