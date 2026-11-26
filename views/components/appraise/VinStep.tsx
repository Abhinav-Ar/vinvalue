'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '@/views/components/client/api';
import { Stepper, ErrorNote } from '@/views/components/ui';
import { VinInput, SAMPLE_VIN, cleanVin } from '@/views/components/VinInput';
import { CarDrawing } from '@/views/components/CarDrawing';
import { saveDecode, type DecodeResult } from './session';

const minutes = (sec: unknown) => Math.max(1, Math.ceil((typeof sec === 'number' ? sec : 60) / 60));

/** /appraise: step 1, identify the car from its VIN. */
export function VinStep() {
  const router = useRouter();
  const [vin, setVin] = useState('');
  const [imported, setImported] = useState(false);
  const [vinErrors, setVinErrors] = useState<string[] | undefined>();
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  // The landing hero form submits GET /appraise?vin=...: prefill from it.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('vin');
    if (q) setVin(cleanVin(q));
  }, []);

  const focusVin = () => requestAnimationFrame(() => document.getElementById('vin')?.focus());

  async function identify(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    if (vin.length !== 17) {
      setVinErrors([`A VIN has exactly 17 characters. This one has ${vin.length}.`]);
      focusVin();
      return;
    }
    setVinErrors(undefined);
    setBusy(true);
    try {
      const decode = await api<DecodeResult>('/api/vin/decode', { body: { vin, importedVehicle: imported || undefined } });
      saveDecode({ decode, importedVehicle: imported });
      router.push('/appraise/details');
    } catch (err) {
      const ae = err instanceof ApiError ? err : new ApiError(0, 'internal', 'Something went wrong on our side. Try again.');
      if (ae.fields.vin?.length) {
        setVinErrors(ae.fields.vin);
        focusVin();
      } else {
        setError(ae);
      }
      setBusy(false);
    }
  }

  const showImported = imported || !!vinErrors?.some((m) => /check/i.test(m));

  return (
    <>
      <Stepper step={1} />
      <section className="wrap g2 page" style={{ gridTemplateColumns: '7fr 5fr', alignItems: 'start' }}>
        <form onSubmit={identify} noValidate className="stack" style={{ gap: 'var(--s6)' }}>
          <div className="head" style={{ marginBottom: 0 }}>
            <h1 className="title">Enter your VIN</h1>
            <p className="lede">We find the exact car, then ask only what changes its value.</p>
          </div>
          <VinInput
            value={vin}
            onChange={(v) => { setVin(v); if (vinErrors) setVinErrors(undefined); }}
            errors={vinErrors}
          />
          {showImported && (
            <label className="row" style={{ minHeight: 44, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={imported}
                onChange={(e) => setImported(e.target.checked)}
                style={{ width: 20, height: 20, accentColor: 'var(--blue)', margin: 0 }}
              />
              Imported car (its VIN may skip the US check digit)
            </label>
          )}

          <VinError error={error} onRetry={() => void identify()} />

          <div className="row">
            <button type="submit" className="btn" disabled={busy}>
              {busy ? 'Finding your car…' : 'Find my car'} <span className="arr" aria-hidden="true">→</span>
            </button>
            <button
              type="button"
              className="textbtn"
              onClick={() => { setVin(SAMPLE_VIN); setVinErrors(undefined); setError(null); }}
            >
              Use a sample VIN
            </button>
          </div>
        </form>

        <aside className="stack" style={{ gap: 'var(--s4)' }}>
          <h2 className="kicker">Where to find it</h2>
          <CarDrawing
            variant="sedan"
            viewBox="10 10 970 340"
            label="Line drawing of a car. Marker 1 is at the base of the windshield on the driver side, marker 2 is on the driver door jamb."
            markers={[{ x: 352, y: 168, n: 1 }, { x: 512, y: 232, n: 2 }]}
          />
          <ol className="small" style={{ margin: 0, paddingLeft: 'var(--s5)', display: 'flex', flexDirection: 'column', gap: 'var(--s2)' }}>
            <li>Base of the windshield, driver side.</li>
            <li>Driver door jamb sticker.</li>
            <li>Registration, title or insurance card.</li>
          </ol>
        </aside>
      </section>
    </>
  );
}

function VinError({ error, onRetry }: { error: ApiError | null; onRetry: () => void }) {
  if (!error) return null;
  if (error.code === 'vin_not_decoded') {
    return (
      <div className="notice" role="alert" style={{ maxWidth: 640 }}>
        <p style={{ margin: 0 }}>We couldn’t match this VIN to a car.</p>
        <p className="small" style={{ margin: 'var(--s2) 0 0' }}>
          Check it against the windshield plate. Common mix-ups: 8/B, 5/S, 2/Z, 0/D.
        </p>
      </div>
    );
  }
  if (error.status === 502) {
    return (
      <div className="notice" role="alert" style={{ maxWidth: 640 }}>
        <p style={{ margin: 0 }}>The VIN lookup didn&apos;t respond. Your VIN is fine.</p>
        <button type="button" className="btn-o" style={{ marginTop: 'var(--s3)' }} onClick={onRetry}>Try again</button>
      </div>
    );
  }
  if (error.status === 429) {
    const n = minutes(error.details.retryAfterSec);
    return (
      <div className="notice" role="alert" style={{ maxWidth: 640 }}>
        <p style={{ margin: 0 }}>Too many lookups. Try again in {n} minute{n === 1 ? '' : 's'}.</p>
      </div>
    );
  }
  return (
    <div style={{ maxWidth: 640 }}>
      <ErrorNote error={error} onRetry={onRetry} />
    </div>
  );
}
