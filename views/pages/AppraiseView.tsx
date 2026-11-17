import type { Metadata } from 'next';
import { VinStep } from '@/views/components/appraise/VinStep';

export const metadata: Metadata = { title: 'Appraise your car' };

export default function AppraisePage() {
  return <VinStep />;
}
