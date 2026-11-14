import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { vehiclePageExists } from '@/lib/vehicle-page';
import { VehicleView } from '@/components/garage/VehicleView';

export const metadata: Metadata = { title: 'Vehicle' };

export default async function VehiclePage({ params }: { params: Promise<{ vehicleId: string }> }) {
  const { vehicleId } = await params;
  if (!(await vehiclePageExists(vehicleId))) notFound();
  return <VehicleView id={vehicleId} />;
}
