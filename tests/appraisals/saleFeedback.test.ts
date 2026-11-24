import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb, createUser } from '../helpers/db';
import { seedVehicle, seedAppraisal, call } from '../garage/helpers';
import { setTestUser } from '@/models/session';
import type { Db } from '@/models/db';
import { saleOutcomes, vehicles } from '@/models/db/schema';
import { ensureFeedback, listFeedback, dismissFeedback } from '@/models/appraisals/feedback';
import { exportSaleOutcomes } from '@/models/appraisals/exportOutcomes';
import { POST } from '@/app/api/appraisals/[id]/outcome/route';
import { DELETE } from '@/app/api/vehicles/[id]/route';
import { POST as mark } from '@/app/api/vehicles/[id]/sale-feedback/route';
import { PATCH as dismiss } from '@/app/api/sale-feedback/[id]/route';
let db: Db, userId: string;
const body = { soldPrice: 30000, soldOn: '2025-01-01', route: 'auction' };
const save = (id: string, b: unknown = body) => call(POST, `/api/appraisals/${id}/outcome`, { method: 'POST', params: { id }, body: b });
beforeEach(async () => { db = await createTestDb(); userId = (await createUser(db)).id; setTestUser(userId); });
describe('sale prompts and outcomes', () => {
  it('dismissal persists across planned/sold/removal transitions and is scoped to the owner', async () => {
    const v = await seedVehicle(db, userId, 'mustang');
    const p = await ensureFeedback(db, userId, v.id, 'planned');
    expect(await listFeedback(db, userId)).toHaveLength(1);
    const other = (await createUser(db)).id;
    expect(await listFeedback(db, other)).toHaveLength(0);
    await expect(dismissFeedback(db, other, p.id)).rejects.toMatchObject({ status: 404 });
    await dismissFeedback(db, userId, p.id);
    expect((await ensureFeedback(db, userId, v.id, 'sold')).dismissed).toBe(true);
    expect((await ensureFeedback(db, userId, v.id, 'removed')).id).toBe(p.id);
    expect(await listFeedback(db, userId)).toHaveLength(0);
  });
  it('enforces authentication and ownership for creation, dismissal and submission', async () => {
    const v = await seedVehicle(db, userId, 'mustang');
    const p = await ensureFeedback(db, userId, v.id, 'sold');
    for (const [user, expected] of [[null, 401], [(await createUser(db)).id, 404]] as const) {
      setTestUser(user);
      expect((await save(p.id)).status).toBe(expected);
      expect((await call(mark, '/mark', { method: 'POST', params: { id: v.id }, body: { reason: 'sold' } })).status).toBe(expected);
      expect((await call(dismiss, '/dismiss', { method: 'PATCH', params: { id: p.id } })).status).toBe(expected);
    }
    expect(await db.select().from(saleOutcomes)).toHaveLength(0);
  });
  it.each([{ soldPrice: 499 }, { soldPrice: 5000001 }, { soldPrice: -1 }, { soldPrice: 500.5 }, { soldPrice: '' }, { soldOn: '2099-01-01' }, { soldOn: '2025-02-30' }, { soldOn: 'bad' }, { route: 'unknown' }])('rejects invalid inputs %j', async patch => {
    const v = await seedVehicle(db, userId, 'mustang');
    const p = await ensureFeedback(db, userId, v.id, 'sold');
    expect((await save(p.id, { ...body, ...patch })).status).toBe(400);
    expect(await db.select().from(saleOutcomes)).toHaveLength(0);
  });
  it('accepts bounds, keeps one outcome across appraisals and suppresses future prompts', async () => {
    const v = await seedVehicle(db, userId, 'mustang');
    const a = await seedAppraisal(db, { userId, vehicleId: v.id, value: 30000, createdAt: new Date() });
    expect((await save(a.id, { ...body, soldPrice: 500 })).status).toBe(201);
    const p = await ensureFeedback(db, userId, v.id, 'sold');
    expect(p.completed).toBe(true);
    expect((await save(p.id, { ...body, soldPrice: 5000000 })).status).toBe(201);
    const rows = await db.select().from(saleOutcomes);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ appraisalId: a.id, soldPrice: 5000000, route: 'auction' });
    expect(await listFeedback(db, userId)).toHaveLength(0);
  });
  it('retains a prompt after actual removal, accepts a sale without an appraisal and exports only anonymous fields', async () => {
    const v = await seedVehicle(db, userId, 'mustang');
    expect((await call(DELETE, '/remove', { method: 'DELETE', params: { id: v.id } })).status).toBe(204);
    expect(await db.select().from(vehicles).where(eq(vehicles.id, v.id))).toHaveLength(0);
    const [p] = await listFeedback(db, userId);
    expect(p.reason).toBe('removed');
    expect((await save(p.id)).status).toBe(201);
    expect(await listFeedback(db, userId)).toHaveLength(0);
    const csv = await exportSaleOutcomes(db);
    expect(csv).toBe('make,model,year,trim,miles,price,route,month\n"Ford","Mustang","2019","GT","38200","30000","auction","2025-01"\n');
    for (const secret of [userId, v.id, p.id, v.vin, v.zip, body.soldOn]) expect(csv).not.toContain(secret);
  });
  it('exports legacy appraisal outcomes without leaking VIN, ZIP or identifiers', async () => {
    const a = await seedAppraisal(db, { userId, value: 30000, createdAt: new Date() });
    await db.insert(saleOutcomes).values({ userId, appraisalId: a.id, ...body, route: 'private' });
    const csv = await exportSaleOutcomes(db);
    expect(csv).toContain('"Ford","Mustang","2019","GT","38200","30000","private","2025-01"');
    for (const secret of [userId, a.id, a.inputs.vin, a.inputs.zip]) expect(csv).not.toContain(secret);
  });
  it('preserves the appraisal link through removal and replaces an outcome via either endpoint ID', async () => {
    const v = await seedVehicle(db, userId, 'mustang');
    const a = await seedAppraisal(db, { userId, vehicleId: v.id, value: 30000, createdAt: new Date() });
    await call(DELETE, '/remove', { method: 'DELETE', params: { id: v.id } });
    const [p] = await listFeedback(db, userId);
    expect((await save(p.id)).status).toBe(201);
    expect((await save(a.id, { ...body, soldPrice: 31000 })).status).toBe(201);
    const rows = await db.select().from(saleOutcomes);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ appraisalId: a.id, feedbackId: p.id, soldPrice: 31000 });
  });
  it('keeps unappraised outcomes attached to active vehicles and escapes CSV cells', async () => {
    const v = await seedVehicle(db, userId, 'mustang', { trim: '=1+2,"quoted"' });
    const p = await ensureFeedback(db, userId, v.id, 'sold');
    expect((await save(p.id)).status).toBe(201);
    expect((await save(p.id, { ...body, soldPrice: 31000 })).status).toBe(201);
    const rows = await db.select().from(saleOutcomes);
    expect(rows).toHaveLength(1);
    expect(rows[0].vehicleId).toBe(v.id);
    expect(await exportSaleOutcomes(db)).toContain('"\'=1+2,""quoted"""');
  });

});
