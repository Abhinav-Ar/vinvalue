'use client';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import type { PublicReport } from '@/lib/appraisals/report';
import { api, ApiError, useApi } from '@/lib/client/api';
import { longDate, miles, num, usd, usdSigned } from '@/lib/client/format';
import { EmptyState, ErrorNote, Skeleton, Stepper } from '@/components/ui';
import { RangeBar } from '@/components/RangeBar';
import { CarDrawing } from '@/components/CarDrawing';
import { CompsScatter } from './CompsScatter';
import { carVariant } from './session';

const ROWS_SHOWN = 6;

const SELF_LABEL: Record<string, string> = {
  condition: 'Condition', accidents: 'Accident history', title: 'Title', owners: 'Owners',
  keys: 'Keys', warningLights: 'Warning lights', serviceHistory: 'Service history',
};
const FLAG_TEXT: Record<string, string> = {
  mileage_high_for_age: 'The mileage is high for the car’s age. If the odometer reading was mistyped, run the appraisal again.',
  mileage_below_last_reading: 'This mileage is lower than the last reading saved for this car, so it was not added to the odometer history.',
};

const amount = (n: number) => (n === 0 ? '$0' : usdSigned(n));

/** /report/[slug]: the public appraisal report. */
export function ReportView({ slug }: { slug: string }) {
  const { data: r, error, loading, reload, setData } = useApi<PublicReport>(`/api/reports/${encodeURIComponent(slug)}`);
  const me = useApi<{ signedIn: boolean }>('/api/me');

  if (loading && !r) return <ReportSkeleton />;
  if (error?.status === 404) {
    return (
      <section className="wrap page">
        <h1 className="title">Report not found</h1>
        <div style={{ marginTop: 28 }}>
          <EmptyState
            text="This link is wrong or the report has expired. Reports that are not saved to an account are removed after a while."
            action={<Link className="btn" href="/appraise">Start a new appraisal</Link>}
          />
        </div>
      </section>
    );
  }
  if (error || !r) {
    return (
      <section className="wrap page">
        <h1 className="title">Appraisal report</h1>
        <div style={{ marginTop: 28 }}><ErrorNote error={error} onRetry={reload} /></div>
      </section>
    );
  }

  const signedIn = !!me.data?.signedIn;

  return (
    <div className="grid">
      <Stepper step={3} />
      <section className="wrap" style={{ paddingTop: 48, paddingBottom: 96 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 20, flexWrap: 'wrap' }}>
          <h1 className="title">{r.vehicle.label}</h1>
          <Actions report={r} signedIn={signedIn} onClaimed={(c) => setData(c)} />
        </div>
        <SaveNote report={r} signedIn={signedIn} meLoading={me.loading} />

        <div className="sheet frame" style={{ marginTop: 28, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
          <Cell k="Vehicle" v={r.vehicle.label} />
          <Cell k="VIN" v={<span className="vin">{r.vin}</span>} />
          <Cell k="Mileage" v={<span className="mono">{num(r.mileage)} mi</span>} />
          <Cell k="ZIP" v={<span className="mono">{r.zip}</span>} />
          <Cell k="Date" v={longDate(r.date)} />
        </div>

        <div className="g2" style={{ marginTop: 56, alignItems: 'center', gridTemplateColumns: '5fr 7fr' }}>
          <div>
            <h2 className="label" style={{ color: 'var(--blue)', fontSize: 13 }}>Private sale estimate</h2>
            <p className="mono" style={{ margin: '10px 0 24px', fontSize: 84, letterSpacing: '-.04em', lineHeight: 1 }}>{usd(r.private.value)}</p>
            <div style={{ fontSize: 14 }}>
              <RangeBar low={r.private.low} high={r.private.high} value={r.private.value} label={`Likely range ${usd(r.private.low)} to ${usd(r.private.high)}, estimate ${usd(r.private.value)}`} />
            </div>
            <p className="small" style={{ marginTop: 12 }}>Likely range based on comparable listings</p>
          </div>
          <div><CarDrawing variant={carVariant(r.vehicle.model)} /></div>
        </div>

        <div className="g3" style={{ marginTop: 56 }}>
          <ValueCard name="Instant sale" value={r.instant.value} note="Sell today to a dealer or instant buyer." />
          <ValueCard name="Private sale" value={r.private.value} note="Most money. You run the sale." mine />
          <ValueCard name="Dealer retail" value={r.retail.value} note="Same car on a lot, prep included." />
        </div>

        <Comps report={r} />
        <Ladder report={r} />
        <ConfidenceBlock report={r} />
      </section>
    </div>
  );
}

function Actions({ report: r, signedIn, onClaimed }: { report: PublicReport; signedIn: boolean; onClaimed: (r: PublicReport) => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimErr, setClaimErr] = useState<ApiError | null>(null);

  async function share() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied('Link copied.');
    } catch {
      setCopied(`Copy this link: ${url}`);
    }
  }
  async function claim() {
    setClaiming(true);
    setClaimErr(null);
    try {
      onClaimed(await api<PublicReport>(`/api/reports/${encodeURIComponent(r.slug)}/claim`, { method: 'POST' }));
    } catch (e) {
      setClaimErr(e instanceof ApiError ? e : new ApiError(0, 'internal', 'Something went wrong on our side. Try again.'));
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {signedIn && !r.saved && (
          <button type="button" className="btn" onClick={claim} disabled={claiming}>{claiming ? 'Saving to my garage' : 'Save to my garage'}</button>
        )}
        <button type="button" className="btn-o" onClick={share}>Copy share link</button>
        <button type="button" className="btn-o" onClick={() => window.print()}>Print or save as PDF</button>
      </div>
      <p className="small" role="status" style={{ margin: 0, minHeight: 18, overflowWrap: 'anywhere' }}>{copied}</p>
      {claimErr && <div style={{ alignSelf: 'stretch' }}><ErrorNote error={claimErr} onRetry={claimErr.status === 409 ? undefined : claim} /></div>}
    </div>
  );
}

function SaveNote({ report: r, signedIn, meLoading }: { report: PublicReport; signedIn: boolean; meLoading: boolean }) {
  if (r.saved) {
    return r.code ? <p className="small" style={{ margin: '8px 0 0' }}>Saved as report {r.code}.</p> : null;
  }
  if (meLoading) return null;
  const expires = r.expiresOn ? ` It will be removed on ${longDate(r.expiresOn)}.` : '';
  return (
    <p className="small" style={{ margin: '8px 0 0' }}>
      This report is not saved to an account.{expires}
      {!signedIn && <> <Link href={`/sign-in?callbackUrl=${encodeURIComponent(`/report/${r.slug}`)}`}>Sign in to save it</Link>.</>}
    </p>
  );
}

function Cell({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="cell">
      <p className="label">{k}</p>
      <p style={{ margin: '6px 0 0', fontSize: 15, overflowWrap: 'anywhere' }}>{v}</p>
    </div>
  );
}

function ValueCard({ name, value, note, mine }: { name: string; value: number; note: string; mine?: boolean }) {
  return (
    <div className="sheet" style={{ padding: '20px 22px', ...(mine ? { borderColor: 'var(--blue)', background: 'var(--soft)' } : {}) }}>
      <p className="label" style={mine ? { color: 'var(--blue)' } : undefined}>{name}</p>
      <p className="mono" style={{ margin: '8px 0 6px', fontSize: 28 }}>{usd(value)}</p>
      <p className="small" style={{ margin: 0 }}>{note}</p>
    </div>
  );
}

function weightText(c: PublicReport['comps'][number]) {
  if (c.excludedAsOutlier) return 'Outlier, not used';
  if (c.trimMatch === 'excluded') return 'Other trim, not used';
  return c.weightLabel;
}

function Comps({ report: r }: { report: PublicReport }) {
  const [all, setAll] = useState(false);
  const rows = all ? r.comps : r.comps.slice(0, ROWS_SHOWN);
  const s = r.compStats;
  const heading = s.summary.charAt(0).toUpperCase() + s.summary.slice(1);
  return (
    <>
      <div style={{ marginTop: 96 }}>
        <h2 className="h2" style={{ fontSize: 30, margin: 0 }}>{heading}</h2>
      </div>
      <div className="g2" style={{ marginTop: 28, alignItems: 'start' }}>
        <div className="sheet" style={{ padding: 20 }}>
          {r.comps.length ? (
            <CompsScatter comps={r.comps} subject={{ miles: r.mileage, value: r.private.value }} />
          ) : (
            <p className="small" style={{ margin: 0 }}>No listing details were stored for this report.</p>
          )}
        </div>
        <div className="sheet" style={{ padding: '8px 8px 4px' }}>
          <div className="scroll-x" tabIndex={0} role="region" aria-label="Comparable listings table">
            <table className="tbl">
              <caption className="sr">Comparable listings, asking prices as listed</caption>
              <thead>
                <tr><th scope="col">Year</th><th scope="col">Trim</th><th scope="col" className="num">Miles</th><th scope="col" className="num">Away</th><th scope="col" className="num">Asking price</th><th scope="col">Weight</th></tr>
              </thead>
              <tbody>
                {rows.map((c, i) => {
                  const out = c.excludedAsOutlier || c.trimMatch === 'excluded';
                  return (
                    <tr key={i} style={out ? { color: 'var(--mid)' } : undefined}>
                      <td className="mono">{c.year}</td>
                      <td>{c.trim ?? '–'}</td>
                      <td className="num">{num(c.miles)}</td>
                      <td className="num">{c.distance == null ? '–' : miles(c.distance)}</td>
                      <td className="num" style={out ? { textDecoration: 'line-through' } : undefined}>{usd(c.price)}</td>
                      <td className="mono">{weightText(c)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="small" style={{ padding: 12, margin: 0, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            Showing {rows.length} of {r.comps.length}.
            {r.comps.length > ROWS_SHOWN && (
              <button type="button" className="btn-o" style={{ minHeight: 44 }} onClick={() => setAll(!all)} aria-expanded={all}>
                {all ? 'Show fewer listings' : `Show all ${r.comps.length} listings`}
              </button>
            )}
          </p>
        </div>
      </div>
    </>
  );
}

function Ladder({ report: r }: { report: PublicReport }) {
  return (
    <div className="g2" style={{ marginTop: 96, alignItems: 'start', gridTemplateColumns: '7fr 5fr' }}>
      <div>
        <h2 className="h2" style={{ fontSize: 30, margin: '0 0 20px' }}>From the market median to your car</h2>
        <LadderRow label={r.base.label} value={usd(r.base.amount)} />
        {r.adjustments.map((a) => <LadderRow key={a.key} label={a.label} value={amount(a.amount)} reason={a.reason} />)}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '16px 0 0', marginTop: 6, borderTop: '3px double var(--ink)', fontWeight: 600 }}>
          <span>Private sale estimate</span>
          <span className="mono" style={{ color: 'var(--blue)' }}>{usd(r.private.value)}</span>
        </div>
      </div>
      <aside className="sheet" style={{ padding: 28 }}>
        <h2 className="label" style={{ fontSize: 13 }}>Method notes</h2>
        <ol style={{ fontSize: 15, lineHeight: 1.6, paddingLeft: 20, color: 'var(--ink)' }}>
          {r.methodNotes.map((n) => <li key={n}>{n}</li>)}
        </ol>
        <p className="small" style={{ margin: '16px 0 0' }}>Valuation method version {r.methodVersion}</p>
      </aside>
    </div>
  );
}

function LadderRow({ label, value, reason }: { label: string; value: string; reason?: string }) {
  return (
    <div style={{ padding: '12px 0' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
        <span>{label}</span>
        <span style={{ flex: 1, borderBottom: '1px dotted var(--mid)', minWidth: 16 }} />
        <span className="mono">{value}</span>
      </div>
      {reason && <p className="small" style={{ margin: '4px 0 0', maxWidth: 560 }}>{reason}</p>}
    </div>
  );
}

function ConfidenceBlock({ report: r }: { report: PublicReport }) {
  const c = r.confidence;
  if (!c) return null;
  const adj = new Map(r.adjustments.map((a) => [a.key, a.label]));
  const trim = r.vehicle.trim;

  const checked: string[] = [];
  checked.push(
    c.decodeStatus === 'partial'
      ? 'Year, make and model partly decoded from the VIN and confirmed by you.'
      : c.decodeStatus === 'check_digit_mismatch'
        ? 'Year, make and model decoded from the VIN, which fails the check digit test.'
        : 'Year, make and model decoded from the VIN.',
  );
  if (!c.trimConfirmedByUser) {
    checked.push(trim ? `Trim ${trim}, the only one this VIN matches. Not confirmed by you.` : 'Trim unknown, so listings of every trim were compared.');
  }
  checked.push(`Prices from ${r.compStats.used} live listings within ${r.compStats.radiusMiles} miles.`);

  const reported: string[] = [`Mileage, ${num(r.mileage)}`];
  if (c.trimConfirmedByUser && trim) reported.push(`Trim, ${trim}`);
  for (const k of c.selfReported) reported.push(adj.get(k) ?? SELF_LABEL[k] ?? k);

  const flags = c.flags.map((f) => FLAG_TEXT[f]).filter(Boolean) as string[];

  return (
    <section style={{ marginTop: 96 }} aria-labelledby="trust-h">
      <h2 id="trust-h" className="h2" style={{ fontSize: 30, margin: '0 0 28px' }}>How much to trust this number</h2>
      {flags.length > 0 && (
        <div className="notice" style={{ marginBottom: 28 }}>
          {flags.map((f) => <p key={f} style={{ margin: 0 }}>{f}</p>)}
        </div>
      )}
      <div className="g3" style={{ alignItems: 'start' }}>
        <TrustList title="Checked against data" items={checked} />
        <TrustList title="You reported, not verified" items={reported} />
        {c.rangeReasons.length > 0 && (
          <TrustList title={`Why the range is ${usd(r.private.low)} to ${usd(r.private.high)}`} items={c.rangeReasons} />
        )}
      </div>
    </section>
  );
}

function TrustList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 style={{ fontSize: 17, fontWeight: 600, margin: '0 0 8px' }}>{title}</h3>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map((t) => (
          <li key={t} style={{ padding: '10px 0', borderTop: '1px solid var(--line)', fontSize: 15 }}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="grid">
      <Stepper step={3} />
      <section className="wrap" style={{ paddingTop: 48, paddingBottom: 96 }} aria-busy="true">
        <Skeleton w="50%" h={40} />
        <Skeleton h={80} style={{ marginTop: 28 }} />
        <div className="g2" style={{ marginTop: 56, gridTemplateColumns: '5fr 7fr' }}>
          <div><Skeleton w={120} h={16} /><Skeleton w="80%" h={84} style={{ marginTop: 10 }} /><Skeleton h={14} style={{ marginTop: 24 }} /></div>
          <Skeleton h={220} />
        </div>
        <div className="g3" style={{ marginTop: 56 }}><Skeleton h={120} /><Skeleton h={120} /><Skeleton h={120} /></div>
      </section>
    </div>
  );
}
