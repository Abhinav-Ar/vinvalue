/** npx tsx scripts/calibrate.ts [--local-db | /path/to/labeled-sales.json]
 * Never applies proposed parameters. No network/DB by default. */
import { readFileSync } from 'node:fs';
import { calibrate, scoreSales, type LabeledSale } from '../models/valuation/calibration';
import { loadReferences } from '../models/reference';
let rows:LabeledSale[];
if(process.argv.includes('--local-db')) {
  const url=process.env.DATABASE_URL??'';
  if(process.env.NODE_ENV==='production'||!(url.startsWith('pglite:')||/^postgres(?:ql)?:\/\/[^/]*@(localhost|127\.0\.0\.1)(:|\/)/.test(url))) throw new Error('Calibration permits an explicit local database only.');
  const {getDb}=await import('../models/db');
  const {readCalibrationSales}=await import('../models/appraisals/calibrationData');
  rows=await readCalibrationSales(getDb());
} else rows=JSON.parse(readFileSync(process.argv[2]??'tests/fixtures/reference/labeled-sales.json','utf8'));
const data=loadReferences();
console.log(JSON.stringify({label:'Uncalibrated proposals only. No auto-apply. Empty fixture is intentional: no genuine labels supplied.',rows:rows.length,baseline:scoreSales(rows,data),proposals:calibrate(rows,data)},null,2));
process.exit(0);
