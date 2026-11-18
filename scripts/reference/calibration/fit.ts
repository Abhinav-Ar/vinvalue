/** Offline reproducible 2.1 calibration. Explicit local PGlite only, SELECT-only transaction.
 * npx tsx --tsconfig tsconfig.json scripts/reference/calibration/fit.ts [--apply]
 * Bounds below are conservative extensions of the coarse prior grid, not a sourced empirical law.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { loadReferences, exactName } from '@/models/reference';
import { evaluateSurface } from '@/models/valuation/surface';
import { valuationConfig as C } from '@/models/config/valuation';
const data=loadReferences(), now=new Date('2026-11-17Z');
const key=(make:string,model:string)=>`${exactName(make)}/${exactName(model)}`;
const quant=(a:number[],q:number)=>{const s=[...a].sort((a,b)=>a-b);const i=(s.length-1)*q;return s.length?s[Math.floor(i)]!+(s[Math.ceil(i)]!-s[Math.floor(i)]!)*(i%1):0;};
type Row={model:string;trim:string;year:number;family:string;make:string;segment:string;age:number;D:number;q:number;M:number;miles:number;eligible:boolean;y:number;w:number;source:string;n:number};
const rows:Row[]=[];
const excluded:string[]=[];
function add(make:string,model:string,trim:string,year:number,miles:number,y:number,w:number,source:string,n=1){
 const s=evaluateSurface({make,model,year,transmission:null},trim,miles,now,data);
 rows.push({model,trim,year,family:key(make,model),make:exactName(make),segment:s.segment,age:s.age,D:s.D,q:s.q,M:s.M,miles,eligible:s.D>C.surface.growthThreshold&&s.q>=C.surface.plateauCoverage&&!!s.generationRef&&!!s.variantRef,y,w,source,n});
}
for(const file of ['refs-a.csv','refs-b.csv']){
 const lines=readFileSync(`scripts/reference/calibration/${file}`,'utf8').trim().split(/\r?\n/);
 for(const line of lines.slice(1)){const [make,model,generation,trim,year,miles,y,conf]=line.split(',');
 const anchor=data.msrp.find(r=>r.make===make&&r.model===model&&r.generation===generation&&r.trim===trim&&+year!>=r.yearFrom&&+year!<=r.yearTo);
 if(!anchor)throw Error(`Unjoined reference: ${line}`);
 if(!data.cpi?.rows.some(r=>r.year===anchor.msrpModelYear)){excluded.push(`${make}/${model}/${year}: missing CPI ${anchor.msrpModelYear}`);continue;}
 add(make!,model!,trim!,+year!,+miles!,+y!,({high:1,medium:.6,low:.3} as Record<string,number>)[conf!]!,'refs'); }
}
const url=readFileSync('.env.local','utf8').match(/^DATABASE_URL=["']?([^\r\n"']+)/m)?.[1];
if(url!=='pglite:./.data/pglite'||process.env.NODE_ENV==='production')throw Error('Only the designated local development PGlite is allowed');
const db=new PGlite('./.data/pglite');
await db.exec('BEGIN READ ONLY');
// Late-2026 target: restrict to 2026 sales, positive prices/odometers. Minimum 10 per cell.
const sales=(await db.query<{make:string;model:string;year:number;miles:number;price:number;n:number}>(`select make,model,model_year as year,percentile_cont(.5) within group(order by odometer) as miles,percentile_cont(.5) within group(order by sale_price) as price,count(*)::int as n from public_record_sales where transaction_date >= '2026-01-01' and transaction_date <= '2026-11-17' and sale_price >= 1000 and odometer > 0 and odometer <= 300000 and model_year <= 2026 group by make,model,model_year,floor(odometer/20000) having count(*) >= 10`)).rows;
await db.exec('ROLLBACK');await db.close();
for(const r of sales){const anchors=data.msrp.filter(m=>key(m.make,m.model)===key(r.make,r.model)&&r.year>=m.yearFrom&&r.year<=m.yearTo&&C.familySegments[key(m.make,m.model)]==='ev').sort((a,b)=>a.tier-b.tier||a.msrpUsd-b.msrpUsd);const a=anchors[0];if(a&&data.cpi?.rows.some(r=>r.year===a.msrpModelYear))add(a.make,a.model,a.trim,r.year,r.miles,r.price,1,'wa',r.n);}
// Stratify families by segment and median-age bucket, sorted deterministic hash; alternate within strata.
const hash=(s:string)=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
const bucket=(age:number)=>age<=5?'0-5':age<=10?'6-10':age<=20?'11-20':'21+';
const families=[...new Set(rows.map(r=>r.family))],strata=new Map<string,string[]>();
for(const f of families){const rs=rows.filter(r=>r.family===f),s=`${rs[0]!.segment}/${bucket(quant(rs.map(r=>r.age),.5))}`;strata.set(s,[...(strata.get(s)??[]),f]);}
const split:Record<string,string>={};let offset=0;
for(const [,fs] of [...strata].sort()){fs.sort((a,b)=>hash(a)-hash(b));fs.forEach((f,i)=>split[f]=(i+offset)%2?'holdout':'train');offset+=fs.length;}
const train=rows.filter(r=>split[r.family]==='train'),test=rows.filter(r=>split[r.family]==='holdout');
const segments=['economy','midsize','fullsize','suv','truck','van','luxury','sports','ev'];
const brands=[...new Set(train.map(r=>r.make))].sort();
const pars:Record<string,number>={beta:.12,betaD2:.28,floorD2:.32,onset:25,onsetD:10};
const bounds:Record<string,[number,number]>={beta:[.05,.6],betaD2:[0,.8],floorD2:[.1,1.2],onset:[12,30],onsetD:[0,18]};
for(const s of segments)for(const [p,v,lo,hi] of [['market',1,.7,2],['k',1,.35,1.8],['floor',1,.5,3]] as const){pars[`${s}.${p}`]=v;bounds[`${s}.${p}`]=[lo,hi];}
for(const b of brands){pars[`brand.${b}`]=1;bounds[`brand.${b}`]=[.65,1.4];}
function predict(r:Row,p:Record<string,number>){const D=r.D,b=p[`brand.${r.make}`]??1,k=(.14-.06*D)*p[`${r.segment}.k`]!*b,F=Math.min(1,(.12+p.floorD2!*D*D)*p[`${r.segment}.floor`]!/b),age=r.eligible?Math.min(r.age,p.onset!-p.onsetD!*D):r.age;
 const R=(1-(.12-.04*D))*(F+(1-F)*Math.exp(-k*age));
 const ref=12000*(1-.75*D)*Math.min(r.age,15),h=(m:number)=>Math.max(0,Math.log(40000/(m+10000))),raw=-(p.beta!+p.betaD2!*D*D)*Math.log((r.miles+10000)/(ref+10000))+.20*D*D*Math.min(r.age/10,1)*(h(r.miles)-h(ref)),cap=Math.log(1.35)+D*D*Math.log(2.5/1.35);
 return r.M*R*Math.exp(Math.max(-cap,Math.min(cap,raw)))*p[`${r.segment}.market`]!;
}
// Equal source influence within EV; confidence weighting within refs. Brand ridge shrinks thin makes.
const sourceTotals=Object.fromEntries(['refs','wa'].map(s=>[s,train.filter(r=>r.source===s).reduce((a,r)=>a+r.w,0)]));
function loss(p:Record<string,number>){let v=0;for(const r of train){const e=Math.abs(Math.log(predict(r,p)/r.y)),h=e<=.2?e*e/2:.2*(e-.1);v+=r.w/sourceTotals[r.source]!*h;}
 for(const b of brands)v+=.002*Math.log(p[`brand.${b}`]!)**2;
 for(const s of segments){v+=.0002*Math.log(p[`${s}.market`]!)**2+.0002*Math.log(p[`${s}.k`]!)**2+.0002*Math.log(p[`${s}.floor`]!)**2;}return v;}
let best=loss(pars);
for(const step of [.2,.1,.05,.02,.01,.005,.002])for(let pass=0;pass<40;pass++){let changed=false;for(const name of Object.keys(pars)){const old=pars[name]!,[lo,hi]=bounds[name]!;let chosen=old;for(const direction of [-1,1]){pars[name]=Math.max(lo,Math.min(hi,old+direction*step*(hi-lo)));const l=loss(pars);if(l<best-1e-10){best=l;chosen=pars[name]!;changed=true;}}pars[name]=chosen;}if(!changed)break;}
for(const name of Object.keys(pars))pars[name]=Number(pars[name]!.toFixed(6));
function metrics(rs:Row[]){const e=rs.map(r=>Math.abs(predict(r,pars)/r.y-1)*100);return {n:rs.length,sales:rs.reduce((a,r)=>a+r.n,0),median:rs.length?quant(e,.5):null,p80:rs.length?quant(e,.8):null,p90:rs.length?quant(e,.9):null};}
const tables:Record<string,unknown>={};for(const source of ['refs','wa']){const rs=test.filter(r=>r.source===source);tables[source]={all:metrics(rs),segment:Object.fromEntries(segments.map(s=>[s,metrics(rs.filter(r=>r.segment===s))])),age:Object.fromEntries(['0-5','6-10','11-20','21+'].map(b=>[b,metrics(rs.filter(r=>bucket(r.age)===b))]))};}
const allLog=quant(test.map(r=>Math.abs(Math.log(r.y/predict(r,pars)))),.8);
const segmentCalibration=Object.fromEntries(segments.map(s=>{const rs=test.filter(r=>r.segment===s);return [s,{market:pars[`${s}.market`],k:pars[`${s}.k`],floor:pars[`${s}.floor`],interval:rs.length>=8?quant(rs.map(r=>Math.abs(Math.log(r.y/predict(r,pars)))),.8):allLog}];}));
const report={excluded,date:'2026-11-17',seed:'FNV1a, alternating segment/median-age strata',counts:{train:train.length,holdout:test.length,trainFamilies:families.filter(f=>split[f]==='train').length,holdoutFamilies:families.filter(f=>split[f]==='holdout').length},parameters:pars,segmentCalibration,holdout:tables,split,bounds,limitations:['References are informed estimates, not transactions.','WA: 2026 sales only; minimum 10 sales per 20k-mile cell; model-level base trim; no trim correction. Cell medians weighted equally, not by volume.','Sparse segment intervals (<8 cells) use pooled holdout absolute log residual p80.','Holdout measures family transfer; used to set intervals, never to fit centers.','No supplied numeric spec bounds for new market/brand parameters: explicit conservative search bounds recorded here. No appreciation fitted; G remains evidence gated.']};
writeFileSync('scripts/reference/calibration/results.json',JSON.stringify(report,null,2)+'\n');
// Check the optimizer's cached equation against the production surface for every observation.
const fittedConfig={...C,segmentCalibration,brandCalibration:Object.fromEntries(brands.map(b=>[b,pars[`brand.${b}`]!])),surface:{...C.surface,beta:pars.beta!,betaD2:pars.betaD2!,floorD2:pars.floorD2!,onset:pars.onset!,onsetD:pars.onsetD!}};
for(const r of rows){const actual=evaluateSurface({make:r.make,model:r.model,year:r.year,transmission:null},r.trim,r.miles,now,data,fittedConfig).H;if(Math.abs(actual/predict(r,pars)-1)>1e-9)throw Error(`Fitter/engine drift: ${r.family}`);}
if(process.argv.includes('--apply')){
 let text=readFileSync('models/config/valuation.ts','utf8');
 text=text.replace(/segmentCalibration: [\s\S]*? as Record<string, \{ market: number; k: number; floor: number; interval: number \}>/,`segmentCalibration: ${JSON.stringify(segmentCalibration,null,2)} as Record<string, { market: number; k: number; floor: number; interval: number }>`)
 .replace(/brandCalibration: [\s\S]*? as Record<string, number>/,`brandCalibration: ${JSON.stringify(fittedConfig.brandCalibration,null,2)} as Record<string, number>`);
 for(const name of ['beta','betaD2','floorD2','onset','onsetD'])text=text.replace(new RegExp(`\\b${name}: [0-9.]+`),`${name}: ${pars[name]}`);
 text=text.replace(/parameterVersion: '[^']*'/,"parameterVersion: '2026-11-17-family-holdout'");
 writeFileSync('models/config/valuation.ts',text);
}
console.log(JSON.stringify({counts:report.counts,parameters:pars,holdout:tables,segmentCalibration},null,2));
