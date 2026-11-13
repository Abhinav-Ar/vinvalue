import { CarDrawing, type Callout } from '@/components/CarDrawing';
import styles from './landing.module.css';

/** Box ratio matches the drawing's viewBox (1000 x 400). A 3D canvas can replace the SVG in the same box. */
export const HERO_ASPECT = '1000 / 400';

const CALLOUTS: Callout[] = [
  { x: 84, y: 262, label: 'condition', lx: 0, ly: 150 },
  { x: 250, y: 174, label: 'powertrain, from NHTSA', lx: 140, ly: 46 },
  { x: 560, y: 104, label: 'trim + options', lx: 470, ly: 26 },
  { x: 784, y: 226, label: 'mileage + tires', lx: 790, ly: 60 },
];

const dim = { stroke: 'currentColor', strokeWidth: 0.9, fill: 'none' } as const;

/** Hero car: draws itself in once (final state under reduced motion), with dimensions and notes. */
export function HeroCar() {
  return (
    <div className={styles.carBox} style={{ aspectRatio: HERO_ASPECT }}>
      <CarDrawing variant="gt" animate viewBox="0 10 1000 400" label="Line drawing of the AIQ-01 concept coupe" callouts={CALLOUTS}>
        <g className="f" style={{ animationDelay: '1.8s' }} {...dim}>
          <path d="M233 312 L233 374 M743 312 L743 374" strokeDasharray="3 3" />
          <path d="M233 366 L743 366 M242 362 L233 366 L242 370 M734 362 L743 366 L734 370" />
        </g>
        <text className="f dimt" style={{ animationDelay: '1.8s' }} x={488} y={359} textAnchor="middle" fontSize={12} fill="currentColor">Wheelbase 100.4 in</text>
        <g className="f" style={{ animationDelay: '2s' }} {...dim}>
          <path d="M62 312 L62 404 M938 312 L938 404" strokeDasharray="3 3" />
          <path d="M62 396 L938 396 M71 392 L62 396 L71 400 M929 392 L938 396 L929 400" />
        </g>
        <text className="f dimt" style={{ animationDelay: '2s' }} x={500} y={389} textAnchor="middle" fontSize={12} fill="currentColor">Overall length 172.0 in</text>
        <g className="f" style={{ animationDelay: '2.1s' }} {...dim}>
          <path d="M660 74 L984 74 M944 330 L984 330" strokeDasharray="3 3" />
          <path d="M974 74 L974 330 M970 83 L974 74 L978 83 M970 321 L974 330 L978 321" />
        </g>
        <text className="f dimt" style={{ animationDelay: '2.1s' }} transform="translate(992 202) rotate(-90)" textAnchor="middle" fontSize={12} fill="currentColor">Height 51.2 in</text>
      </CarDrawing>
    </div>
  );
}
