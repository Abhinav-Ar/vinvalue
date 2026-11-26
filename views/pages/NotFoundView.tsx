import Link from 'next/link';
import type { Metadata } from 'next';
import { CarDrawing } from '@/views/components/CarDrawing';

export const metadata: Metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <section className="wrap g2 page" style={{ alignItems: 'center', minHeight: '70vh' }}>
      <div className="stack" style={{ gap: 'var(--s5)', alignItems: 'flex-start' }}>
        <p className="kicker">404</p>
        <h1 className="display">Wrong turn.</h1>
        <p className="lede">This page doesn’t exist, or the report was removed.</p>
        <div className="row">
          <Link className="btn" href="/appraise">Value a car</Link>
          <Link className="btn-o" href="/">Home</Link>
        </div>
      </div>
      <CarDrawing
        variant="gt"
        label="Line drawing of a coupe with its rear wheel rolling away"
        parts={{ rearWheel: { transform: 'translate(70px, 34px) rotate(24deg)', transformBox: 'fill-box', transformOrigin: 'center' } }}
      />
    </section>
  );
}
