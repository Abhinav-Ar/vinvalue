import { z } from 'zod';
import { json, parse, route } from '@/lib/http';
import { getDb } from '@/lib/db';
import { documentKindEnum } from '@/lib/db/schema';
import { badRequest } from '@/lib/errors';
import { requireVehicle } from '@/lib/ownership';
import { isoDateSchema } from '@/lib/validation';
import { createDocument, listDocuments } from '@/lib/garage/documents';

type P = { id: string };

const metaSchema = z.object({
  kind: z.enum(documentKindEnum.enumValues, { error: 'Pick a document type.' }),
  label: z.string().trim().max(120).nullable().optional(),
  expiresOn: isoDateSchema.nullable().optional(),
});

export const GET = route<P, true>({ auth: true, name: 'documents.list' }, async ({ params, userId }) => {
  const db = getDb();
  const v = await requireVehicle(db, userId, params.id);
  return json({ documents: await listDocuments(db, v.id) });
});

/**
 * POST multipart/form-data: file (optional, up to 10 MB, pdf/jpeg/png/heic/webp), kind, label, expiresOn.
 * Also accepts JSON {kind, label, expiresOn} for metadata-only records (e.g. "Registration renews Dec 22").
 */
export const POST = route<P, true>({ auth: true, name: 'documents.create' }, async ({ req, params, userId }) => {
  const db = getDb();
  const v = await requireVehicle(db, userId, params.id);
  const ct = req.headers.get('content-type') ?? '';
  if (ct.includes('multipart/form-data')) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw badRequest('Could not read the upload.');
    }
    const str = (k: string) => {
      const x = form.get(k);
      return typeof x === 'string' && x.trim() !== '' ? x : null;
    };
    const meta = parse(metaSchema, { kind: str('kind') ?? undefined, label: str('label'), expiresOn: str('expiresOn') });
    const f = form.get('file');
    const file = f && typeof f !== 'string' ? { body: f as Blob, contentType: f.type, size: f.size } : null;
    return json(await createDocument(db, v.id, { kind: meta.kind, label: meta.label ?? null, expiresOn: meta.expiresOn ?? null, file }), { status: 201 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw badRequest('Send multipart/form-data with a file, or JSON for a record without a file.');
  }
  const meta = parse(metaSchema, body);
  return json(await createDocument(db, v.id, { kind: meta.kind, label: meta.label ?? null, expiresOn: meta.expiresOn ?? null }), { status: 201 });
});
