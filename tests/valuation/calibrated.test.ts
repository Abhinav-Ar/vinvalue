import { describe,it,expect } from 'vitest';
import { loadReferences,exactName } from '@/models/reference';
import { valuationConfig as C } from '@/models/config/valuation';
import { evaluateSurface } from '@/models/valuation/surface';
import results from '../../scripts/reference/calibration/results.json';
describe('market calibration contracts',()=>{
 it('assigns every MSRP family and alias a canonical supported segment',()=>{
  for(const row of loadReferences().msrp)expect(['economy','midsize','fullsize','suv','truck','van','luxury','sports','ev']).toContain(C.familySegments[`${exactName(row.make)}/${exactName(row.model)}`]);
 });
 it('keeps model families exclusively in one near-equal partition',()=>{
  expect(Math.abs(results.counts.trainFamilies-results.counts.holdoutFamilies)).toBeLessThanOrEqual(1);
  expect(new Set(Object.values(results.split))).toEqual(new Set(['train','holdout']));
 });
 it('does not introduce appreciation for evidence-gated collectors',()=>{
  const d=loadReferences(),s={make:'PORSCHE',model:'911',year:2008,transmission:null};
  expect(evaluateSurface(s,'GT3',30000,new Date('2026-11-17'),d).R).toBeGreaterThanOrEqual(evaluateSurface(s,'GT3',30000,new Date('2030-11-17'),d).R);
 });
});
