import type { Metadata } from 'next';
import { AlertsPage } from '@/views/components/account/AlertsPage';

export const metadata: Metadata = { title: 'Alerts' };

export default function Page() {
  return <AlertsPage />;
}
