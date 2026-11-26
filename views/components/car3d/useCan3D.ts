'use client';
import dynamic from 'next/dynamic';
import { useSyncExternalStore } from 'react';

/** The WebGL drive-in, client only. Renders nothing while its chunk loads; the drawing covers that time. */
export const Drive3D = dynamic(() => import('./DriveCanvas'), { ssr: false, loading: () => null });

let webgl: boolean | null = null;
function hasWebGL() {
  if (webgl !== null) return webgl;
  try {
    const c = document.createElement('canvas');
    webgl = !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    webgl = false;
  }
  return webgl;
}

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * True when the 3D car should replace the drawing: WebGL works and the user has not asked for
 * reduced motion. False on the server and during hydration, so the SVG always renders first.
 */
export function useCan3D() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(QUERY);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => !window.matchMedia(QUERY).matches && hasWebGL(),
    () => false,
  );
}
