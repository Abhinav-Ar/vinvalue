import { beforeAll, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb, createUser } from '../helpers/db';
import { seedAppraisal, seedVehicle, call } from '../garage/helpers';
import { appraisals } from '@/models/db/schema';
import { setTestUser } from '@/models/session';
import { listHistory } from '@/models/history';
import { getDashboard, getExtensionGarage } from '@/models/dashboard';
import * as history from '@/app/api/history/route';
import * as dashboard from '@/app/api/dashboard/route';
import * as extension from '@/app/api/extension/garage/route';
import * as vehicle from '@/app/api/vehicles/[id]/route';
import { ValueRedirect, SellRedirect } from '@/controllers/dashboardNavigationController';
let db: Awaited<ReturnType<typeof createTestDb>>, user: string, other: string;
beforeAll(async () => { db = await createTestDb(); user = (await createUser(db)).id; other = (await createUser(db)).id; }, 60000);
it('groups case-insensitive VINs, includes garage-only cars, paginates stably, and preserves all appraisal rows', async () => {
  const v = await seedVehicle(db, user, 'mustang', { vin: '1FA6P8CF9K5123456' });
  await seedVehicle(db, user, 'mx5', { createdAt: new Date('2026-11-11') });
  await seedVehicle(db, other, 'supra');
  await seedAppraisal(db, { userId: user, vehicleId: v.id, vin: v.vin.toLowerCase(), value: 10000, createdAt: new Date('2026-11-09') });
  await seedAppraisal(db, { userId: user, vin: v.vin, value: 20000, createdAt: new Date('2026-11-12') });
  await seedAppraisal(db, { userId: other, vin: v.vin, value: 999999, createdAt: new Date('2026-11-13') });
  const first = await listHistory(db, user, { limit: 1 });
  expect(first).toMatchObject({ total: 2, nextOffset: 1 });
  expect(first.items[0]).toMatchObject({ vin: v.vin, vehicleId: v.id, source: 'appraisal', values: { private: 20000 } });
  const second = await listHistory(db, user, { offset: 1, limit: 1 });
  expect(second.items[0]).toMatchObject({ source: 'garage', values: null });
  expect(second.nextOffset).toBeNull();
  expect(await db.select().from(appraisals).where(eq(appraisals.userId, user))).toHaveLength(2);
  const dash = await getDashboard(db, user);
  expect(dash.totals).toEqual({ vehicles: 2, appraisals: 2, valuedVehicles: 1, privateValue: 20000, instantValue: 17000, retailValue: 23000 });
  const snapshot = await getExtensionGarage(db, user);
  expect(snapshot).toMatchObject({ version: 1, accountId: user });
  expect(snapshot.cars).toHaveLength(2);
  expect(snapshot.cars.find(c => c.id === v.id)).toMatchObject({ trade_in: 17000, answers: { accidents: 'No', warningLights: 'None', keysCount: 'Both sets' } });
});
it('empty accounts have zero totals, and collection endpoints require sign-in and disable caching', async () => {
  const empty = (await createUser(db)).id;
  expect((await getDashboard(db, empty)).totals.vehicles).toBe(0);
  for (const [handler, path] of [[history.GET, '/api/history'], [dashboard.GET, '/api/dashboard'], [extension.GET, '/api/extension/garage']] as const) {
    setTestUser(null); expect((await call(handler, path)).status).toBe(401);
    setTestUser(empty); const res = await call(handler, path);
    expect(res.status).toBe(200); expect(res.headers.get('cache-control')).toBe('private, no-store');
  }
});
it('rejects invalid pagination, isolates garage filter, and denies cross-user vehicle reads and writes', async () => {
  setTestUser(user);
  expect((await call(history.GET, '/api/history?limit=51')).status).toBe(400);
  expect((await call(history.GET, '/api/history?offset=-1')).status).toBe(400);
  const theirs = await seedVehicle(db, other, 'supra');
  for (const [handler, method, body] of [[vehicle.GET, 'GET', undefined], [vehicle.PATCH, 'PATCH', { nickname: 'stolen' }], [vehicle.DELETE, 'DELETE', undefined]] as const) {
    expect((await call(handler, `/api/vehicles/${theirs.id}`, { method, body, params: { id: theirs.id } })).status).toBe(404);
  }
  await seedAppraisal(db, { userId: user, vin: 'UNSAVED', value: 123, createdAt: new Date() });
  expect((await listHistory(db, user, { garageOnly: true })).items.every(i => i.vehicleId !== null)).toBe(true);
});
it('normalizes mismatched legacy enums without treating unreported conditions as healthy', async () => {
  const u = (await createUser(db)).id;
  const v = await seedVehicle(db, u, 'mustang');
  const a = await seedAppraisal(db, { userId: u, vin: v.vin, value: 500, createdAt: new Date() });
  await db.update(appraisals).set({ inputs: { ...a.inputs, accidents: 'major', warningLights: 'check_engine', keys: null } }).where(eq(appraisals.id, a.id));
  expect((await getExtensionGarage(db, u)).cars[0]!.answers).toMatchObject({ accidents: 'Yes - major', warningLights: 'Check Engine', keysCount: null, bodyDamage: null });
});
it('legacy navigation enforces session and vehicle ownership before selecting a flow', async () => {
  setTestUser(null);
  await expect(ValueRedirect({ searchParams: Promise.resolve({}) })).rejects.toThrow('NEXT_REDIRECT');
  setTestUser(user);
  const theirs = await seedVehicle(db, other, 'mx5');
  await expect(SellRedirect({ searchParams: Promise.resolve({ vehicleId: theirs.id }) })).rejects.toMatchObject({ status: 404 });
});
