'use client';
import type { CSSProperties } from 'react';

export const SAMPLE_VIN = '1FA6P8CF9K5123456';

/** VINs never contain I, O or Q; uppercase and drop anything else as the user types. */
export const cleanVin = (s: string) => s.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '').slice(0, 17);

/** One large VIN field: uppercases and drops characters a VIN can't contain. */
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
        placeholder="17 characters"
        maxLength={17}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        aria-describedby={`${id}-hint ${errId}`.trim()}
        aria-invalid={!!errors?.length || undefined}
        style={{ minHeight: 72, fontSize: 'var(--t-xl)', letterSpacing: '.14em', padding: '0 var(--s6)', maxWidth: 640 }}
      />
      <div className="row" style={{ justifyContent: 'space-between', maxWidth: 640, padding: '0 var(--s6)' }}>
        <span id={`${id}-hint`} className="small">No I, O or Q.</span>
        <span className="kicker" style={done ? { color: 'var(--blue)' } : undefined} aria-live="polite">
          {value.length} / 17
        </span>
      </div>
      {errId && (
        <div id={errId} role="alert">{errors!.map((e) => <p key={e} className="err">{e}</p>)}</div>
      )}
      {onSample && (
        <button type="button" className="btn-o" style={{ alignSelf: 'flex-start', marginTop: 'var(--s2)' }} onClick={() => { onChange(SAMPLE_VIN); onSample(); }}>
          Try a sample VIN
        </button>
      )}
    </div>
  );
}
