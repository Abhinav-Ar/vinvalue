import { json, route } from '@/lib/http';
import { getDb } from '@/lib/db';
import { removePhone } from '@/lib/alerts/phone';

/** DELETE /api/phone -> { phone: null }. Removes the number and consent; SMS stops. */
export const DELETE = route({ auth: true, name: 'phone.delete' }, async ({ userId }) => json(await removePhone(getDb(), userId)));
