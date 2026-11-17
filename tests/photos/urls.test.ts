import { describe, expect, it } from 'vitest';
import { marketPhotoProxyUrl, validMarketImagePath } from '@/models/photos/urls';

describe('photo URL safety', () => {
  it('accepts only canonical MarketCheck cache paths', () => {
    expect(validMarketImagePath('/v2/image/cache/car/abc_1/abcdef01')).toBe(true);
    expect(validMarketImagePath('/v2/image/cache/car/abc/../../etc')).toBe(false);
    expect(validMarketImagePath('/v2/image/cache/car/abc/aa?x=1')).toBe(false);
  });
  it('normalizes MarketCheck URLs to the local proxy and rejects credentials', () => {
    expect(marketPhotoProxyUrl('https://api.marketcheck.com/v2/image/cache/car/x/abcdef')).toContain('/api/photo/image?path=');
    expect(marketPhotoProxyUrl('https://user:pass@example.com/image.jpg')).toBeNull();
    expect(marketPhotoProxyUrl('http://example.com/image.jpg')).toBeNull();
  });
});
