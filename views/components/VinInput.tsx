'use client';
import type { CSSProperties } from 'react';

export const SAMPLE_VIN = '1FA6P8CF9K5123456';

/** VINs never contain I, O or Q; uppercase and drop anything else as the user types. */
export const cleanVin = (s: string) => s.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '').slice(0, 17);

/**
 * 17 boxed cells drawn behind one real <input> (paste, autofill and screen readers just work).
 */
export function VinInput({ value, onChange, id = 'vin', errors, onSample, style }: {
  value: string; onChange: (v: string) => void; id?: string; errors?: string[]; onSample?: () => void; style?: CSSProperties;
}) {
  const done = value.length === 17;
  const errId = errors?.length ? `${id}-err` : '';
  return (
    <div className="field" style={style}>
      <label htmlFor={id}>Vehicle identification number</label>
      <input
        id={id}
        className="inp vin"
        value={value}
        onChange={(e) => onChange(cleanVin(e.target.value))}
        placeholder="_________________"
        maxLength={17}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        aria-describedby={`${id}-hint ${errId}`.trim()}
        aria-invalid={!!errors?.length || undefined}
        style={{
          minHeight: 76, fontSize: 28, letterSpacing: '19.2px', padding: '0 20px', maxWidth: 690,
          backgroundImage: 'repeating-linear-gradient(90deg,transparent 0 37px,var(--line) 37px 38px)',
          backgroundPosition: '20px 0', backgroundRepeat: 'no-repeat', backgroundSize: '646px 100%',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', maxWidth: 690, gap: 12, flexWrap: 'wrap' }}>
        <span id={`${id}-hint`} className="small">VINs never use I, O or Q. We drop them as you type.</span>
        <span className="mono" style={{ fontSize: 13, color: done ? 'var(--blue)' : 'var(--mid)' }} aria-live="polite">
          {value.length} / 17
        </span>
      </div>
      {errId && (
        <div id={errId} role="alert">{errors!.map((e) => <p key={e} className="err">{e}</p>)}</div>
      )}
      {onSample && (
        <button type="button" className="btn-o" style={{ alignSelf: 'flex-start', marginTop: 8 }} onClick={() => { onChange(SAMPLE_VIN); onSample(); }}>
          Try a sample VIN
        </button>
      )}
    </div>
  );
}
