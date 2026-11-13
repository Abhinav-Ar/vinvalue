import type { Metadata } from 'next';
import { AlertsPage } from '@/components/account/AlertsPage';

export const metadata: Metadata = { title: 'Alerts' };

export default function Page() {
  return <AlertsPage />;
}
