'use client';
/**
 * Header shared by the Value tracker and Sell or trade pages: back link, title, specs line,
 * car art and the vehicle section tabs (design/Value, design/Sell).
 */
import Link from 'next/link';
import { CarDrawing, type CarVariant } from '@/views/components/CarDrawing';
import { VehiclePhoto } from '@/views/components/VehiclePhoto';
import { Skeleton } from '@/views/components/ui';
import { VehicleTabs } from '@/views/components/garage/shared';
import { num } from '@/views/components/client/format';

export type VehicleDetail = {
  id: string;
  label: string;
  nickname: string | null;
  vin: string;
  specs: { year: number; make: string; model: string; body: string | null; drive: string | null; engine: string | null; fuel: string | null };
  trim: string | null;
  modelKey: string;
  zip: string;
  odometer: number;
  privateValue: number | null;
};

const DRIVE: Record<string, string> = {
  RWD: 'rear-wheel drive',
  FWD: 'front-wheel drive',
  AWD: 'all-wheel drive',
  '4WD': 'four-wheel drive',
};

/** Picks the line drawing: American V8 coupes get the muscle body, roadsters the roadster, the rest the GT. */
export function carVariant(v: Pick<VehicleDetail, 'specs'> | null): CarVariant {
  if (!v) return 'gt';
  const make = v.specs.make.toLowerCase();
  const body = (v.specs.body ?? '').toLowerCase();
  const model = v.specs.model.toLowerCase();
  if (/convertible|roadster|cabrio/.test(body) || /mx-5|miata|boxster|z4|s2000/.test(model)) return 'roadster';
  if (['ford', 'chevrolet', 'dodge'].includes(make)) return 'muscle';
  return 'gt';
}

export function specsLine(v: VehicleDetail) {
  const parts = [v.specs.body, v.specs.drive ? (DRIVE[v.specs.drive.toUpperCase()] ?? v.specs.drive) : null, v.specs.engine].filter(Boolean);
  const head = parts.length ? parts.join(', ') + '. ' : '';
  return `${head}${num(v.odometer)} miles, ZIP ${v.zip}.`;
}

export function VehicleHeader({ vehicle, vehicleId, section }: { vehicle: VehicleDetail | null; vehicleId: string; section: 'value' | 'sell' }) {
  return (
    <>
      <div className="g2" style={{ gridTemplateColumns: 'minmax(0,7fr) minmax(0,5fr)', gap: 40, alignItems: 'end' }}>
        <div>
          <Link href="/garage" className="small" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', minHeight: 44 }}>
            &#8592; Garage
          </Link>
          {vehicle ? (
            <>
              <h1 className="title" style={{ marginTop: 8 }}>{vehicle.label}</h1>
              <p className="small" style={{ margin: '12px 0 0' }}>
                {specsLine(vehicle)} VIN <span className="vin">{vehicle.vin}</span>
              </p>
            </>
          ) : (
            <>
              <Skeleton w="70%" h={40} style={{ marginTop: 8 }} />
              <Skeleton w="90%" h={16} style={{ marginTop: 14 }} />
            </>
          )}
        </div>
        <div>{vehicle ? <VehiclePhoto car={{ year: vehicle.specs.year, make: vehicle.specs.make, model: vehicle.specs.model, trim: vehicle.trim }} /> : <CarDrawing variant={carVariant(vehicle)} animate={false} />}</div>
      </div>
      <VehicleTabs id={vehicleId} on={section} />
    </>
  );
}
