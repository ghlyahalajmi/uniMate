import { isAiConfigured } from '@/lib/ai/client';
import { ScannerView } from '@/components/courses/scanner-view';

export const metadata = { title: 'Timetable scanner' };
export const dynamic = 'force-dynamic';

export default function ScanPage() {
  return <ScannerView aiEnabled={isAiConfigured()} />;
}
