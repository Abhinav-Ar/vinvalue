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
import rs from './report.module.css';

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
        <div>
          <EmptyState
            text="This link is wrong, or the report expired."
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
        <ErrorNote error={error} onRetry={reload} />
      </section>
    );
  }

  const signedIn = !!me.data?.signedIn;

  const model = !!r.confidence?.flags.includes('model_estimate');
  const recorded = r.compStats.source === 'recorded_sales';
  const drawing = <CarDrawing variant={carVariant(r.vehicle.make, r.vehicle.model, r.vehicle.body)} label={`Line drawing of a ${r.vehicle.label}`} />;

  return (
    <>
      <Stepper step={3} />
      <section className={`wrap ${rs.page}`}>
        <div className="head">
          <p className="kicker">Report · {longDate(r.date)}</p>
          <h1 className="title">{r.vehicle.label}</h1>
          <p className="small" style={{ margin: 0 }}><span className="vin">{r.vin}</span> · {num(r.mileage)} mi · ZIP {r.zip}</p>
          <SaveNote report={r} signedIn={signedIn} meLoading={me.loading} />
        </div>

        <div className={rs.hero}>
          <div className="stack">
            <div className="row">
              <h2 className="kicker accent">Private sale estimate</h2>
              <span className={`tag${model ? '' : ' on'}`}><i />{model ? 'Model estimate' : recorded ? `${r.compStats.used} recorded sales` : `${r.compStats.used} listings`}</span>
            </div>
            <p className="figure">{usd(r.private.value)}</p>
            <div style={{ maxWidth: 520, marginTop: 'var(--s3)' }}>
              <RangeBar low={r.private.low} high={r.private.high} value={r.private.value} label={`Likely range ${usd(r.private.low)} to ${usd(r.private.high)}, estimate ${usd(r.private.value)}`} />
            </div>
            <p className="small" style={{ margin: 0, maxWidth: 480 }}>
              {model
                ? 'No local sales of this model. Estimated from MSRP, age, mileage and demand, so the range is wider.'
                : recorded
                  ? 'Range from recorded sales of this model.'
                  : 'Range from comparable listings near you.'}
            </p>
            <div className="no-print"><Actions report={r} signedIn={signedIn} onClaimed={(c) => setData(c)} /></div>
          </div>
          <div className={rs.art}><VehiclePhoto car={r.vehicle} fallback={drawing} /></div>
        </div>

        <Section idx="01" title="How you sell sets the price">
          <RouteDiagram instant={r.instant.value} private={r.private.value} retail={r.retail.value} low={r.private.low} high={r.private.high} />
        </Section>

        <Comps report={r} />
        <Ladder report={r} />
        <ConfidenceBlock report={r} />
      </section>
    </>
  );
}

function Section({ idx, title, id, children }: { idx: string; title: string; id?: string; children: ReactNode }) {
  const hid = id ?? `sec-${idx}`;
  return (
    <section className={rs.sec} aria-labelledby={hid}>
      <h2 id={hid} className="h3">{title}</h2>
      <div className={rs.body}>{children}</div>
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
    <div className="stack" style={{ gap: 'var(--s2)', marginTop: 'var(--s4)' }}>
      <div className="row">
        {signedIn && !r.saved && (
          <button type="button" className="btn" onClick={claim} disabled={claiming}>{claiming ? 'Saving…' : 'Save to garage'}</button>
        )}
        <button type="button" className="btn-o" onClick={share}>Copy link</button>
        <button type="button" className="textbtn" onClick={() => window.print()}>Print or PDF</button>
      </div>
      <p className="small" role="status" style={{ margin: 0, minHeight: 21, overflowWrap: 'anywhere' }}>{copied}</p>
      {claimErr && <div style={{ alignSelf: 'stretch' }}><ErrorNote error={claimErr} onRetry={claimErr.status === 409 ? undefined : claim} /></div>}
    </div>
  );
}

function SaveNote({ report: r, signedIn, meLoading }: { report: PublicReport; signedIn: boolean; meLoading: boolean }) {
  if (r.saved) {
    return r.code ? <p className="small" style={{ margin: 0 }}>Saved as report {r.code}.</p> : null;
  }
  if (meLoading) return null;
  const expires = r.expiresOn ? ` Expires ${longDate(r.expiresOn)}.` : '';
  return (
    <p className="small" style={{ margin: 0 }}>
      Not saved.{expires}
      {!signedIn && <> <Link href={`/sign-in?next=${encodeURIComponent(`/report/${r.slug}`)}`}>Sign in to save it</Link>.</>}
    </p>
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
        <p className="lede">No sales or listings of this model to compare, so the price model sets the value.</p>
      </Section>
    );
  }
  return (
    <Section idx="02" title={heading}>
      <div className="g2" style={{ alignItems: 'start' }}>
        <div>
          <CompsScatter comps={r.comps} subject={{ miles: r.mileage, value: r.private.value }} />
        </div>
        <div>
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
          <p className="small row" style={{ margin: 'var(--s2) 0 0' }}>
            {rows.length} of {r.comps.length}
            {r.comps.length > ROWS_SHOWN && (
              <button type="button" className="textbtn no-print" onClick={() => setAll(!all)} aria-expanded={all}>
                {all ? 'Show fewer' : `Show all ${r.comps.length} ${noun}`}
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
    <Section idx="03" title="The math">
      <div className="g2" style={{ alignItems: 'start', gridTemplateColumns: '7fr 5fr' }}>
        <div>
          <Waterfall base={r.base} steps={r.adjustments} total={{ label: 'Private sale estimate', amount: r.private.value }} />
          <ul className="legend" aria-hidden="true">
            <li><span className="sw" />Starting value</li>
            <li><span className="sw up" />Adds value</li>
            <li><span className="sw down" />Takes value away</li>
          </ul>
        </div>
        <aside>
          <h3 className="kicker">Method notes</h3>
          <ol className={rs.notes}>
            {plain.map((n) => <li key={n}>{n}</li>)}
          </ol>
          {technical.length > 0 && (
            <details className="tech">
              <summary>Model inputs</summary>
              <ul>{technical.map((n) => <li key={n}>{n}</li>)}</ul>
            </details>
          )}
          <p className="small" style={{ margin: 'var(--s4) 0 0' }}>Method {r.methodVersion}</p>
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
    <Section idx="04" id="trust-h" title="How sure we are">
      {flags.length > 0 && (
        <div className="notice" style={{ marginBottom: 'var(--s6)' }}>
          {flags.map((f) => <p key={f} style={{ margin: 0 }}>{f}</p>)}
        </div>
      )}
      <div className="g3" style={{ alignItems: 'start' }}>
        <TrustList title="Checked" items={checked} />
        <TrustList title="You told us" items={reported} />
        {c.rangeReasons.length > 0 && (
          <TrustList title={`Why ${usd(r.private.low)} to ${usd(r.private.high)}`} items={c.rangeReasons} />
        )}
      </div>
    </Section>
  );
}

function TrustList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="kicker">{title}</h3>
      <ul className={rs.list}>
        {items.map((t) => <li key={t}>{t}</li>)}
      </ul>
    </div>
  );
}

function ReportSkeleton() {
  return (
    <>
      <Stepper step={3} />
      <section className={`wrap ${rs.page}`} aria-busy="true">
        <Skeleton w="50%" h={48} />
        <div className={rs.hero} style={{ marginTop: 'var(--s7)' }}>
          <div className="stack"><Skeleton w={160} h={14} /><Skeleton w="70%" h={84} /><Skeleton h={10} /></div>
          <Skeleton h={240} />
        </div>
      </section>
    </>
  );
}
