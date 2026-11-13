import type { Metadata } from 'next';
import { SellPlanner } from '@/components/tools/SellPlanner';

export const metadata: Metadata = { title: 'Sell or trade' };

export default async function SellPage({ params }: { params: Promise<{ vehicleId: string }> }) {
  const { vehicleId } = await params;
  return <SellPlanner vehicleId={vehicleId} />;
}
