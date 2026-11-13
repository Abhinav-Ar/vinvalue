/**
 * SMS via the Twilio Messages REST API.
 * Docs: https://www.twilio.com/docs/messaging/api/message-resource (Create a Message)
 *   POST https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json
 *   application/x-www-form-urlencoded: To (E.164), From, Body
 *   HTTP Basic auth. The docs' examples use API key:secret; AccountSid:AuthToken is the equivalent
 *   account-credential form and is what .env.example provides.
 * Errors: Twilio error bodies can echo the To number, so only the numeric `code` field is kept.
 */
import { isRetryableStatus, SendError, type SmsMessage, type SmsSender } from './types';

type FetchLike = typeof fetch;

export class TwilioSmsSender implements SmsSender {
  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly from: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async send(msg: SmsMessage): Promise<void> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(this.accountSid)}/Messages.json`;
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ To: msg.to, From: this.from, Body: msg.body }).toString(),
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw new SendError('twilio_network', true);
    }
    if (!res.ok) {
      let code: unknown = null;
      try {
        code = ((await res.json()) as { code?: unknown })?.code;
      } catch {
        /* ignore */
      }
      const suffix = typeof code === 'number' ? String(code) : `http_${res.status}`;
      throw new SendError(`twilio_${suffix}`, isRetryableStatus(res.status));
    }
  }
}
