import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import type { Db } from '@/models/db';
import { documents, serviceEvents } from '@/models/db/schema';
import { setTestUser } from '@/models/session';
import { MemoryFileStore, setFileStore } from '@/models/files';
import { createTestDb, createUser } from '../helpers/db';
import * as docsRoute from '@/app/api/vehicles/[id]/documents/route';
import * as docRoute from '@/app/api/documents/[id]/route';
import * as downloadRoute from '@/app/api/documents/[id]/download/route';
import * as vehicleRoute from '@/app/api/vehicles/[id]/route';
import { call, freezeToday, seedDoc, seedEvent, seedVehicle } from './helpers';

let db: Db;
let userId: string;
let otherId: string;
let store: MemoryFileStore;
beforeEach(async () => {
  freezeToday();
  db = await createTestDb();
  userId = (await createUser(db)).id;
  otherId = (await createUser(db)).id;
  setTestUser(userId);
  store = new MemoryFileStore();
  setFileStore(store);
}, 60_000);
afterEach(() => {
  vi.useRealTimers();
  setFileStore(null);
});

function form(fields: Record<string, string>, file?: { bytes: number; type: string; name?: string }) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  if (file) f.set('file', new File([new Uint8Array(file.bytes)], file.name ?? 'scan', { type: file.type }));
  return f;
}

describe('documents', () => {
  it('uploads to the store, lists, downloads and deletes', async () => {
    const v = await seedVehicle(db, userId, 'mustang');
    const up = await call(docsRoute.POST, `/api/vehicles/${v.id}/documents`, { method: 'POST', params: { id: v.id }, form: form({ kind: 'insurance', label: 'Card', expiresOn: '2027-05-01' }, { bytes: 2048, type: 'application/pdf' }) });
    expect(up.status).toBe(201);
    expect(up.json).toMatchObject({ kind: 'insurance', label: 'Card', expiresOn: '2027-05-01', hasFile: true, contentType: 'application/pdf', sizeBytes: 2048, downloadUrl: `/api/documents/${up.json.id}/download` });
    const key = `vehicles/${v.id}/${up.json.id}.pdf`;
    expect(store.files.get(key)?.body.byteLength).toBe(2048);

    const list = await call(docsRoute.GET, `/api/vehicles/${v.id}/documents`, { params: { id: v.id } });
    expect(list.json.documents).toHaveLength(1);

    const dl = await call(downloadRoute.GET, `/api/documents/${up.json.id}/download`, { params: { id: up.json.id } });
    expect(dl.status).toBe(302);
    expect(dl.headers.get('location')).toBe(`memory://${key}`);

    const patch = await call(docRoute.PATCH, `/api/documents/${up.json.id}`, { method: 'PATCH', params: { id: up.json.id }, body: { expiresOn: '2027-11-01' } });
    expect(patch.json.expiresOn).toBe('2027-11-01');

    const ev = await seedEvent(db, v.id, { type: 'oil_filter', title: 'Oil', date: '2026-11-01', status: 'done', receiptDocumentId: up.json.id });
    const del = await call(docRoute.DELETE, `/api/documents/${up.json.id}`, { method: 'DELETE', params: { id: up.json.id } });
    expect(del.status).toBe(204);
    expect(store.files.has(key)).toBe(false);
    expect((await db.select().from(serviceEvents).where(eq(serviceEvents.id, ev.id)))[0]!.receiptDocumentId).toBeNull();
  });

  it('accepts metadata-only records via JSON or form, even without a store', async () => {
    setFileStore(null);
    const prev = process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    try {
      const v = await seedVehicle(db, userId, 'mustang');
      const j = await call(docsRoute.POST, `/api/vehicles/${v.id}/documents`, { method: 'POST', params: { id: v.id }, body: { kind: 'registration', expiresOn: '2026-12-22' } });
      expect(j.status).toBe(201);
      expect(j.json).toMatchObject({ hasFile: false, downloadUrl: null, expiresOn: '2026-12-22' });
      const f = await call(docsRoute.POST, `/api/vehicles/${v.id}/documents`, { method: 'POST', params: { id: v.id }, form: form({ kind: 'title', label: 'Clean' }) });
      expect(f.status).toBe(201);
      const withFile = await call(docsRoute.POST, `/api/vehicles/${v.id}/documents`, { method: 'POST', params: { id: v.id }, form: form({ kind: 'receipt' }, { bytes: 10, type: 'image/png' }) });
      expect(withFile.status).toBe(503);
      expect(withFile.json.error.code).toBe('not_configured');
      const dl = await call(downloadRoute.GET, `/api/documents/${j.json.id}/download`, { params: { id: j.json.id } });
      expect(dl.status).toBe(404);
    } finally {
      if (prev !== undefined) process.env.BLOB_READ_WRITE_TOKEN = prev;
    }
  });

  it('rejects oversized, wrong-type and kind-less uploads', async () => {
    const v = await seedVehicle(db, userId, 'mustang');
    const big = await call(docsRoute.POST, `/api/vehicles/${v.id}/documents`, { method: 'POST', params: { id: v.id }, form: form({ kind: 'receipt' }, { bytes: 10 * 1024 * 1024 + 1, type: 'image/jpeg' }) });
    expect(big.status).toBe(400);
    expect(big.json.error.fields.file).toBeTruthy();
    const exe = await call(docsRoute.POST, `/api/vehicles/${v.id}/documents`, { method: 'POST', params: { id: v.id }, form: form({ kind: 'receipt' }, { bytes: 10, type: 'application/x-msdownload' }) });
    expect(exe.status).toBe(400);
    const noKind = await call(docsRoute.POST, `/api/vehicles/${v.id}/documents`, { method: 'POST', params: { id: v.id }, form: form({}, { bytes: 10, type: 'image/png' }) });
    expect(noKind.status).toBe(400);
    expect(noKind.json.error.fields.kind).toBeTruthy();
    const ok = await call(docsRoute.POST, `/api/vehicles/${v.id}/documents`, { method: 'POST', params: { id: v.id }, form: form({ kind: 'receipt' }, { bytes: 10 * 1024 * 1024, type: 'image/heic' }) });
    expect(ok.status).toBe(201);
    expect(store.files.size).toBe(1);
  });

  it('deleting a vehicle removes its stored files', async () => {
    const v = await seedVehicle(db, userId, 'mustang');
    await call(docsRoute.POST, `/api/vehicles/${v.id}/documents`, { method: 'POST', params: { id: v.id }, form: form({ kind: 'receipt' }, { bytes: 5, type: 'image/webp' }) });
    expect(store.files.size).toBe(1);
    expect((await call(vehicleRoute.DELETE, `/api/vehicles/${v.id}`, { method: 'DELETE', params: { id: v.id } })).status).toBe(204);
    expect(store.files.size).toBe(0);
    expect(await db.select().from(documents)).toHaveLength(0);
  });

  it('404s on other users\' documents and vehicles', async () => {
    const theirs = await seedVehicle(db, otherId, 'supra');
    const doc = await seedDoc(db, theirs.id, { kind: 'title', fileKey: 'x' });
    const p = { id: doc.id };
    const results = await Promise.all([
      call(docsRoute.GET, `/api/vehicles/${theirs.id}/documents`, { params: { id: theirs.id } }),
      call(docsRoute.POST, `/api/vehicles/${theirs.id}/documents`, { method: 'POST', params: { id: theirs.id }, body: { kind: 'title' } }),
      call(docRoute.GET, `/api/documents/${doc.id}`, { params: p }),
      call(docRoute.PATCH, `/api/documents/${doc.id}`, { method: 'PATCH', params: p, body: { label: 'mine' } }),
      call(docRoute.DELETE, `/api/documents/${doc.id}`, { method: 'DELETE', params: p }),
      call(downloadRoute.GET, `/api/documents/${doc.id}/download`, { params: p }),
    ]);
    expect(results.map((r) => r.status)).toEqual([404, 404, 404, 404, 404, 404]);
    expect(await db.select().from(documents).where(eq(documents.id, doc.id))).toHaveLength(1);
  });
});
