import { json, route } from '@/models/http';
import { getDb } from '@/models/db';
import { getDashboard } from '@/models/dashboard';

export const GET = route({ auth: true, name: 'dashboard' }, async ({ userId }) => json(await getDashboard(getDb(), userId), { headers: { 'Cache-Control': 'private, no-store' } }));
