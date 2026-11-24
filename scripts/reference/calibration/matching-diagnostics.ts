import {writeFileSync} from 'node:fs';
import {loadReferences,referenceCandidates,resolveReference,exactName} from '@/models/reference';
import {getDb} from '@/models/db';
import {marketSamples} from '@/models/db/schema';
if(process.env.DATABASE_URL!=='pglite:./.data/pglite')throw Error('Local database only');
const samples=await getDb().select().from(marketSamples),data=loadReferences();
const unmatched=new Map<string,{make:string;model:string;trim:string|null;reason:string;n:number;years:Set<number>}>();
const families=new Map<string,{received:number;matched:number}>();
for(const s of samples){const k=exactName(s.make)+'/'+exactName(s.model);const f=families.get(k)??{received:0,matched:0};f.received++;families.set(k,f);if(resolveReference(data,s,s.trim).msrpRow){f.matched++;continue;}const cs=referenceCandidates(data,s.make,s.model);const reason=!cs.length?'model name mismatch':!cs.some(a=>s.year>=a.yearFrom&&s.year<=a.yearTo)?'year outside generation':'trim name mismatch';const key=[k,s.trim,reason].join('/');const u=unmatched.get(key)??{make:s.make,model:s.model,trim:s.trim,reason,n:0,years:new Set<number>()};u.n++;u.years.add(s.year);unmatched.set(key,u);}
const result={received:samples.length,matched:[...families.values()].reduce((n,f)=>n+f.matched,0),families:Object.fromEntries([...families].sort()),unmatched:[...unmatched.values()].map(u=>({...u,years:[...u.years].sort()})).sort((a,b)=>b.n-a.n)};
writeFileSync(process.argv[2]??'/tmp/vinvalue-matching.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));process.exit(0);
