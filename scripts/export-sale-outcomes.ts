/** Run only against an explicitly selected local/offline database. */
import { writeFile } from 'node:fs/promises';
import { getDb } from '../models/db';
import { exportSaleOutcomes } from '../models/appraisals/exportOutcomes';
const path = process.argv[2];
if (!path) throw new Error('Usage: npx tsx scripts/export-sale-outcomes.ts <output.csv> (set DATABASE_URL explicitly)');
await writeFile(path, await exportSaleOutcomes(getDb()), { encoding: 'utf8', flag: 'wx' });
console.log(`Wrote anonymised sale outcomes to ${path}`);
process.exit(0);
