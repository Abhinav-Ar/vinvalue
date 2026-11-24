/** Manual owner-run diagnostic only. No credentials or upstream body/URL are logged.
 * npx tsx --env-file=.env.local scripts/check-marketcheck-names.ts --offset=0
 * Repeat offsets 15,30,45 after reviewing quota. Every invocation is hard-capped at 15.
 * Uses sampler lease, monthly usage budget, reserve and account/rate stop rules.
 */
import { getDb } from '../models/db';
import { loadReferences } from '../models/reference';
import { rankedSamplingFamilies,marketcheckName } from '../models/config/marketSampling';
import { runMarketSampler } from '../models/jobs/marketSampler';
const url=process.env.DATABASE_URL??'';
if(!url.startsWith('pglite:')||process.env.NODE_ENV==='production')throw new Error('Explicit local PGlite database required');
const offset=Number(process.argv.find(a=>a.startsWith('--offset='))?.split('=')[1]??0);
if(!Number.isInteger(offset)||offset<0||offset>=60)throw new Error('Offset must be 0..59');
const data=loadReferences();
const plan=rankedSamplingFamilies(data).slice(0,60).slice(offset,offset+15).map(f=>({
  make:f.make,model:f.model,yearFrom:1900,yearTo:new Date().getUTCFullYear(),zip:'90012',radiusMiles:100,segment:'diagnostic'
}));
let attempts=0;
try {
  const report=await runMarketSampler(getDb(),{namesOnly:true,maxCalls:15,plan,
    fetchImpl:async(...args)=>{if(attempts>=15)throw new Error('Hard call cap');attempts++;return fetch(...args);},
    onNameResult:(q,numFound)=>console.log(JSON.stringify({family:q.make+'/'+q.model,...marketcheckName(q.make,q.model),num_found:numFound}))});
  console.log(JSON.stringify(report));process.exit(0);
} catch {console.error('Name check failed; inspect local usage state. No transport details logged.');process.exit(1);}
