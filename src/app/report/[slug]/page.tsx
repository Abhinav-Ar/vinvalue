import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ReportView } from '@/components/appraise/ReportView';
import { getDb } from '@/lib/db';
import { loadReportBySlug } from '@/lib/appraisals';

export const metadata: Metadata = { title: 'Appraisal report', robots: { index: false } };

export default async function ReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Missing or expired reports get a real 404 status; the client view still loads the data itself.
  if (!/^[0-9A-Za-z]{6,32}$/.test(slug) || !(await loadReportBySlug(getDb(), slug))) notFound();
  return <ReportView slug={slug} />;
}
