import type { Metadata } from 'next';
import { ValueTracker } from '@/components/tools/ValueTracker';

export const metadata: Metadata = { title: 'Value tracker' };

export default async function ValuePage({ params }: { params: Promise<{ vehicleId: string }> }) {
  const { vehicleId } = await params;
  return <ValueTracker vehicleId={vehicleId} />;
}
