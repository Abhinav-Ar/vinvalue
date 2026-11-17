export type EmailMessage = { to: string; subject: string; text: string; html: string; idempotencyKey?: string };
export type SmsMessage = { to: string; body: string };
export type PushTarget = { endpoint: string; p256dh: string; auth: string };
export type PushPayload = { title: string; body: string; link: string | null };

export interface EmailSender {
  /** Throws SendError on failure. */
  send(msg: EmailMessage): Promise<void>;
}
export interface PushSender {
  /** 'gone' when the push service says the subscription no longer exists (404/410). Throws SendError otherwise. */
  send(target: PushTarget, payload: PushPayload): Promise<'sent' | 'gone'>;
}
export interface SmsSender {
  send(msg: SmsMessage): Promise<void>;
}
export type Senders = { email: EmailSender; push: PushSender; sms: SmsSender };

/**
 * Provider failure. `code` is a short machine string safe to store and log
 * (e.g. "resend_http_500", "twilio_21211"). Never put recipient data in it.
 */
export class SendError extends Error {
  constructor(
    public readonly code: string,
    /** false = permanent (bad request); do not retry. */
    public readonly retryable: boolean,
  ) {
    super(code);
    this.name = 'SendError';
  }
}

/** 4xx except 408/429 is permanent. */
export const isRetryableStatus = (status: number | null) => status === null || status >= 500 || status === 408 || status === 429;
