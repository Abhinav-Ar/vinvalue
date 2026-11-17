/**
 * Every API error is serialized as `{ error: { code, message, fields? } }`.
 * Throw an AppError (or a subclass) from anywhere below a route handler and
 * the `route()` wrapper in `@/models/http` turns it into that shape.
 */
export type ErrorCode =
  | 'invalid_input'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'too_few_comps'
  | 'vin_not_decoded'
  | 'upstream_failed'
  | 'not_configured'
  | 'internal';

export type FieldErrors = Record<string, string[]>;

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly fields?: FieldErrors,
    /** Extra machine-readable details merged into the error body (never secrets). */
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, fields?: FieldErrors) =>
  new AppError(400, 'invalid_input', message, fields);
export const unauthorized = () => new AppError(401, 'unauthorized', 'Sign in to do this.');
/** Use not_found (404) rather than forbidden for other users' records so ids do not leak. */
export const notFound = (what = 'Resource') => new AppError(404, 'not_found', `${what} not found.`);
export const conflict = (message: string) => new AppError(409, 'conflict', message);

/** An upstream provider (MarketCheck, NHTSA, ...) failed or returned something unusable. */
export class UpstreamError extends AppError {
  constructor(
    public readonly provider: string,
    public readonly upstreamStatus: number | null,
    message = `${provider} request failed.`,
  ) {
    super(502, 'upstream_failed', message, undefined, { provider, upstreamStatus });
    this.name = 'UpstreamError';
  }
}

export class TooFewCompsError extends AppError {
  constructor(
    public readonly compCount: number,
    public readonly minComps: number,
  ) {
    super(
      404,
      'too_few_comps',
      `Only ${compCount} comparable listing${compCount === 1 ? '' : 's'} found; at least ${minComps} are needed for a reliable value.`,
      undefined,
      { compCount, minComps },
    );
    this.name = 'TooFewCompsError';
  }
}
