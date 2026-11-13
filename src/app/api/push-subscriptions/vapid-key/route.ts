import { json, route } from '@/lib/http';
import { AppError } from '@/lib/errors';

/** GET /api/push-subscriptions/vapid-key (public) -> { publicKey }. 503 when push is not configured. */
export const GET = route({ auth: false, name: 'push.vapidKey' }, async () => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) throw new AppError(503, 'not_configured', 'Push notifications are not configured on this server.');
  return json({ publicKey });
});
