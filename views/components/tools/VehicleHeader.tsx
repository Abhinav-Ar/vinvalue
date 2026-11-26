'use client';
/**
 * Header shared by the Value tracker and Sell or trade pages: back link, title, specs line,
 * car art and the vehicle section tabs (design/Value, design/Sell).
 */
import Link from 'next/link';
import { CarDrawing, type CarVariant } from '@/views/components/CarDrawing';
import { carVariant as bodyVariant } from '@/views/components/vehicleBody';
import { VehiclePhoto } from '@/views/components/VehiclePhoto';
import { Skeleton } from '@/views/components/ui';
import { VehicleTabs } from '@/views/components/garage/shared';
import styles from '../garage/garage.module.css';
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

/** The line drawing for this car (see views/components/vehicleBody.ts). */
export function carVariant(v: Pick<VehicleDetail, 'specs'> | null): CarVariant {
  return v ? bodyVariant(v.specs.make, v.specs.model, v.specs.body) : 'gt';
}

export function specsLine(v: VehicleDetail) {
  const parts = [v.specs.body, v.specs.drive ? (DRIVE[v.specs.drive.toUpperCase()] ?? v.specs.drive) : null, v.specs.engine].filter(Boolean);
  const head = parts.length ? parts.join(', ') + '. ' : '';
  return `${head}${num(v.odometer)} miles, ZIP ${v.zip}.`;
}

export function VehicleHeader({ vehicle, vehicleId, section }: { vehicle: VehicleDetail | null; vehicleId: string; section: 'value' | 'sell' }) {
  return (
    <>
      <header className={`g2 ${styles.columns} ${styles.hero}`}>
        <div className={styles.group}>
          <Link href="/garage" className={`small ${styles.back}`}>← Garage</Link>
          {vehicle ? (
            <>
              <h1 className="title">{vehicle.label}</h1>
              <p className="small">
                {specsLine(vehicle)} VIN <span className="vin">{vehicle.vin}</span>
              </p>
            </>
          ) : (
            <>
              <Skeleton w="70%" h={40} />
              <Skeleton w="90%" h={16} />
            </>
          )}
        </div>
        <div className={styles.art}>
          {vehicle ? (
            <VehiclePhoto
              car={{ year: vehicle.specs.year, make: vehicle.specs.make, model: vehicle.specs.model, trim: vehicle.trim }}
              fallback={
                <CarDrawing
                  variant={carVariant(vehicle)}
                  label={`${vehicle.label}, line drawing (no photo found)`}
                  ink={false}
                />
              }
            />
          ) : <CarDrawing variant={carVariant(vehicle)} animate={false} />}
        </div>
      </header>
      <VehicleTabs id={vehicleId} on={section} />
    </>
  );
}
