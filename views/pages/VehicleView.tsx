import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { vehiclePageExists } from '@/models/vehicle-page';
import { VehicleView } from '@/views/components/garage/VehicleView';

export const metadata: Metadata = { title: 'Vehicle' };

export default async function VehiclePage({ params }: { params: Promise<{ vehicleId: string }> }) {
  const { vehicleId } = await params;
  if (!(await vehiclePageExists(vehicleId))) notFound();
  return <VehicleView id={vehicleId} />;
}
