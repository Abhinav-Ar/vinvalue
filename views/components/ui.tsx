'use client';
/**
 * Small shared building blocks. Class names come from the design stylesheet (globals.css).
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useId, type CSSProperties, type ReactNode } from 'react';
import type { ApiError } from '@/views/components/client/api';

/** `.sheet` box; `frame` adds the cobalt corner marks (landing, report and car art only). */
export function Card({ frame, children, style, as: Tag = 'div', className = '' }: {
  frame?: boolean; children: ReactNode; style?: CSSProperties; as?: 'div' | 'section' | 'aside' | 'article'; className?: string;
}) {
  return <Tag className={`sheet${frame ? ' frame' : ''} ${className}`.trim()} style={style}>{children}</Tag>;
}

/** Label + control + hint + field errors (errors from the API's `fields`). */
export function Field({ label, hint, errors, children, id: idProp, style }: {
  label: ReactNode; hint?: ReactNode; errors?: string[];
  children: (a: { id: string; describedBy?: string; invalid: boolean }) => ReactNode; id?: string; style?: CSSProperties;
}) {
  const auto = useId();
  const id = idProp ?? auto;
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = errors?.length ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field" style={style}>
      <label htmlFor={id}>{label}</label>
      {children({ id, describedBy, invalid: !!errors?.length })}
      {hint && <span id={hintId} className="small">{hint}</span>}
      {errId && (
        <div id={errId} role="alert">
          {errors!.map((e) => <p key={e} className="err">{e}</p>)}
        </div>
      )}
    </div>
  );
}

export function Select({ value, onChange, options, ...rest }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
  id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean;
}) {
  return (
    <select className="inp" value={value} onChange={(e) => onChange(e.target.value)} {...rest}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

/** `.segs` radio group built on native radios (arrow keys work). */
export function SegmentedControl<T extends string>({ label, value, onChange, options, name }: {
  label: string; value: T | null; onChange: (v: T) => void; options: { value: T; label: string }[]; name?: string;
}) {
  const auto = useId();
  const n = name ?? auto;
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <legend className="sr">{label}</legend>
      <div className="segs">
        {options.map((o) => {
          const on = value === o.value;
          return (
            <label key={o.value} className={`seg${on ? ' on' : ''}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <input
                type="radio"
                name={n}
                value={o.value}
                checked={on}
                onChange={() => onChange(o.value)}
                style={{ position: 'absolute', opacity: 0, inset: 0, margin: 0, cursor: 'pointer' }}
              />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: 'Vehicle', href: '/appraise' },
    { n: 2, label: 'Details', href: '/appraise/details' },
    { n: 3, label: 'Value', href: null },
  ] as const;
  return (
    <nav className="stepper wrap" aria-label="Appraisal steps" style={{ gap: 24 }}>
      {steps.map((s) => {
        const cls = s.n === step ? 'on' : s.n < step ? 'done' : '';
        const text = `${s.n}  ${s.label}`;
        return s.href && s.n < step ? (
          <Link key={s.n} href={s.href} className={cls}>{text}</Link>
        ) : (
          <a key={s.n} className={cls} aria-current={s.n === step ? 'step' : undefined} aria-disabled={s.n > step || undefined}>{text}</a>
        );
      })}
    </nav>
  );
}

export function Skeleton({ w = '100%', h = 16, style }: { w?: number | string; h?: number | string; style?: CSSProperties }) {
  return <span className="skel" aria-hidden="true" style={{ width: w, height: h, ...style }} />;
}

/** One sentence plus the action to take. */
export function EmptyState({ text, action }: { text: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <p style={{ margin: 0, fontSize: 17 }}>{text}</p>
      {action}
    </div>
  );
}

/** Page-level API error with a recovery action. 401 becomes a sign-in prompt. */
export function ErrorNote({ error, onRetry }: { error: ApiError | null; onRetry?: () => void }) {
  const path = usePathname() ?? '/';
  if (!error) return null;
  if (error.status === 401) {
    return (
      <div className="notice" role="alert">
        <p style={{ margin: 0 }}>Sign in to see this page.</p>
        <Link className="btn" href={`/sign-in?next=${encodeURIComponent(path)}`} style={{ marginTop: 14 }}>Sign in</Link>
      </div>
    );
  }
  return (
    <div className="notice" role="alert">
      <p style={{ margin: 0 }}>{error.message}</p>
      {onRetry && <button type="button" className="btn-o" style={{ marginTop: 14 }} onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div>
      <h1 className="title">{children}</h1>
      {sub && <p className="lede" style={{ marginTop: 14, maxWidth: 640 }}>{sub}</p>}
    </div>
  );
}
