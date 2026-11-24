import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from './helpers/db';
import type { Db } from '@/models/db';
import { marketSamples, marketSampleUsage } from '@/models/db/schema';
import { runMarketSampler, samplerParams } from '@/models/jobs/marketSampler';
import { buildSamplingPlan, marketSampling, rankedSamplingFamilies } from '@/models/config/marketSampling';
import { loadReferences } from '@/models/reference';
import { joinMarketSamples, proposeWithMarket } from '@/models/valuation/marketCalibration';
import { getProviders, setProviders } from '@/models/providers';
import { MarketCheckListings } from '@/models/providers/marketcheck';
let db:Db;
const q={make:'Ford',model:'Mustang',yearFrom:2019,yearTo:2019,zip:'60601',radiusMiles:900,segment:'performance'};
const listing={id:'fixture-listing',vin:'1FA6P8CF0K5000000',price:25000,miles:45000,seller_type:'dealer',inventory_type:'used',build:{make:'Ford',model:'Mustang',year:2019,trim:'GT'}};
const ok=()=>new Response(JSON.stringify({listings:[listing,listing]}),{headers:{'quota-remaining':'200','ratelimit-remaining':'4','ratelimit-reset-time':'12345'}});
const opts={apiKey:'fixture-only',now:new Date('2026-11-03Z'),pause:async()=>{},plan:[q,q,q,q],maxCalls:1};
beforeAll(async()=>{db=await createTestDb();});
afterEach(async()=>{vi.unstubAllEnvs();setProviders(null);await db.delete(marketSamples);await db.delete(marketSampleUsage);});
describe('monthly sampler (fixture transport only)',()=>{
  it('shares budget across invocations, dedups and stores only hashed identities',async()=>{
    const f=vi.fn(async()=>ok());
    await runMarketSampler(db,{...opts,budget:2,fetchImpl:f});
    await runMarketSampler(db,{...opts,budget:2,fetchImpl:f});
    const last=await runMarketSampler(db,{...opts,budget:2,fetchImpl:f});
    expect(f).toHaveBeenCalledTimes(2);expect(last.reason).toBe('budget');
    const rows=await db.select().from(marketSamples);expect(rows).toHaveLength(1);expect(rows[0]!.listingHash).toMatch(/^[a-f0-9]{64}$/);expect(JSON.stringify(rows)).not.toContain(listing.vin);expect(rows[0]!.radius).toBe(100);
    expect((await db.select().from(marketSampleUsage))[0]!.calls).toBe(2);
  });
  it.each([401,402,403,429])('stops persistently without retry on %i',async status=>{
    const f=vi.fn(async()=>new Response('{}',{status}));
    await runMarketSampler(db,{...opts,maxCalls:5,fetchImpl:f});
    await runMarketSampler(db,{...opts,maxCalls:5,fetchImpl:f});expect(f).toHaveBeenCalledTimes(1);
  });
  it.each(['quota exceeded','payment required','subscription expired','retired API keys'])('stops on account body: %s',async body=>{
    const f=vi.fn(async()=>new Response(body,{status:503}));
    await runMarketSampler(db,{...opts,maxCalls:5,fetchImpl:f});expect(f).toHaveBeenCalledTimes(1);
  });
  it('does not stop when a successful listing mentions a subscription',async()=>{
    const withText={...listing,heading:'Includes SiriusXM subscription and payment options'};
    const f=vi.fn(async()=>new Response(JSON.stringify({listings:[withText]}),{headers:{'quota-remaining':'200','ratelimit-remaining':'4','ratelimit-reset-time':'12345'}}));
    await runMarketSampler(db,{...opts,maxCalls:2,fetchImpl:f});expect(f).toHaveBeenCalledTimes(2);
  });
  it('stops at reserve and records all quota headers',async()=>{
    const f=vi.fn(async()=>new Response('{}',{headers:{'quota-remaining':'50','ratelimit-remaining':'3','ratelimit-reset-time':'12345'}}));
    await runMarketSampler(db,{...opts,fetchImpl:f});await runMarketSampler(db,{...opts,fetchImpl:f});
    expect(f).toHaveBeenCalledTimes(1);const [u]=await db.select().from(marketSampleUsage);expect(u).toMatchObject({quotaRemaining:50,rateRemaining:3,rateReset:'12345',stopped:'quota-reserve'});
  });
  it('retries 5xx twice and counts each attempt',async()=>{
    const f=vi.fn(async()=>new Response('{}',{status:503}));await runMarketSampler(db,{...opts,maxCalls:5,fetchImpl:f});expect(f).toHaveBeenCalledTimes(3);expect((await db.select().from(marketSampleUsage))[0]!.calls).toBe(3);
  });
  it('retries only network failures and never beyond the budget',async()=>{
    const f=vi.fn(async()=>{throw new Error('fixture network');});await runMarketSampler(db,{...opts,maxCalls:5,budget:2,fetchImpl:f});expect(f).toHaveBeenCalledTimes(2);
  });
  it('serializes concurrent runs',async()=>{
    const f=vi.fn(async()=>ok());const reports=await Promise.all([runMarketSampler(db,{...opts,fetchImpl:f}),runMarketSampler(db,{...opts,fetchImpl:f})]);expect(reports.some(r=>r.reason==='busy')).toBe(true);expect(f).toHaveBeenCalledTimes(1);
  });
  it('clamps radius, uses 50 rows and resets budget in a new month',async()=>{
    expect(samplerParams(q,'fixture-only').get('radius')).toBe('100');expect(samplerParams(q,'fixture-only').get('rows')).toBe('50');
    const f=vi.fn(async()=>ok());await runMarketSampler(db,{...opts,budget:1,fetchImpl:f});await runMarketSampler(db,{...opts,now:new Date('2026-12-03Z'),budget:1,fetchImpl:f});expect(f).toHaveBeenCalledTimes(2);
  });
  it('only plans anchored years and rotates metros with weighted controls',()=>{
    const data=loadReferences(),plan=buildSamplingPlan(data,'2026-11');expect(plan).toHaveLength(450);
    expect(plan.filter(p=>p.segment==='control').length).toBeGreaterThanOrEqual(66);
    expect(new Set(plan.map(p=>p.zip)).size).toBe(8);
    for(const p of plan)expect(data.msrp.some(r=>r.make===p.make&&r.model===p.model&&p.yearFrom>=r.yearFrom&&p.yearTo<=r.yearTo)).toBe(true);
    expect(buildSamplingPlan(data,'2026-12')).not.toEqual(plan);
  });
  it('covers the top 30 every month, limits the long tail, and maps exact provider names',()=>{
    const data=loadReferences(),ranked=rankedSamplingFamilies(data),key=(f:{make:string;model:string})=>f.make+'/'+f.model;
    for(let m=1;m<=12;m++) {
      const plan=buildSamplingPlan(data,`2026-${String(m).padStart(2,'0')}`),top=new Set(ranked.slice(0,60).map(key));
      for(const f of ranked.slice(0,30))expect(plan.some(q=>key(q)===key(f))).toBe(true);
      expect(plan.filter(q=>!top.has(key(q))).length).toBeLessThanOrEqual(67);
    }
    expect(samplerParams({...q,make:'RAM',model:'2500'},'fixture').get('model')).toBe('2500');
    expect(samplerParams({...q,make:'JEEP',model:'Wrangler'},'fixture').get('model')).toBe('wrangler,wrangler unlimited');
  });
  it('caps name diagnostics at 15 shared-budget calls without advancing sampling or storing rows',async()=>{
    const f=vi.fn(async(_url:RequestInfo|URL,_init?:RequestInit)=>ok());
    await runMarketSampler(db,{...opts,namesOnly:true,maxCalls:100,plan:Array(25).fill(q),fetchImpl:f});
    expect(f).toHaveBeenCalledTimes(15);
    expect(new URL(f.mock.calls[0]?.[0] as unknown as string).searchParams.get('rows')).toBe('1');
    expect((await db.select().from(marketSampleUsage))[0]!.cursor).toBe(0);
    expect((await db.select().from(marketSampleUsage))[0]!.calls).toBe(15);
    expect(await db.select().from(marketSamples)).toHaveLength(0);
  });
  it('drops unmatched/ambiguous trims rather than inferring a base trim',()=>{
    const data=loadReferences(),a=data.msrp[0]!;
    const sample={listingHash:'hash',make:a.make,model:a.model,year:a.msrpModelYear,trim:'not a trim',miles:50000,price:20000,fetchedAt:'2026-11-03'};
    expect(joinMarketSamples([sample],data)).toMatchObject({matched:0,unmatched:1,matchRate:0});
    const joined=joinMarketSamples([{...sample,trim:a.trim}],data);expect(joined.matched).toBe(1);expect(joined.rows[0]!.soldPrice).toBe(18000);
    const result=proposeWithMarket(joined.rows,data);expect(result.counts.trainFamilies+result.counts.holdoutFamilies).toBe(1);
  });
  it('keeps a key alone from enabling the live MarketCheck provider',()=>{
    vi.stubEnv('MARKETCHECK_API_KEY','fixture-only');vi.stubEnv('MARKET_DATA_PROVIDER','');vi.stubEnv('PROVIDERS','');expect(getProviders().listings).not.toBeInstanceOf(MarketCheckListings);
    vi.stubEnv('MARKET_DATA_PROVIDER','marketcheck');expect(getProviders().listings).toBeInstanceOf(MarketCheckListings);
  });
});
