import { z } from 'zod';
import { json, parseJson, route } from '@/lib/http';
import { getDb } from '@/lib/db';
import { documentKindEnum } from '@/lib/db/schema';
import { isoDateSchema } from '@/lib/validation';
import { deleteDocument, documentDto, requireDocument, updateDocument } from '@/lib/garage/documents';

type P = { id: string };
const patchSchema = z
  .object({
    kind: z.enum(documentKindEnum.enumValues).optional(),
    label: z.string().trim().max(120).nullable().optional(),
    expiresOn: isoDateSchema.nullable().optional(),
  })
  .strict();

export const GET = route<P, true>({ auth: true, name: 'documents.get' }, async ({ params, userId }) => {
  return json(documentDto(await requireDocument(getDb(), userId, params.id)));
});

/** PATCH {kind?, label?, expiresOn?}: e.g. update a renewal date. */
export const PATCH = route<P, true>({ auth: true, name: 'documents.update' }, async ({ req, params, userId }) => {
  const db = getDb();
  const doc = await requireDocument(db, userId, params.id);
  return json(await updateDocument(db, doc, await parseJson(req, patchSchema)));
});

/** DELETE: removes the stored file (if any), unlinks it from service receipts, deletes the row. */
export const DELETE = route<P, true>({ auth: true, name: 'documents.delete' }, async ({ params, userId }) => {
  const db = getDb();
  await deleteDocument(db, await requireDocument(db, userId, params.id));
  return new Response(null, { status: 204 });
});
