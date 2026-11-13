'use client';
/**
 * Browser-side API client. The backend answers errors as { error: { code, message, fields?, ...details } }.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type FieldErrors = Record<string, string[]>;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields: FieldErrors = {},
    public details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? (init.body !== undefined ? 'POST' : 'GET'),
      headers: init.body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      credentials: 'same-origin',
      signal: init.signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError(0, 'network', 'You appear to be offline. Check your connection and try again.');
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    const e = (data as { error?: Record<string, unknown> } | null)?.error ?? {};
    const { code, message, fields, ...details } = e as { code?: string; message?: string; fields?: FieldErrors };
    throw new ApiError(res.status, code ?? 'internal', message ?? 'Something went wrong on our side. Try again.', fields ?? {}, details);
  }
  return data as T;
}

/** Fetch on mount (and when `path` changes). `path` null skips. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(!!path);
  const tick = useRef(0);
  const load = useCallback(async () => {
    if (!path) return;
    const my = ++tick.current;
    setLoading(true);
    setError(null);
    try {
      const d = await api<T>(path);
      if (my === tick.current) setData(d);
    } catch (e) {
      if (my === tick.current) setError(e instanceof ApiError ? e : new ApiError(0, 'internal', String(e)));
    } finally {
      if (my === tick.current) setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    void load();
  }, [load]);
  return { data, error, loading, reload: load, setData };
}
