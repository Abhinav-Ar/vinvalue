/**
 * Channel senders. Real implementations when keys are configured; otherwise
 * log-only fakes (dev). Fakes never log recipients or message bodies (an SMS
 * body can hold a verification code).
 */
import { log } from '@/lib/log';
import { ResendEmailSender } from './resend';
import { TwilioSmsSender } from './twilio';
import { VapidPushSender } from './webpush';
import type { EmailSender, PushSender, Senders, SmsSender } from './types';

export * from './types';

const fakeEmail: EmailSender = {
  async send(m) {
    log.info('notify.email.fake', { subjectChars: m.subject.length });
  },
};
const fakePush: PushSender = {
  async send(_t, p) {
    log.info('notify.push.fake', { titleChars: p.title.length });
    return 'sent';
  },
};
const fakeSms: SmsSender = {
  async send(m) {
    // Local development only: show the text (e.g. the verification code) so the phone flow can be
    // finished without Twilio. Never the recipient, and never outside `next dev`.
    const dev = process.env.NODE_ENV === 'development' ? { devBody: m.body } : {};
    log.info('notify.sms.fake', { bodyChars: m.body.length, ...dev });
  },
};

let override: Partial<Senders> | null = null;

/** Tests inject recording senders here. */
export function setSenders(s: Partial<Senders> | null) {
  override = s;
}

export function getSenders(): Senders {
  const e = process.env;
  const email = e.RESEND_API_KEY && e.EMAIL_FROM ? new ResendEmailSender(e.RESEND_API_KEY, e.EMAIL_FROM) : fakeEmail;
  const push =
    e.VAPID_PUBLIC_KEY && e.VAPID_PRIVATE_KEY && e.VAPID_SUBJECT
      ? new VapidPushSender(e.VAPID_SUBJECT, e.VAPID_PUBLIC_KEY, e.VAPID_PRIVATE_KEY)
      : fakePush;
  const sms =
    e.TWILIO_ACCOUNT_SID && e.TWILIO_AUTH_TOKEN && e.TWILIO_FROM_NUMBER
      ? new TwilioSmsSender(e.TWILIO_ACCOUNT_SID, e.TWILIO_AUTH_TOKEN, e.TWILIO_FROM_NUMBER)
      : fakeSms;
  return { email: override?.email ?? email, push: override?.push ?? push, sms: override?.sms ?? sms };
}
