import type { Metadata } from 'next';
import { HistoryPage } from '@/views/components/account/HistoryPage';

export const metadata: Metadata = { title: 'Appraisal history' };

export default function Page() {
  return <HistoryPage />;
}
