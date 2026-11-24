/** Manual opt-in only: npx tsx --env-file=.env.local scripts/sample-market.ts */
import { getDb } from '../models/db';
import { runMarketSampler } from '../models/jobs/marketSampler';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
// Do not log errors from transports: they can contain credential-bearing URLs.
try { console.log(JSON.stringify(await runMarketSampler(getDb()))); process.exit(0); }
catch { console.error('Sampling failed; inspect database job state. No transport details logged.'); process.exit(1); }
