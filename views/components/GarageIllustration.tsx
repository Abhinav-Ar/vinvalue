import type { CSSProperties } from 'react';

export function GarageIllustration({ variant = 'hero', className = '' }: { variant?: 'hero' | 'compact' | 'report'; className?: string }) {
  const height = variant === 'hero' ? 260 : variant === 'report' ? 180 : 130;
  return <svg className={className} viewBox="0 0 640 280" width="100%" height={height} role="img" aria-label="Technical graphite vehicle illustration" style={{ display: 'block' } as CSSProperties}>
    <path d="M54 224H586" stroke="var(--line)" />
    <path d="M100 207c12-57 51-82 112-89l54-7 62 7c48 6 86 31 111 89H100Z" fill="var(--vehicle-shadow)" stroke="var(--ink)" strokeWidth="2" />
    <path d="m271 113 43 5 32 57H233l38-62Z" fill="var(--glass)" stroke="var(--line)" />
    <path d="M104 188h432M136 166h38M463 166h40" stroke="var(--signal)" strokeWidth="2" />
    <circle cx="192" cy="207" r="28" fill="var(--paper)" stroke="var(--ink)" strokeWidth="5" /><circle cx="192" cy="207" r="10" fill="var(--signal)" />
    <circle cx="448" cy="207" r="28" fill="var(--paper)" stroke="var(--ink)" strokeWidth="5" /><circle cx="448" cy="207" r="10" fill="var(--signal)" />
    <path d="M92 224v18m456-18v18M92 242h456" stroke="var(--line)" />
    {variant === 'hero' && <text x="320" y="263" textAnchor="middle" className="hand" fill="var(--mid)">BUILT TO BE UNDERSTOOD</text>}
  </svg>;
}
