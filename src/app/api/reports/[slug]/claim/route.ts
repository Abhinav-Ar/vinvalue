import { json, route } from '@/lib/http';
import { getDb } from '@/lib/db';
import { notFound } from '@/lib/errors';
import { claimReport } from '@/lib/appraisals';

/** POST /api/reports/[slug]/claim: save an anonymous report to the signed-in account. */
export const POST = route<{ slug: string }, true>({ auth: true, name: 'reports.claim' }, async ({ params, userId }) => {
  const slug = String(params.slug ?? '');
  if (!/^[0-9A-Za-z]{6,32}$/.test(slug)) throw notFound('Report');
  return json(await claimReport(getDb(), userId, slug));
});
