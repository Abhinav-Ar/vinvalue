'use client';
import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
export function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null); const [shown, setShown] = useState(false);
  useEffect(() => { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(true); return; } const el = ref.current; if (!el) return; const io = new IntersectionObserver(([entry]) => { if (entry?.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: .08 }); io.observe(el); return () => io.disconnect(); }, []);
  return <div ref={ref} className={`reveal ${shown ? 'reveal-visible' : ''} ${className}`} style={{ '--reveal-delay': `${delay}ms` } as CSSProperties}>{children}</div>;
}
