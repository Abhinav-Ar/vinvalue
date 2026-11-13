/**
 * Email via the Resend REST API.
 * Docs: https://resend.com/docs/api-reference/emails/send-email
 *   POST https://api.resend.com/emails, Authorization: Bearer <key>, JSON { from, to, subject, html, text }
 *   Optional Idempotency-Key header (<= 256 chars, valid 24h) so retries do not double-send.
 *   Success: { id }.
 */
import { isRetryableStatus, SendError, type EmailMessage, type EmailSender } from './types';

type FetchLike = typeof fetch;

export class ResendEmailSender implements EmailSender {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async send(msg: EmailMessage): Promise<void> {
    let res: Response;
    try {
      res = await this.fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...(msg.idempotencyKey ? { 'Idempotency-Key': msg.idempotencyKey.slice(0, 256) } : {}),
        },
        body: JSON.stringify({ from: this.from, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw new SendError('resend_network', true);
    }
    if (!res.ok) throw new SendError(`resend_http_${res.status}`, isRetryableStatus(res.status));
  }
}
