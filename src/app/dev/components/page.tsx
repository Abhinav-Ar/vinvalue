'use client';
import { notFound } from 'next/navigation';
import { useState } from 'react';
import { Card, EmptyState, ErrorNote, Field, PageTitle, SegmentedControl, Select, Skeleton, Stepper } from '@/components/ui';
import { VinInput } from '@/components/VinInput';
import { RangeBar } from '@/components/RangeBar';
import { CarDrawing } from '@/components/CarDrawing';
import { ApiError } from '@/lib/client/api';

/** Development-only gallery of shared components. */
export default function ComponentsPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  const [vin, setVin] = useState('');
  const [cond, setCond] = useState<'fair' | 'good' | 'excellent'>('good');
  const [state, setState] = useState('CA');
  const [zip, setZip] = useState('');
  const Section = ({ name, children }: { name: string; children: React.ReactNode }) => (
    <section style={{ borderTop: '1px solid var(--line)', padding: '32px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>{name}</h2>
      {children}
    </section>
  );
  return (
    <>
      <Stepper step={2} />
      <div className="wrap page" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <PageTitle sub="Every shared component in both themes. Use the theme toggle in the nav.">Components</PageTitle>
        <Section name="Buttons">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button className="btn">Find my value</button>
            <button className="btn-o">Add to calendar</button>
            <button className="btn" disabled>Disabled</button>
          </div>
        </Section>
        <Section name="VinInput">
          <VinInput value={vin} onChange={setVin} onSample={() => {}} />
          <VinInput id="vin2" value="1FA6P8CF0K5123456" onChange={() => {}} errors={['Check character 9 should be 9, not 0. Check the VIN on your registration.']} />
        </Section>
        <Section name="Field, Select, SegmentedControl">
          <div className="g2">
            <Field label="ZIP code" errors={zip.length && zip.length < 5 ? ['Enter a 5-digit ZIP code.'] : undefined}>
              {({ id, describedBy, invalid }) => (
                <input id={id} className="inp" inputMode="numeric" value={zip} onChange={(e) => setZip(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid || undefined} />
              )}
            </Field>
            <Field label="State">
              {({ id }) => <Select id={id} value={state} onChange={setState} options={[{ value: 'CA', label: 'California' }, { value: 'IL', label: 'Illinois' }]} />}
            </Field>
          </div>
          <SegmentedControl label="Condition" value={cond} onChange={setCond} options={[{ value: 'fair', label: 'Fair' }, { value: 'good', label: 'Good' }, { value: 'excellent', label: 'Excellent' }]} />
        </Section>
        <Section name="Card and RangeBar">
          <div className="g2">
            <Card style={{ padding: 24 }}><p style={{ margin: 0 }}>Plain card</p></Card>
            <Card frame style={{ padding: 24 }}><RangeBar low={25330} high={29570} value={27450} /></Card>
          </div>
        </Section>
        <Section name="CarDrawing">
          <div className="g3">
            <CarDrawing variant="gt" label="GT coupe" />
            <CarDrawing variant="muscle" label="Muscle car" />
            <CarDrawing variant="roadster" label="Roadster" />
          </div>
        </Section>
        <Section name="States">
          <div className="g3">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><Skeleton h={36} w="60%" /><Skeleton /><Skeleton w="80%" /></div>
            <EmptyState text="No cars in your garage yet." action={<a className="btn" href="/appraise">Add a car</a>} />
            <ErrorNote error={new ApiError(502, 'upstream_failed', "The listing service didn't respond. Try again in a minute.")} onRetry={() => {}} />
          </div>
        </Section>
      </div>
    </>
  );
}
