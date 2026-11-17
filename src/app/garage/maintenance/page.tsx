import type { Metadata } from 'next';
import { MaintenanceView } from '@/components/garage/MaintenanceView';

export const metadata: Metadata = { title: 'Maintenance' };

export default function MaintenancePage() {
  return <MaintenanceView />;
}
