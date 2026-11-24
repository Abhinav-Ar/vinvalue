import { createHash, randomUUID } from 'node:crypto';
import { and, eq, lt, sql } from 'drizzle-orm';
import type { Db } from '@/models/db';
import { marketSamples as samples, marketSampleUsage as usage } from '@/models/db/schema';
import { buildParams, mapListing } from '@/models/providers/marketcheck';
import { loadReferences } from '@/models/reference';
import { buildSamplingPlan, marketSampling as C, type SampleQuery, marketcheckName } from '@/models/config/marketSampling';
const forbidden = /quota|payment|subscription|retired[\s_-]*(?:api[\s_-]*)?key/i;
const headerInt=(v:string|null)=>v!==null&&/^\d+$/.test(v)?Number(v):null;
export function samplerParams(q:SampleQuery,key:string,rows=50) {
  return buildParams({...q, ...marketcheckName(q.make,q.model), radiusMiles:Math.max(1,Math.min(100,q.radiusMiles||100)), maxResults:50, trim:q.trim??null},0,rows,key);
}
/** Lease serializes all consumers. Reserve BEFORE every attempt; crashes conservatively spend that call.
 * A crashed request may repeat after lease expiry, but monthly listing dedup makes writes idempotent. */
export async function runMarketSampler(db:Db, options:{apiKey?:string; now?:Date; fetchImpl?:typeof fetch; budget?:number; maxCalls?:number; runMs?:number; plan?:SampleQuery[]; namesOnly?:boolean; onNameResult?:(q:SampleQuery,numFound:number)=>void; pause?:(ms:number)=>Promise<void>}={}) {
  const key=options.apiKey??process.env.MARKETCHECK_API_KEY;
  if(!key) return {reason:'missing-key',calls:0,inserted:0};
  const now=options.now??new Date(),month=now.toISOString().slice(0,7),token=randomUUID();
  const budget=Math.max(0,Math.min(450,Math.floor(options.budget??C.monthlyCalls)));
  const plan=options.plan??buildSamplingPlan(loadReferences(),month,budget);
  const deadline=Date.now()+Math.min(options.runMs??C.runMs,45000);
  const pause=options.pause??(ms=>new Promise(r=>setTimeout(r,ms)));
  await db.insert(usage).values({month}).onConflictDoNothing();
  const [lease]=await db.update(usage).set({leaseToken:token,leaseUntil:new Date(Date.now()+70000)}).where(and(eq(usage.month,month),sql`(${usage.leaseUntil} is null or ${usage.leaseUntil} < now())`)).returning();
  if(!lease) return {reason:'busy',calls:0,inserted:0};
  let calls=0,inserted=0,reason='time-limit';
  const owned=and(eq(usage.month,month),eq(usage.leaseToken,token));
  const stop=async (why:string)=>{reason=why;await db.update(usage).set({stopped:why}).where(owned);};
  try {
    if(lease.stopped) return {reason:lease.stopped,calls,inserted};
    if(lease.rateRemaining===0) {
      const raw=lease.rateReset??'';
      const reset=/^\d+$/.test(raw)?Number(raw)*(Number(raw)<1e12?1000:1):Date.parse(raw);
      if(!Number.isFinite(reset)||reset>Date.now()) return {reason:'rate-limit',calls,inserted};
    }
    let cursor=options.namesOnly?0:lease.cursor;
    const maxCalls=options.namesOnly?Math.min(15,options.maxCalls??15):Math.min(options.maxCalls??C.maxCallsPerRun,35);
    while(Date.now()+8500<deadline&&calls<maxCalls) {
      const q=plan[cursor];if(!q){reason='complete';break;}
      let completed=false;
      for(let attempt=0;attempt<(options.namesOnly?1:3);attempt++) {
        if(Date.now()+8500>=deadline || calls>=maxCalls) break;
        const reserved=await db.update(usage).set({calls:sql`${usage.calls}+1`}).where(and(owned,lt(usage.calls,budget))).returning();
        if(!reserved.length){reason='budget';return {reason,calls,inserted};}
        calls++;
        let res:Response,body:string;
        try {
          res=await (options.fetchImpl??fetch)(`https://api.marketcheck.com/v2/search/car/active?${samplerParams(q,key,options.namesOnly?1:50)}`,{signal:AbortSignal.timeout(7000)});
        } catch { if(attempt===2||options.namesOnly){reason='network';return {reason,calls,inserted};} await pause(1000);continue; }
        const quota=headerInt(res.headers.get('quota-remaining')),rate=headerInt(res.headers.get('ratelimit-remaining')),reset=res.headers.get('ratelimit-reset-time');
        await db.update(usage).set({quotaRemaining:quota,rateRemaining:rate,rateReset:reset}).where(owned);
        // Status and low quota stop even if the body cannot be read.
        if([401,402,403,429].includes(res.status)||quota!==null&&quota<=50){await stop(quota!==null&&quota<=50?'quota-reserve':`http-${res.status}`);return {reason,calls,inserted};}
        try {body=await res.text();} catch {if(attempt===2||options.namesOnly){reason='network';return {reason,calls,inserted};}await pause(1000);continue;}
        if(rate===0){reason='rate-limit';return {reason,calls,inserted};}
        // Account/quota wording only matters on error responses: listing text can say e.g. "SiriusXM subscription".
        if(res.status>=500&&forbidden.test(body)){await stop('account-body');return {reason,calls,inserted};}
        if(res.status>=500) {if(attempt===2||options.namesOnly){reason='upstream';return {reason,calls,inserted};}await pause(1000);continue;}
        if(!res.ok){await stop(forbidden.test(body)?'account-body':`http-${res.status}`);return {reason,calls,inserted};}
        let payload;try{payload=JSON.parse(body);}catch{await stop('malformed');return {reason,calls,inserted};}
        if(!Array.isArray(payload.listings)){await stop('malformed');return {reason,calls,inserted};}
        if(options.namesOnly) {
          options.onNameResult?.(q,Number(payload.num_found)||0);
          cursor++;completed=true;await pause(250);break;
        }
        // One batch insert per call instead of one insert per listing.
        const rows=new Map<string,typeof samples.$inferInsert>();
        for(const raw of payload.listings) {
          const l=mapListing(raw);const identity=l?.vin||l?.id;
          if(!l||!identity||l.sellerType!=='dealer'||l.inventoryType!=='used') continue;
          const listingHash=createHash('sha256').update(identity).digest('hex');
          rows.set(listingHash,{source:'marketcheck',make:l.make,model:l.model,year:l.year,trim:l.trim,miles:l.miles,price:l.price,sellerType:l.sellerType,inventoryType:l.inventoryType,daysOnMarket:l.daysOnMarket==null?null:Math.round(l.daysOnMarket),zip:q.zip,radius:Math.max(1,Math.min(100,q.radiusMiles||100)),sampleMonth:month,fetchedAt:now,listingHash});
        }
        if(rows.size){const saved=await db.insert(samples).values([...rows.values()]).onConflictDoNothing().returning({id:samples.id});inserted+=saved.length;}
        cursor++;await db.update(usage).set({cursor}).where(owned);completed=true;
        if(rate===0){reason='rate-limit';return {reason,calls,inserted};}
        await pause(250);break;
      }
      if(!completed) break;
    }
    return {reason,calls,inserted};
  } finally {await db.update(usage).set({leaseToken:null,leaseUntil:null}).where(owned);}
}
