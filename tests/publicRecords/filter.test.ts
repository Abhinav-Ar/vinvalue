import { describe, expect, it } from 'vitest';
import { filterWashingtonSale } from '@/models/publicRecords/ingest';

const base = { make: 'Tesla', model: 'Model 3', model_year: '2021', new_or_used_vehicle: 'Used', transaction_type: 'Transfer Title', sale_price: '24000', date_of_vehicle_sale: '2025-01-02', transaction_date: '2025-01-03', odometer_reading: '30000', odometer_code: 'Actual Mileage', vin_1_10: 'SECRET', dol_id: '123', city: 'Seattle', zip: '98101' };
describe('public-record filtering', () => {
  it('keeps a real used sale and only coarse fields', () => { const r = filterWashingtonSale(base); expect(r.row?.salePrice).toBe(24000); expect(r.row?.odometer).toBe(30000); expect(r.row).not.toHaveProperty('vin'); expect(r.row).not.toHaveProperty('city'); });
  it('rejects nominal, new, and implausible values', () => { expect(filterWashingtonSale({ ...base, sale_price: '1' }).reason).toBe('nominal_price'); expect(filterWashingtonSale({ ...base, new_or_used_vehicle: 'New' }).reason).toBe('new_vehicle'); expect(filterWashingtonSale({ ...base, sale_price: '999999999' }).reason).toBe('implausible_price'); });
  it('drops odometer when code is not an actual reading', () => { expect(filterWashingtonSale({ ...base, odometer_code: 'Not actual mileage' }).row?.odometer).toBeNull(); });
});
