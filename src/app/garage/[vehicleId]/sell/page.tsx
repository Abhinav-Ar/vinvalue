import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { vehiclePageExists } from '@/lib/vehicle-page';
import { SellPlanner } from '@/components/tools/SellPlanner';

export const metadata: Metadata = { title: 'Sell or trade' };

export default async function SellPage({ params }: { params: Promise<{ vehicleId: string }> }) {
  const { vehicleId } = await params;
  if (!(await vehiclePageExists(vehicleId))) notFound();
  return <SellPlanner vehicleId={vehicleId} />;
}
