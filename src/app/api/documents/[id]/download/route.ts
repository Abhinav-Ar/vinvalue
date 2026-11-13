import { route } from '@/lib/http';
import { getDb } from '@/lib/db';
import { notFound } from '@/lib/errors';
import { getFileStore } from '@/lib/files';
import { requireDocument } from '@/lib/garage/documents';

/** GET: 302 to a short-lived download URL for the owner's file. */
export const GET = route<{ id: string }, true>({ auth: true, name: 'documents.download' }, async ({ params, userId }) => {
  const doc = await requireDocument(getDb(), userId, params.id);
  if (!doc.fileKey) throw notFound('File');
  const url = await getFileStore().getDownloadUrl(doc.fileKey);
  return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'private, no-store' } });
});
