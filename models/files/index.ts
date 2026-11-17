/**
 * File storage for vehicle documents.
 *
 * - Vercel Blob when BLOB_READ_WRITE_TOKEN is set. Blobs are stored with `access: 'private'`;
 *   downloads use short-lived presigned GET URLs (issueSignedToken + presignUrl, @vercel/blob 2.9).
 *   Docs: https://vercel.com/docs/vercel-blob/using-blob-sdk
 *   LIMITATION: Vercel server uploads cap the request body at 4.5 MB (see @vercel/blob README),
 *   so the 10 MB limit only holds off-Vercel until client uploads are added.
 * - In-memory store for tests (setFileStore(new MemoryFileStore())).
 * - Otherwise getFileStore() throws 503 not_configured.
 */
import { AppError } from '@/models/errors';

export interface FileStore {
  put(key: string, body: Blob | ArrayBuffer | Uint8Array, contentType: string): Promise<{ key: string; url: string }>;
  delete(key: string): Promise<void>;
  /** A URL the browser can fetch the file from (short-lived for private stores). */
  getDownloadUrl(key: string): Promise<string>;
}

export class MemoryFileStore implements FileStore {
  readonly files = new Map<string, { body: Uint8Array; contentType: string }>();

  async put(key: string, body: Blob | ArrayBuffer | Uint8Array, contentType: string) {
    const bytes = body instanceof Blob ? new Uint8Array(await body.arrayBuffer()) : body instanceof Uint8Array ? body : new Uint8Array(body);
    this.files.set(key, { body: bytes, contentType });
    return { key, url: `memory://${key}` };
  }

  async delete(key: string) {
    this.files.delete(key);
  }

  async getDownloadUrl(key: string) {
    return `memory://${key}`;
  }
}

const DOWNLOAD_URL_TTL_MS = 10 * 60 * 1000;

export class VercelBlobFileStore implements FileStore {
  constructor(private readonly token: string) {}

  async put(key: string, body: Blob | ArrayBuffer | Uint8Array, contentType: string) {
    const { put } = await import('@vercel/blob');
    const data = body instanceof Uint8Array ? Buffer.from(body) : body instanceof ArrayBuffer ? Buffer.from(body) : body;
    const res = await put(key, data, { access: 'private', contentType, token: this.token, addRandomSuffix: false });
    return { key: res.pathname, url: res.url };
  }

  async delete(key: string) {
    const { del } = await import('@vercel/blob');
    await del(key, { token: this.token });
  }

  async getDownloadUrl(key: string) {
    const { issueSignedToken, presignUrl } = await import('@vercel/blob');
    const validUntil = Date.now() + DOWNLOAD_URL_TTL_MS;
    const signed = await issueSignedToken({ pathname: key, operations: ['get'], validUntil, token: this.token });
    const { presignedUrl } = await presignUrl(signed, { operation: 'get', pathname: key, access: 'private', validUntil });
    return presignedUrl;
  }
}

let override: FileStore | null = null;

/** Tests install a MemoryFileStore here. Pass null to restore env-based selection. */
export function setFileStore(store: FileStore | null) {
  override = store;
}

export function isFileStoreConfigured(): boolean {
  return !!override || !!process.env.BLOB_READ_WRITE_TOKEN;
}

export function getFileStore(): FileStore {
  if (override) return override;
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) return new VercelBlobFileStore(token);
  throw new AppError(503, 'not_configured', 'File uploads are not configured on this server (BLOB_READ_WRITE_TOKEN missing).');
}
