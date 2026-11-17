/**
 * Web Push via the `web-push` package (see node_modules/web-push/README.md):
 *   sendNotification(subscription, payload, { vapidDetails: { subject, publicKey, privateKey }, TTL })
 *   rejects with WebPushError { statusCode, body }. 404/410 mean the subscription is gone.
 */
import webpush from 'web-push';
import { isRetryableStatus, SendError, type PushPayload, type PushSender, type PushTarget } from './types';

export class VapidPushSender implements PushSender {
  constructor(
    private readonly subject: string,
    private readonly publicKey: string,
    private readonly privateKey: string,
  ) {}

  async send(target: PushTarget, payload: PushPayload): Promise<'sent' | 'gone'> {
    try {
      await webpush.sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        JSON.stringify(payload),
        { vapidDetails: { subject: this.subject, publicKey: this.publicKey, privateKey: this.privateKey }, TTL: 24 * 3600 },
      );
      return 'sent';
    } catch (err) {
      const sc = (err as { statusCode?: unknown })?.statusCode;
      const status = typeof sc === 'number' ? sc : null;
      if (status === 404 || status === 410) return 'gone';
      throw new SendError(status ? `push_http_${status}` : 'push_network', isRetryableStatus(status));
    }
  }
}
