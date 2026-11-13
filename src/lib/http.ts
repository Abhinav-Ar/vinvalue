import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AppError, badRequest, unauthorized, type FieldErrors } from './errors';
import { log } from './log';
import { currentUserId } from './session';
import { checkRateLimit, type RateLimitRule } from './ratelimit';

// Missing fields read "Required." instead of zod's "expected string, received undefined".
// Schema-level messages still win over this.
z.config({
  customError: (iss) => (iss.code === 'invalid_type' && iss.input === undefined ? 'Required.' : undefined),
});

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function errorResponse(err: AppError) {
  const body: { error: Record<string, unknown> } = {
    error: { code: err.code, message: err.message, ...(err.fields ? { fields: err.fields } : {}), ...(err.details ?? {}) },
  };
  const retry = err.status === 429 ? Number(err.details?.retryAfterSec) : NaN;
  return NextResponse.json(body, { status: err.status, ...(retry > 0 ? { headers: { 'retry-after': String(retry) } } : {}) });
}

export function zodFields(error: z.ZodError): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join('.') : '_';
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}

export function parse<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const r = schema.safeParse(input);
  if (!r.success) throw badRequest('Some fields are invalid.', zodFields(r.error));
  return r.data;
}

export async function parseJson<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw badRequest('Request body must be valid JSON.');
  }
  return parse(schema, body);
}

export function parseQuery<S extends z.ZodType>(req: Request, schema: S): z.infer<S> {
  const url = new URL(req.url);
  const obj: Record<string, string | string[]> = {};
  for (const [k, v] of url.searchParams) {
    const prev = obj[k];
    obj[k] = prev === undefined ? v : Array.isArray(prev) ? [...prev, v] : [prev, v];
  }
  return parse(schema, obj);
}

type Params = Record<string, string>;
type Ctx<P extends Params, A extends boolean> = {
  req: Request;
  params: P;
  userId: A extends true ? string : string | null;
};

type Options<A extends boolean> = {
  /** true: 401 unless signed in. false: userId may be null. */
  auth: A;
  /** Public endpoints that call paid upstreams must set this. */
  rateLimit?: RateLimitRule;
  /** Name used in logs. */
  name: string;
};

/**
 * Wrap a route handler: resolves params, auth, rate limit, and maps thrown
 * errors to the standard JSON shape. Unknown errors become 500 `internal`
 * with no detail leaked to the client.
 */
/**
 * Callable as Next.js calls it (req, { params }) and, in tests, as (req). The full signature is
 * last so Next's build-time check (which reads the last overload) sees a required context.
 */
export type RouteHandler<P> = ((req: Request) => Promise<Response>) &
  ((req: Request, context: { params: Promise<P> }) => Promise<Response>);

export function route<P extends Params = Params, A extends boolean = boolean>(
  opts: Options<A>,
  handler: (ctx: Ctx<P, A>) => Promise<Response>,
): RouteHandler<P> {
  // Next.js checks this signature at build time: the second argument must be a required
  // `{ params: Promise<...> }`. Tests may omit it, hence the defensive read below.
  return (async (req: Request, context?: { params: Promise<P> }) => {
    const started = Date.now();
    try {
      const params = ((await context?.params) ?? {}) as P;
      const userId = await currentUserId();
      if (opts.auth && !userId) throw unauthorized();
      if (opts.rateLimit) await checkRateLimit(req, opts.rateLimit, userId);
      const res = await handler({ req, params, userId: userId as Ctx<P, A>['userId'] });
      log.info('api.ok', { route: opts.name, status: res.status, ms: Date.now() - started });
      return res;
    } catch (err) {
      if (err instanceof AppError) {
        const lvl = err.status >= 500 ? 'error' : 'info';
        log[lvl]('api.error', { route: opts.name, status: err.status, errCode: err.code, ms: Date.now() - started });
        return errorResponse(err);
      }
      log.error('api.crash', { route: opts.name, err, ms: Date.now() - started });
      return errorResponse(new AppError(500, 'internal', 'Something went wrong on our side.'));
    }
  }) as RouteHandler<P>;
}
