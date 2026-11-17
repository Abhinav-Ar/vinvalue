'use client';
import { useEffect, useState } from 'react';

/** Value that follows `value` after it has stopped changing for `ms`. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/** "$27,450" / "27450" -> 27450; empty or invalid -> null. */
export const parseDollars = (s: string): number | null => {
  const d = s.replace(/[^0-9]/g, '');
  return d ? Number(d) : null;
};

/** Minus sign (U+2212) for negative money, as the designs use. */
export const usdNeg = (n: number) => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
