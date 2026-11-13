import type { Metadata } from 'next';
import { DetailsStep } from '@/components/appraise/DetailsStep';

export const metadata: Metadata = { title: 'Car details' };

export default function AppraiseDetailsPage() {
  return <DetailsStep />;
}
