import type { Metadata } from 'next';
import { MaintenanceView } from '@/views/components/garage/MaintenanceView';

export const metadata: Metadata = { title: 'Maintenance' };

export default function MaintenancePage() {
  return <MaintenanceView />;
}
