import { reportCode } from '@/models/appraisals/service';
import type { DecodedSpecs } from '@/models/db/schema';

type VehicleLike = { id: string; specs: DecodedSpecs; trim: string | null; nickname: string | null; createdAt: Date };

/** "2019 Ford Mustang GT" */
export function vehicleLabel(v: Pick<VehicleLike, 'specs' | 'trim'>): string {
  const s = v.specs;
  return [s.year, s.make, s.model, v.trim].filter((x) => x !== null && x !== undefined && x !== '').join(' ');
}

/** Short name used in tables and calendar chips: nickname, else model ("Mustang"). */
export function vehicleShort(v: Pick<VehicleLike, 'specs' | 'nickname'>): string {
  return v.nickname || v.specs.model;
}

/** Legend label: nickname, else "Mustang GT". */
export function vehicleBadgeLabel(v: Pick<VehicleLike, 'specs' | 'trim' | 'nickname'>): string {
  return v.nickname || [v.specs.model, v.trim].filter(Boolean).join(' ');
}

export type Badge = { letter: string; label: string; short: string; index: number };

/**
 * Stable one-letter badges for a user's vehicles: ordered by createdAt, each takes the first
 * letter of its model (then nickname, then make) not already used. Mustang -> M, MX-5 -> X.
 */
export function badgesFor(list: VehicleLike[]): Map<string, Badge> {
  const sorted = [...list].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  const used = new Set<string>();
  const out = new Map<string, Badge>();
  sorted.forEach((v, index) => {
    const pool = `${v.specs.model}${v.nickname ?? ''}${v.specs.make}`.toUpperCase().replace(/[^A-Z]/g, '');
    let letter = [...pool].find((c) => !used.has(c));
    if (!letter) letter = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].find((c) => !used.has(c)) ?? String(index + 1);
    used.add(letter);
    out.set(v.id, { letter, label: vehicleBadgeLabel(v), short: vehicleShort(v), index });
  });
  return out;
}

/** Appraisal revision letter: the last character of valuation's reportCode() (0 -> "AQ-10A" -> "A"). */
export function revLetter(seq: number | null): string | null {
  if (seq === null || seq === undefined) return null;
  return reportCode(seq).slice(-1);
}
