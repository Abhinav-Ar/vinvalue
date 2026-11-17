import type { Metadata } from 'next';
import { HistoryPage } from '@/components/account/HistoryPage';

export const metadata: Metadata = { title: 'Appraisal history' };

export default function Page() {
  return <HistoryPage />;
}
