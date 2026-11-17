import { route, json, parseJson } from '@/models/http';
import { getDb } from '@/models/db';
import { notFound } from '@/models/errors';
import { getFileStore } from '@/models/files';
import { requireDocument, deleteDocument as deleteDocumentModel, documentDto, updateDocument } from '@/models/garage/documents';
import { z } from 'zod';
import { documentKindEnum } from '@/models/db/schema';
import { isoDateSchema } from '@/models/validation';
/** GET: 302 to a short-lived download URL for the owner's file. */
export const downloadDocument = route<{ id: string }, true>({ auth: true, name: 'documents.download' }, async ({ params, userId }) => {
  const doc = await requireDocument(getDb(), userId, params.id);
  if (!doc.fileKey) throw notFound('File');
  const url = await getFileStore().getDownloadUrl(doc.fileKey);
  return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'private, no-store' } });
});
type P = { id: string };
const patchSchema = z
  .object({
    kind: z.enum(documentKindEnum.enumValues).optional(),
    label: z.string().trim().max(120).nullable().optional(),
    expiresOn: isoDateSchema.nullable().optional(),
  })
  .strict();

export const getDocument = route<P, true>({ auth: true, name: 'documents.get' }, async ({ params, userId }) => {
  return json(documentDto(await requireDocument(getDb(), userId, params.id)));
});

/** PATCH {kind?, label?, expiresOn?}: e.g. update a renewal date. */
export const updateDocumentHandler = route<P, true>({ auth: true, name: 'documents.update' }, async ({ req, params, userId }) => {
  const db = getDb();
  const doc = await requireDocument(db, userId, params.id);
  return json(await updateDocument(db, doc, await parseJson(req, patchSchema)));
});

/** DELETE: removes the stored file (if any), unlinks it from service receipts, deletes the row. */
export const deleteDocument = route<P, true>({ auth: true, name: 'documents.delete' }, async ({ params, userId }) => {
  const db = getDb();
  await deleteDocumentModel(db, await requireDocument(db, userId, params.id));
  return new Response(null, { status: 204 });
});
