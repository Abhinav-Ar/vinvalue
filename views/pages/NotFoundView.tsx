import Link from 'next/link';
import type { Metadata } from 'next';
import { CarDrawing } from '@/views/components/CarDrawing';

export const metadata: Metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <section className="wrap g2" style={{ paddingTop: 80, paddingBottom: 80, alignItems: 'center' }}>
      <div>
        <p className="mono" aria-hidden="true" style={{ fontSize: 120, margin: '10px 0 0', lineHeight: 1, color: 'transparent', WebkitTextStroke: '1.5px var(--ink)' }}>404</p>
        <h1 className="title">Page not found</h1>
        <p className="lede" style={{ marginTop: 14 }}>The link may be old, or the report was removed. Your garage still has everything you saved.</p>
        <div style={{ display: 'flex', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
          <Link className="btn" href="/appraise">Start a new appraisal</Link>
          <Link className="btn-o" href="/">Back to home</Link>
        </div>
      </div>
      <div>
        <CarDrawing
          variant="gt"
          label="Line drawing of a coupe with its rear wheel rolled away"
          parts={{ rearWheel: { transform: 'translate(70px, 34px) rotate(24deg)', transformBox: 'fill-box', transformOrigin: 'center' } }}
        />
      </div>
    </section>
  );
}
