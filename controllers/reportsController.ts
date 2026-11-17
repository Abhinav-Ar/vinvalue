import { json, route } from '@/models/http';
import { getDb } from '@/models/db';
import { notFound } from '@/models/errors';
import { claimReport as claimReportModel, loadReportBySlug, toPublicReport } from '@/models/appraisals';
/** POST /api/reports/[slug]/claim: save an anonymous report to the signed-in account. */
export const claimReport = route<{ slug: string }, true>({ auth: true, name: 'reports.claim' }, async ({ params, userId }) => {
  const slug = String(params.slug ?? '');
  if (!/^[0-9A-Za-z]{6,32}$/.test(slug)) throw notFound('Report');
  return json(await claimReportModel(getDb(), userId, slug));
});
/** GET /api/reports/[slug]: public, read-only share view. No user/vehicle/appraisal ids. */
export const getReport = route<{ slug: string }>({ auth: false, name: 'reports.get' }, async ({ params }) => {
  const slug = String(params.slug ?? '');
  if (!/^[0-9A-Za-z]{6,32}$/.test(slug)) throw notFound('Report');
  const report = await loadReportBySlug(getDb(), slug);
  if (!report) throw notFound('Report');
  return json(toPublicReport(report));
});
