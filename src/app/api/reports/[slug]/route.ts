import { json, route } from '@/lib/http';
import { getDb } from '@/lib/db';
import { notFound } from '@/lib/errors';
import { loadReportBySlug, toPublicReport } from '@/lib/appraisals';

/** GET /api/reports/[slug]: public, read-only share view. No user/vehicle/appraisal ids. */
export const GET = route<{ slug: string }>({ auth: false, name: 'reports.get' }, async ({ params }) => {
  const slug = String(params.slug ?? '');
  if (!/^[0-9A-Za-z]{6,32}$/.test(slug)) throw notFound('Report');
  const report = await loadReportBySlug(getDb(), slug);
  if (!report) throw notFound('Report');
  return json(toPublicReport(report));
});
