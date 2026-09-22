import { ScannerView } from '@/components/courses/scanner-view';

export const metadata = { title: 'Timetable scanner' };
export const dynamic = 'force-dynamic';

export default async function ScanPage() {
  return <ScannerView />;
}
