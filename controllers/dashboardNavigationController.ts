import { redirect } from 'next/navigation';
import { currentUserId } from '@/models/session';
import { getDb } from '@/models/db';
import { requireVehicle } from '@/models/ownership';
async function navigate(searchParams: Promise<{ vehicleId?: string }>, flow: 'value' | 'sell') {
  const { vehicleId } = await searchParams;
  const userId = await currentUserId();
  if (!userId) redirect('/sign-in');
  if (!vehicleId) redirect('/garage');
  await requireVehicle(getDb(), userId, vehicleId);
  redirect(`/garage/${encodeURIComponent(vehicleId)}/${flow}`);
}
export async function ValueRedirect({ searchParams }: { searchParams: Promise<{ vehicleId?: string }> }) { return navigate(searchParams, 'value'); }
export async function SellRedirect({ searchParams }: { searchParams: Promise<{ vehicleId?: string }> }) { return navigate(searchParams, 'sell'); }
