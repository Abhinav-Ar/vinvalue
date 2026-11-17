import type { Metadata } from 'next';
import { DetailsStep } from '@/views/components/appraise/DetailsStep';

export const metadata: Metadata = { title: 'Car details' };

export default function AppraiseDetailsPage() {
  return <DetailsStep />;
}
