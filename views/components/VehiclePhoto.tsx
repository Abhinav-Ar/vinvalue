'use client';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CarDrawing } from './CarDrawing';
import { carVariant } from './appraise/session';

export type VehiclePhotoCar = { year?: number | string | null; make?: string | null; model?: string | null; trim?: string | null; color?: string | null; storedPhoto?: string | null; body?: string | null };
/** `fallback` replaces the generic illustration when no photo is found (e.g. the right body-style drawing). */
export function VehiclePhoto({ car, className = '', priority = false, interactive = true, fallback }: { car: VehiclePhotoCar; className?: string; priority?: boolean; interactive?: boolean; fallback?: ReactNode }) {
  const { year, make, model, trim, color, storedPhoto } = car;
  const query = useMemo(() => JSON.stringify([year, make, model, trim, color, storedPhoto]), [year, make, model, trim, color, storedPhoto]);
  const [photos, setPhotos] = useState<string[]>(storedPhoto ? [storedPhoto] : []);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(0); setPhotos(storedPhoto ? [storedPhoto] : []);
    if (!year || !make || !model) return;
    const controller = new AbortController(); const params = new URLSearchParams({ year: String(year), make: String(make), model: String(model) });
    if (trim) params.set('trim', trim); if (color) params.set('color', color);
    fetch(`/api/photo?${params}`, { signal: controller.signal }).then((r) => r.ok ? r.json() : Promise.reject(new Error('unavailable'))).then((d) => {
      if (controller.signal.aborted) return; const found = [...new Set([storedPhoto, ...(d.photos ?? []), d.photo].filter((x): x is string => typeof x === 'string' && /^https?:\/\//.test(x)))]; setPhotos(found);
    }).catch(() => { /* Keep a stored photo, or the illustration, on lookup failure. */ });
    return () => controller.abort();
  }, [query, year, make, model, trim, color, storedPhoto]);
  const label = [year, make, model].filter(Boolean).join(' ') || 'Vehicle';
  const photo = photos[index];
  if (!photo && fallback) return <>{fallback}</>;
  if (!photo) return <div className={`photo-frame photo-fallback ${className}`} role="img" aria-label={`${label}, line drawing (no photo found)`}><CarDrawing variant={carVariant(String(model ?? ''), car.body)} ink={false} /><small>Line drawing · no photo found</small></div>;
  return <div className={`photo-frame ${className}`}><img key={photo} src={photo} alt={`Representative ${label}`} loading={priority ? 'eager' : 'lazy'} referrerPolicy="no-referrer" onError={() => setIndex((i) => i + 1)} /><span className="photo-scrim">Representative vehicle</span>{interactive && photos.length > 1 && <button type="button" className="photo-next" onClick={() => setIndex((i) => (i + 1) % photos.length)} aria-label="Show another representative photo">Another photo</button>}</div>;
}
