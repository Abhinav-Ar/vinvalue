import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { vehiclePageExists } from '@/lib/vehicle-page';
import { ValueTracker } from '@/components/tools/ValueTracker';

export const metadata: Metadata = { title: 'Value tracker' };

export default async function ValuePage({ params }: { params: Promise<{ vehicleId: string }> }) {
  const { vehicleId } = await params;
  if (!(await vehiclePageExists(vehicleId))) notFound();
  return <ValueTracker vehicleId={vehicleId} />;
}
