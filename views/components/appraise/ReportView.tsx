'use client';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import type { PublicReport } from '@/models/appraisals/report';
import { api, ApiError, useApi } from '@/views/components/client/api';
import { longDate, miles, num, usd } from '@/views/components/client/format';
import { EmptyState, ErrorNote, Skeleton, Stepper } from '@/views/components/ui';
import { RangeBar } from '@/views/components/RangeBar';
import { CarDrawing } from '@/views/components/CarDrawing';
import { VehiclePhoto } from '@/views/components/VehiclePhoto';
import { CompsScatter } from './CompsScatter';
import { RouteDiagram } from '@/views/components/RouteDiagram';
import { Waterfall } from '@/views/components/Waterfall';
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

  const model = !!r.confidence?.flags.includes('model_estimate');
  const recorded = r.compStats.source === 'recorded_sales';
  const drawing = <CarDrawing variant={carVariant(r.vehicle.model, r.vehicle.body)} label={`Line drawing of a ${r.vehicle.label}`} />;

  return (
    <div className="grid">
      <Stepper step={3} />
      <section className="wrap" style={{ paddingTop: 44, paddingBottom: 96 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <p className="kicker">Appraisal report · Method {r.methodVersion}</p>
            <h1 className="title" style={{ marginTop: 10 }}>{r.vehicle.label}</h1>
          </div>
          <div className="no-print"><Actions report={r} signedIn={signedIn} onClaimed={(c) => setData(c)} /></div>
        </div>
        <SaveNote report={r} signedIn={signedIn} meLoading={me.loading} />

        <div className="sheet frame" style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
          <Cell k="Vehicle" v={r.vehicle.label} />
          <Cell k="VIN" v={<span className="vin">{r.vin}</span>} />
          <Cell k="Mileage" v={<span className="mono">{num(r.mileage)} mi</span>} />
          <Cell k="ZIP" v={<span className="mono">{r.zip}</span>} />
          <Cell k="Date" v={longDate(r.date)} />
        </div>

        <div className="g2" style={{ marginTop: 56, alignItems: 'center', gridTemplateColumns: '6fr 6fr' }}>
          <div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <h2 className="kicker" style={{ color: 'var(--blue)' }}>Private sale estimate</h2>
              <span className={`tag${model ? '' : ' on'}`}><i />{model ? 'Model estimate' : recorded ? `${r.compStats.used} recorded sales` : `${r.compStats.used} listings`}</span>
            </div>
            <p className="figure mono" style={{ marginTop: 14 }}>{usd(r.private.value)}</p>
            <div style={{ fontSize: 14, marginTop: 26, maxWidth: 520 }}>
              <RangeBar low={r.private.low} high={r.private.high} value={r.private.value} label={`Likely range ${usd(r.private.low)} to ${usd(r.private.high)}, estimate ${usd(r.private.value)}`} />
            </div>
            <p className="small" style={{ marginTop: 12, maxWidth: 520, lineHeight: 1.5 }}>
              {model
                ? 'No local sales of this model, so the value comes from its original MSRP, age, mileage and collector demand, calibrated against real asking prices. The range is wider to reflect that.'
                : recorded
                  ? 'Likely range, from recorded sales of the same model in Washington State title records.'
                  : 'Likely range, from comparable listings near you.'}
            </p>
          </div>
          <div><VehiclePhoto car={r.vehicle} fallback={drawing} /></div>
        </div>

        <Section idx="01" title="Your price depends on how you sell">
          <RouteDiagram instant={r.instant.value} private={r.private.value} retail={r.retail.value} low={r.private.low} high={r.private.high} />
        </Section>

        <Comps report={r} />
        <Ladder report={r} />
        <ConfidenceBlock report={r} />
      </section>
    </div>
  );
}

function Section({ idx, title, id, children }: { idx: string; title: string; id?: string; children: ReactNode }) {
  const hid = id ?? `sec-${idx}`;
  return (
    <section style={{ marginTop: 96 }} aria-labelledby={hid}>
      <div className="sec-head">
        <span className="idx">{idx}</span>
        <span className="rule" />
        <h2 id={hid} className="h2" style={{ fontSize: 30, margin: '4px 0 0' }}>{title}</h2>
      </div>
      <div style={{ marginTop: 28 }}>{children}</div>
    </section>
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
      {!signedIn && <> <Link href={`/sign-in?next=${encodeURIComponent(`/report/${r.slug}`)}`}>Sign in to save it</Link>.</>}
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

function weightText(c: PublicReport['comps'][number]) {
  if (c.excludedAsOutlier) return 'Outlier, not used';
  if (c.trimMatch === 'excluded') return 'Other trim, not used';
  return c.weightLabel;
}

function Comps({ report: r }: { report: PublicReport }) {
  const [all, setAll] = useState(false);
  const rows = all ? r.comps : r.comps.slice(0, ROWS_SHOWN);
  const s = r.compStats;
  const recorded = s.source === 'recorded_sales';
  const showAway = r.comps.some((c) => c.distance != null);
  const noun = recorded ? 'sales' : 'listings';
  const heading = s.summary.charAt(0).toUpperCase() + s.summary.slice(1);
  if (!r.comps.length) {
    return (
      <Section idx="02" title="Market evidence">
        <p className="lede" style={{ maxWidth: 720 }}>There are no recorded sales or listings of this model to compare with, so the estimate rests on the price model described below.</p>
      </Section>
    );
  }
  return (
    <Section idx="02" title={heading}>
      <div className="g2" style={{ alignItems: 'start', gap: 24 }}>
        <div className="sheet" style={{ padding: 20 }}>
          <CompsScatter comps={r.comps} subject={{ miles: r.mileage, value: r.private.value }} />
        </div>
        <div className="sheet" style={{ padding: '8px 8px 4px' }}>
          <div className="scroll-x" tabIndex={0} role="region" aria-label={`Comparable ${noun} table`}>
            <table className="tbl">
              <caption className="sr">{recorded ? 'Recorded sale prices' : 'Comparable listings, asking prices as listed'}</caption>
              <thead>
                <tr><th scope="col">Year</th><th scope="col">Trim</th><th scope="col" className="num">Miles</th>{showAway && <th scope="col" className="num">Away</th>}<th scope="col" className="num">{recorded ? 'Sale price' : 'Asking price'}</th><th scope="col">Weight</th></tr>
              </thead>
              <tbody>
                {rows.map((c, i) => {
                  const out = c.excludedAsOutlier || c.trimMatch === 'excluded';
                  return (
                    <tr key={i} style={out ? { color: 'var(--mid)' } : undefined}>
                      <td className="mono">{c.year}</td>
                      <td>{c.trim ?? '–'}</td>
                      <td className="num">{num(c.miles)}</td>
                      {showAway && <td className="num">{c.distance == null ? '–' : miles(c.distance)}</td>}
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
              <button type="button" className="btn-o no-print" style={{ minHeight: 44 }} onClick={() => setAll(!all)} aria-expanded={all}>
                {all ? `Show fewer ${noun}` : `Show all ${r.comps.length} ${noun}`}
              </button>
            )}
          </p>
        </div>
      </div>
    </Section>
  );
}

/** Engine notes that are raw model inputs (scores, multipliers, timestamps) rather than plain explanations. */
const TECHNICAL_NOTE = /score:|demand:|engineering:|status:|snapshot|correction:|\d\.\d{3,}|\d{4}-\d{2}-\d{2}T/i;

function Ladder({ report: r }: { report: PublicReport }) {
  const plain = r.methodNotes.filter((n) => !TECHNICAL_NOTE.test(n));
  const technical = r.methodNotes.filter((n) => TECHNICAL_NOTE.test(n));
  return (
    <Section idx="03" title="From the starting value to your car">
      <div className="g2" style={{ alignItems: 'start', gridTemplateColumns: '7fr 5fr' }}>
        <div>
          <Waterfall base={r.base} steps={r.adjustments} total={{ label: 'Private sale estimate', amount: r.private.value }} />
          <ul className="legend" aria-hidden="true">
            <li><span className="sw" style={{ background: 'var(--ink)' }} />Starting value</li>
            <li><span className="sw up" />Adds value</li>
            <li><span className="sw down" />Takes value away</li>
          </ul>
        </div>
        <aside className="sheet" style={{ padding: 28 }}>
          <h3 className="kicker">Method notes</h3>
          <ol style={{ fontSize: 15, lineHeight: 1.6, paddingLeft: 20, color: 'var(--ink)', margin: '14px 0 0' }}>
            {plain.map((n) => <li key={n} style={{ marginBottom: 6 }}>{n}</li>)}
          </ol>
          {technical.length > 0 && (
            <details className="tech">
              <summary>Model inputs</summary>
              <ul>{technical.map((n) => <li key={n}>{n}</li>)}</ul>
            </details>
          )}
          <p className="small" style={{ margin: '16px 0 0' }}>Valuation method version {r.methodVersion}</p>
        </aside>
      </div>
    </Section>
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
  if (!c.flags.includes('model_estimate')) checked.push(r.compStats.source === 'recorded_sales' ? `Prices from ${r.compStats.used} recorded sales in Washington State title records (trim not recorded).` : `Prices from ${r.compStats.used} live listings within ${r.compStats.radiusMiles} miles.`);

  const reported: string[] = [`Mileage, ${num(r.mileage)}`];
  if (c.trimConfirmedByUser && trim) reported.push(`Trim, ${trim}`);
  for (const k of c.selfReported) reported.push(adj.get(k) ?? SELF_LABEL[k] ?? k);

  const flags = c.flags.map((f) => FLAG_TEXT[f]).filter(Boolean) as string[];

  return (
    <Section idx="04" id="trust-h" title="How much to trust this number">
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
    </Section>
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
