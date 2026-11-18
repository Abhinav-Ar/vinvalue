import type { ReferenceData } from '@/models/reference';
import examples from './examples.json';
/** Synthetic arithmetic fixtures, not source-backed anchors or calibration labels. */
export function exampleReference(i = 4): ReferenceData {
  const e = examples[i]!;
  const E = e.D ? (i===1 ? .6 : 1) : 0, P = e.D ? (i===0 ? .6 : i===1 ? .2 : 1) : 0;
  const I = i===0 ? .3 : i===1 ? .15 : e.D ? 1 : 0;
  return {
    msrp:[{make:e.make,model:e.model,generation:'fixture',modelAliases:[],yearFrom:e.year,yearTo:e.year,trim:'Base',trimAliases:['Exact Alias'],tier:0,body:null,engine:null,transmission:e.D ? 'manual' : 'automatic',drive:null,msrpUsd:e.M,msrpModelYear:e.year,confidence:'documented',sourceUrl:'https://example.com/fixture',retrievedAt:'2026-01-01'}],
    generations:[{make:e.make,model:e.model,generation:'fixture',yearFrom:e.year,yearTo:e.year,segment:e.D ? 'sports' : 'midsize',E,I,H:i===2||i===3||i===6 ? 1 : 0,B:e.D ? 1 : 0,G:e.G as 0|1,basis:'Synthetic worked example only',sourceUrls:['https://example.com/fixture'],retrievedAt:'2026-01-01'}],
    variants:[{make:e.make,model:e.model,generation:'fixture',trim:'Base',P,manualPreferred:!!e.D,productionCount:i===3 ? 10000 : 30000,productionScope:'us',basis:'Synthetic worked example only',sourceUrls:['https://example.com/fixture'],retrievedAt:'2026-01-01'}],
    cpi:{series:'CUUR0000SA0',sourceUrl:'https://example.com/fixture',retrievedAt:'2026-01-01',rows:Array.from({length:77},(_,j)=>({year:1950+j,value:100}))},
  };
}
export { examples };
