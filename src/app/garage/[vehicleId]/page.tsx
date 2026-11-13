import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { vehicles } from '@/lib/db/schema';
import { currentUserId } from '@/lib/session';
import { VehicleView } from '@/components/garage/VehicleView';

export const metadata: Metadata = { title: 'Vehicle' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Real 404 for unknown ids. Signed-out visitors fall through to the client, which shows the sign-in note. */
async function exists(id: string): Promise<boolean> {
  if (!UUID.test(id)) return false;
  try {
    const userId = await currentUserId();
    if (!userId) return true;
    const [v] = await getDb().select({ id: vehicles.id }).from(vehicles).where(and(eq(vehicles.id, id), eq(vehicles.userId, userId))).limit(1);
    return !!v;
  } catch {
    return true; // let the client report the API error
  }
}

export default async function VehiclePage({ params }: { params: Promise<{ vehicleId: string }> }) {
  const { vehicleId } = await params;
  if (!(await exists(vehicleId))) notFound();
  return <VehicleView id={vehicleId} />;
}
