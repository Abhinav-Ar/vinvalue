/**
 * Structured JSON logger with redaction. Rule: no VINs, ZIPs, emails, phone
 * numbers or API keys ever reach the logs.
 *  - Keys named like vin/zip/email/phone/token/key/secret/password are replaced.
 *  - String values are scrubbed for VIN-shaped tokens, emails, and `api_key=` query params.
 */
type Level = 'debug' | 'info' | 'warn' | 'error';

const SENSITIVE_KEY = /^(vin|zip|zipcode|postal|email|phone|phonenumber|to|api_?key|apikey|token|secret|password|authorization|cookie|code)$/i;
const VIN_RE = /\b[A-HJ-NPR-Z0-9]{17}\b/g;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const KEY_PARAM_RE = /([?&](?:api_key|apikey|key|token)=)[^&\s"]+/gi;

export function scrubString(s: string): string {
  return s.replace(KEY_PARAM_RE, '$1[redacted]').replace(VIN_RE, '[vin]').replace(EMAIL_RE, '[email]');
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[depth]';
  if (typeof value === 'string') return scrubString(value);
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  if (value instanceof Error) return { name: value.name, message: scrubString(value.message) };
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEY.test(k) ? '[redacted]' : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

function emit(level: Level, event: string, fields?: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'test' && !process.env.LOG_IN_TESTS) return;
  const line = JSON.stringify({ level, event, t: new Date().toISOString(), ...(redact(fields ?? {}) as object) });
  // eslint-disable-next-line no-console
  (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(line);
}

export const log = {
  debug: (event: string, fields?: Record<string, unknown>) => emit('debug', event, fields),
  info: (event: string, fields?: Record<string, unknown>) => emit('info', event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => emit('warn', event, fields),
  error: (event: string, fields?: Record<string, unknown>) => emit('error', event, fields),
};
