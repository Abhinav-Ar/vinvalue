'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/client/api';
import { Stepper, ErrorNote } from '@/components/ui';
import { VinInput, SAMPLE_VIN, cleanVin } from '@/components/VinInput';
import { CarDrawing } from '@/components/CarDrawing';
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
      <section className="wrap g2" style={{ paddingTop: 72, paddingBottom: 96, gridTemplateColumns: '7fr 5fr' }}>
        <form onSubmit={identify} noValidate>
          <h1 className="title">Enter your VIN</h1>
          <p className="lede" style={{ marginTop: 18, maxWidth: 560 }}>
            We identify the exact car first, then ask only for the details that change its value.
          </p>
          <VinInput
            value={vin}
            onChange={(v) => { setVin(v); if (vinErrors) setVinErrors(undefined); }}
            errors={vinErrors}
            style={{ marginTop: 40 }}
          />
          {showImported && (
            <label style={{ display: 'flex', gap: 12, alignItems: 'center', minHeight: 44, marginTop: 12, fontSize: 15, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={imported}
                onChange={(e) => setImported(e.target.checked)}
                style={{ width: 20, height: 20, accentColor: 'var(--blue)', margin: 0 }}
              />
              This car was imported, so its VIN may not follow the US check digit rule
            </label>
          )}

          <VinError error={error} onRetry={() => void identify()} />

          <div style={{ display: 'flex', gap: 12, marginTop: 32, flexWrap: 'wrap' }}>
            <button type="submit" className="btn" disabled={busy}>
              {busy ? 'Identifying vehicle' : 'Identify vehicle'}
            </button>
            <button
              type="button"
              className="btn-o"
              onClick={() => { setVin(SAMPLE_VIN); setVinErrors(undefined); setError(null); }}
            >
              Try a sample VIN
            </button>
          </div>
          <p className="small" style={{ marginTop: 28 }}>No account needed.</p>
        </form>

        <aside className="sheet" style={{ padding: 28, alignSelf: 'start' }}>
          <h2 className="label" style={{ fontSize: 13 }}>Where to find it</h2>
          <div style={{ margin: '16px 0 8px' }}>
            <CarDrawing
              variant="gt"
              viewBox="10 10 970 340"
              label="Line drawing of a coupe. Marker 1 is at the base of the windshield on the driver side, marker 2 is on the driver door jamb."
              markers={[{ x: 404, y: 160, n: 1 }, { x: 656, y: 232, n: 2 }]}
            />
          </div>
          <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {[
              'Dashboard, driver side. Look through the base of the windshield.',
              'Driver door jamb, on the label by the latch.',
              'Your registration, title or insurance card.',
            ].map((t, i) => (
              <li key={t} style={{ display: 'flex', gap: 14, padding: '14px 0', borderTop: '1px solid var(--line)' }}>
                <span className="mono" style={{ color: 'var(--blue)' }}>{i + 1}</span>
                <span>{t}</span>
              </li>
            ))}
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
      <div className="notice" role="alert" style={{ marginTop: 24, maxWidth: 690 }}>
        <p style={{ margin: 0, fontWeight: 500 }}>We could not match this VIN to a vehicle.</p>
        <p style={{ margin: '8px 0 0' }}>
          Compare it character by character with the plate at the base of the windshield or the label in the
          driver door jamb. Easy ones to mix up are 8 and B, 5 and S, 2 and Z, 0 and D.
        </p>
      </div>
    );
  }
  if (error.status === 502) {
    return (
      <div className="notice" role="alert" style={{ marginTop: 24, maxWidth: 690 }}>
        <p style={{ margin: 0 }}>The VIN lookup service didn&apos;t respond. Your VIN was not the problem.</p>
        <button type="button" className="btn-o" style={{ marginTop: 14 }} onClick={onRetry}>Try again</button>
      </div>
    );
  }
  if (error.status === 429) {
    const n = minutes(error.details.retryAfterSec);
    return (
      <div className="notice" role="alert" style={{ marginTop: 24, maxWidth: 690 }}>
        <p style={{ margin: 0 }}>Too many VIN lookups in a short time. Try again in {n} minute{n === 1 ? '' : 's'}.</p>
      </div>
    );
  }
  return (
    <div style={{ marginTop: 24, maxWidth: 690 }}>
      <ErrorNote error={error} onRetry={onRetry} />
    </div>
  );
}
