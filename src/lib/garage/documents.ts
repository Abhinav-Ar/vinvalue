import { and, desc, eq } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { documents, serviceEvents, vehicles } from '@/lib/db/schema';
import { badRequest, notFound } from '@/lib/errors';
import { getFileStore } from '@/lib/files';
import { log } from '@/lib/log';
import { diffDays, fmtLong, fmtMonthYear } from './dates';

type DocRow = typeof documents.$inferSelect;
export type DocumentKind = DocRow['kind'];

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/heif': 'heic',
  'image/webp': 'webp',
};

export function documentDto(d: DocRow) {
  return {
    id: d.id,
    vehicleId: d.vehicleId,
    kind: d.kind,
    label: d.label,
    expiresOn: d.expiresOn,
    hasFile: !!d.fileKey,
    contentType: d.contentType,
    sizeBytes: d.sizeBytes,
    downloadUrl: d.fileKey ? `/api/documents/${d.id}/download` : null,
    createdAt: d.createdAt.toISOString(),
  };
}

/** Load a document whose vehicle belongs to userId, or 404. */
export async function requireDocument(db: Db, userId: string, id: string): Promise<DocRow> {
  const [row] = await db
    .select({ doc: documents })
    .from(documents)
    .innerJoin(vehicles, eq(documents.vehicleId, vehicles.id))
    .where(and(eq(documents.id, id), eq(vehicles.userId, userId)))
    .limit(1);
  if (!row) throw notFound('Document');
  return row.doc;
}

export async function listDocuments(db: Db, vehicleId: string) {
  const rows = await db.select().from(documents).where(eq(documents.vehicleId, vehicleId)).orderBy(desc(documents.createdAt));
  return rows.map(documentDto);
}

export type NewDocument = {
  kind: DocumentKind; label: string | null; expiresOn: string | null;
  file?: { body: Blob; contentType: string; size: number } | null;
};

export async function createDocument(db: Db, vehicleId: string, input: NewDocument) {
  const id = crypto.randomUUID();
  let fileKey: string | null = null;
  if (input.file) {
    const ext = ALLOWED_CONTENT_TYPES[input.file.contentType];
    if (!ext) throw badRequest('Upload a PDF, JPEG, PNG, HEIC or WebP file.', { file: ['Unsupported file type.'] });
    if (input.file.size > MAX_UPLOAD_BYTES) throw badRequest('Files must be 10 MB or smaller.', { file: ['File is larger than 10 MB.'] });
    if (input.file.size === 0) throw badRequest('The file is empty.', { file: ['File is empty.'] });
    const store = getFileStore(); // 503 not_configured without a store
    const put = await store.put(`vehicles/${vehicleId}/${id}.${ext}`, input.file.body, input.file.contentType);
    fileKey = put.key;
  }
  const [row] = await db
    .insert(documents)
    .values({
      id, vehicleId, kind: input.kind, label: input.label, expiresOn: input.expiresOn, fileKey,
      contentType: input.file?.contentType ?? null, sizeBytes: input.file?.size ?? null,
    })
    .returning();
  return documentDto(row!);
}

export async function updateDocument(db: Db, doc: DocRow, patch: { kind?: DocumentKind; label?: string | null; expiresOn?: string | null }) {
  const [row] = await db.update(documents).set(patch).where(eq(documents.id, doc.id)).returning();
  return documentDto(row!);
}

export async function deleteDocument(db: Db, doc: DocRow) {
  if (doc.fileKey) await getFileStore().delete(doc.fileKey);
  await db.update(serviceEvents).set({ receiptDocumentId: null }).where(eq(serviceEvents.receiptDocumentId, doc.id));
  await db.delete(documents).where(eq(documents.id, doc.id));
}

/** Best-effort blob cleanup before a vehicle (and its document rows) is deleted. */
export async function deleteVehicleFiles(db: Db, vehicleId: string) {
  const rows = await db.select({ key: documents.fileKey }).from(documents).where(eq(documents.vehicleId, vehicleId));
  const keys = rows.map((r) => r.key).filter((k): k is string => !!k);
  if (!keys.length) return;
  try {
    const store = getFileStore();
    for (const k of keys) await store.delete(k);
  } catch (err) {
    log.warn('garage.vehicle_files_cleanup_failed', { count: keys.length, err });
  }
}

type SummaryEntry = { status: 'missing' | 'on_file' | 'expiring' | 'expired'; text: string; documentId: string | null; expiresOn: string | null };

/** Documents block on the vehicle overview: title / registration / insurance / receipts. */
export async function documentsSummary(db: Db, vehicleId: string, today: string) {
  const rows = await db.select().from(documents).where(eq(documents.vehicleId, vehicleId)).orderBy(desc(documents.createdAt));
  const latest = (kind: DocumentKind) =>
    rows.filter((r) => r.kind === kind).sort((a, b) => (b.expiresOn ?? '').localeCompare(a.expiresOn ?? '') || b.createdAt.getTime() - a.createdAt.getTime())[0];

  const entry = (kind: DocumentKind, verb: 'Renews' | 'Expires'): SummaryEntry => {
    const d = latest(kind);
    if (!d) return { status: 'missing', text: 'Not on file', documentId: null, expiresOn: null };
    if (!d.expiresOn) {
      const scanned = d.fileKey ? `scanned ${fmtMonthYear(d.createdAt.toISOString().slice(0, 10))}` : 'on file';
      return { status: 'on_file', text: d.label ? `${d.label}, ${scanned}` : scanned.charAt(0).toUpperCase() + scanned.slice(1), documentId: d.id, expiresOn: null };
    }
    const days = diffDays(today, d.expiresOn);
    if (days < 0) return { status: 'expired', text: `Expired ${fmtLong(d.expiresOn)}`, documentId: d.id, expiresOn: d.expiresOn };
    const when = verb === 'Renews' ? fmtLong(d.expiresOn) : fmtMonthYear(d.expiresOn);
    return { status: days <= 30 ? 'expiring' : 'on_file', text: `${verb} ${when}`, documentId: d.id, expiresOn: d.expiresOn };
  };

  const receipts = rows.filter((r) => r.kind === 'receipt').length;
  return {
    title: entry('title', 'Expires'),
    registration: entry('registration', 'Renews'),
    insurance: entry('insurance', 'Expires'),
    receipts: { count: receipts, text: `${receipts} file${receipts === 1 ? '' : 's'}` },
  };
}
