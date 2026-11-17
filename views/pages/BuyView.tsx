import type { Metadata } from 'next';
import { PriceCheck } from '@/views/components/tools/PriceCheck';

export const metadata: Metadata = { title: 'Price check' };

export default function BuyPage() {
  return <PriceCheck />;
}
