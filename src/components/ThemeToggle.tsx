'use client';
import { useEffect, useState } from 'react';

import { THEME_KEY, type Theme } from './theme-script';

export function useTheme(): Theme {
  const [t, setT] = useState<Theme>('light');
  useEffect(() => {
    const read = () => setT(document.documentElement.dataset.theme === 'night' ? 'night' : 'light');
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);
  return t;
}

export function ThemeToggle() {
  const theme = useTheme();
  const next: Theme = theme === 'night' ? 'light' : 'night';
  return (
    <button
      type="button"
      className="ghost"
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem(THEME_KEY, next);
        } catch {
          /* private mode: the choice lasts for this page only */
        }
      }}
      aria-label={next === 'night' ? 'Switch to the dark blueprint theme' : 'Switch to the light theme'}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path d="M8 1.5 A6.5 6.5 0 0 0 8 14.5 Z" fill="currentColor" />
      </svg>
      <span suppressHydrationWarning>{next === 'night' ? 'Dark' : 'Light'}</span>
    </button>
  );
}
