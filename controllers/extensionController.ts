import { json, route } from '@/models/http';
import { getDb } from '@/models/db';
import { getExtensionGarage } from '@/models/dashboard';

export const GET = route({ auth: true, name: 'extension.garage' }, async ({ userId }) => json(await getExtensionGarage(getDb(), userId), { headers: { 'Cache-Control': 'private, no-store' } }));
