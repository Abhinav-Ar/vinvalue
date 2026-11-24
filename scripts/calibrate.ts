/** Local calibration and guarded correction publication. npx tsx scripts/calibrate.ts [--local-db | labeled-sales.json]
 * Local DB guard prohibits production. No database is opened by default. */
import { readFileSync, writeFileSync } from 'node:fs';
import { loadReferences } from '../models/reference';
import type { LabeledSale } from '../models/valuation/calibration';
import { joinMarketSamples, proposeWithMarket, type DealerSample } from '../models/valuation/marketCalibration';
const started=performance.now();
const data=loadReferences();
let rows:LabeledSale[]=[],samples:DealerSample[]=[];
if(process.argv.includes('--local-db')) {
  const url=process.env.DATABASE_URL??'';
  if(process.env.NODE_ENV==='production'||!(url.startsWith('pglite:')||/^postgres(?:ql)?:\/\/[^/]*@(localhost|127\.0\.0\.1)(:|\/)/.test(url))) throw new Error('Calibration permits an explicit local database only.');
  const {getDb}=await import('../models/db');
  const {readCalibrationSales}=await import('../models/appraisals/calibrationData');
  const {marketSamples}=await import('../models/db/schema');
  rows=await readCalibrationSales(getDb());
  samples=await getDb().select().from(marketSamples);
} else {
  const path=process.argv.slice(2).find(x=>!x.startsWith('--'));
  if(path) {const input=JSON.parse(readFileSync(path,'utf8'));rows=Array.isArray(input)?input:input.sales??[];samples=Array.isArray(input)?[]:input.samples??[];}
}
// Existing curated reference estimates, alongside WA recorded sales and dealer samples.
for(const file of ['refs-a.csv','refs-b.csv']) {
  for(const [i,line] of readFileSync(`scripts/reference/calibration/${file}`,'utf8').trim().split(/\r?\n/).slice(1).entries()) {
    const [make,model,,trim,year,miles,price]=line.split(',');
    rows.push({id:`${file}:${i}`,groupId:`${make}/${model}`,source:'reference',soldOn:'2026-11-17',make:make!,model:model!,trim:trim!,year:Number(year),miles:Number(miles),soldPrice:Number(price)});
  }
}
const joined=joinMarketSamples(samples,data);
const {rows:marketRows,...matching}=joined;
const report={label:'PROPOSALS ONLY — human review required',matching,...proposeWithMarket([...rows,...marketRows],data)};
writeFileSync('scripts/reference/calibration/market-proposals.json',JSON.stringify(report,(key,value)=>key==='skipped'&&Array.isArray(value)?{count:value.length,reasons:value.reduce((out:Record<string,number>,r:{reason:string})=>{out[r.reason]=(out[r.reason]??0)+1;return out;},{})}:value,2)+'\n');
const table=(label:string,metrics:typeof report.baseline.all)=>`## ${label}\n\n| Segment / age | n | MAPE % | Signed % |\n|---|---:|---:|---:|\n${metrics.metrics.map(r=>`| ${r.bucket} | ${r.n} | ${r.MAPE.toFixed(2)} | ${r.signedPct.toFixed(2)} |`).join('\n')}\n`;
writeFileSync('scripts/reference/calibration/MARKET_REPORT.md',`# Legacy segment-grid diagnostic proposals\n\nLegacy comparison only; this is not the active correction fitter. See FAMILY_REPORT.md for method 2.3.0 family corrections and balanced five-fold validation. Human review required for these legacy grid proposals. Model config was not modified.\n\nDealer asking → private party factor: ${matching.factor} (configured, not fitted). Matched ${matching.matched}/${matching.received} samples; match rate ${matching.matchRate??'n/a'}. Unknown or ambiguous trims are dropped.\n\nTraining: ${report.counts.train} rows / ${report.counts.trainFamilies} families. Holdout: ${report.counts.holdout} rows / ${report.counts.holdoutFamilies} families. Fixed 50/50 family split, shared across both fits.\n\n${report.evFactorSanity.note} Comparable EV cells: ${report.evFactorSanity.overlap.length}.\n\n${table('Current config holdout',report.baseline.all)}\n${table('Fit without dealer samples',report.beforeAddingSamples.all)}\n${table('Fit with dealer samples',report.afterAddingSamples.all)}\nFull proposed segment parameters, source-specific holdout metrics, family split and WA EV factor checks: market-proposals.json.\n\n${report.limitations.map(x=>`- ${x}`).join('\n')}\n`);

const {fitBiasCorrections,accuracyMarkdown}=await import('../models/valuation/biasCalibration');
const {committedCorrections}=await import('../models/valuation/biasCorrections');
let bias:ReturnType<typeof fitBiasCorrections>&{markdown?:string;drift?:unknown};
if(process.argv.includes('--local-db')) {
  const {getDb}=await import('../models/db');
  const {runValuationCalibration}=await import('../models/jobs/valuationCalibration');
  bias=await runValuationCalibration(getDb(),new Date(),true);
} else bias=fitBiasCorrections(samples,rows,data,committedCorrections);
writeFileSync('models/reference/data/bias-corrections.json',JSON.stringify(bias.corrections,null,2)+'\n');
const runtimeSeconds=(performance.now()-started)/1000;
writeFileSync('scripts/reference/calibration/monthly-accuracy.json',JSON.stringify({...bias.report,drift:bias.drift??null,runtimeSeconds},null,2)+'\n');
writeFileSync('scripts/reference/calibration/MONTHLY_ACCURACY.md',bias.markdown??accuracyMarkdown(bias.report));
console.log(JSON.stringify({runtimeSeconds,matching,bias:bias.report,output:'scripts/reference/calibration/monthly-accuracy.json'},null,2));
process.exit(0);
