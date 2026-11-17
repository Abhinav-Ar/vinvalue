import type { Metadata } from 'next';
import { LocalMarket } from '@/views/components/tools/LocalMarket';

export const metadata: Metadata = { title: 'Local market' };

export default function MarketPage() {
  return <LocalMarket />;
}
