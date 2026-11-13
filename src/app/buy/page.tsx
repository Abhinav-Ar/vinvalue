import type { Metadata } from 'next';
import { PriceCheck } from '@/components/tools/PriceCheck';

export const metadata: Metadata = { title: 'Price check' };

export default function BuyPage() {
  return <PriceCheck />;
}
