/**
 * Where processed media goes.
 *
 * The upload route stores what the browser sent; the video pipeline and the
 * sound extractor produce new files on the server and need the same home for
 * them: S3 when credentials are configured, the local uploads directory the
 * API serves at /uploads otherwise. Both paths return a URL the client can
 * load directly.
 */

import fs from 'fs';
import path from 'path';
import { HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { logger } from './logger';
import { recordCondition } from './ops-metrics';

const BUCKET_NAME = process.env.S3_BUCKET || 'athena-media';
const CDN_URL = process.env.CDN_URL || `https://${BUCKET_NAME}.s3.amazonaws.com`;
export const LOCAL_UPLOADS_ROOT = path.resolve(process.cwd(), 'uploads');

/** The gauge /health/detailed shows: 1 while the bucket cannot be reached, 0 once it can. */
export const MEDIA_STORAGE_CONDITION = 'media-storage.s3-unreachable';

let s3: S3Client | null = null;

export function hasS3Credentials(): boolean {
  return !!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY;
}

/**
 * Whether a failed S3 write may land on this host's disk instead.
 *
 * It used to, everywhere. The uploads directory is scratch space in a
 * container that Render and Fly replace on every deploy and that a second
 * instance cannot read (see the Dockerfile and fly.toml), so in production a
 * write that "fell back" was a write that succeeded, returned a URL, was saved
 * on the member's row — and was gone at the next deploy. With credentials that
 * cannot work, the placeholder from the env template for one, that was every
 * reel rendition and every extracted sound. In production the failure is now
 * the answer: the caller records it, and the video pipeline publishes the
 * upload as received with the reason attached. Outside production the disk is
 * where a developer's files live anyway, so the fallback stays.
 */
function mayFallBackToLocalDisk(): boolean {
  return process.env.NODE_ENV !== 'production';
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** What a failed S3 write becomes: a thrown error in production, a warning and the local disk elsewhere. */
function onS3WriteFailure(key: string, error: unknown): void {
  if (!mayFallBackToLocalDisk()) {
    logger.error('S3 write failed; not storing on the container disk, which the next deploy wipes', {
      key,
      bucket: BUCKET_NAME,
      error: messageOf(error),
    });
    throw new Error(`Media storage is unavailable: the write to S3 failed (${messageOf(error)})`);
  }
  logger.warn('S3 write failed, storing locally instead (outside production only)', { key, error: messageOf(error) });
}

function s3Client(): S3Client {
  if (!s3) {
    s3 = new S3Client({
      region: process.env.AWS_REGION || 'ap-southeast-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }
  return s3;
}

function normalizeKey(key: string): string {
  return key.replace(/\\/g, '/').replace(/^\/+/, '');
}

export function apiUrl(): string {
  return (process.env.API_URL || 'http://localhost:5000').replace(/\/$/, '');
}

const LOOPBACK_HOSTS = /^(?:https?:\/\/)?(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?$/i;

/**
 * The URL a locally stored file is served from.
 *
 * This string is written into the database row — the avatar, the post image,
 * the résumé, the reel thumbnail — so it is not a setting that can be
 * corrected after the fact. A host that stored uploads with API_URL unset
 * persisted `http://localhost:5000/uploads/...` on every one of those rows,
 * and fixing the variable afterwards did nothing for the files already
 * saved: they stay broken for their owners forever.
 *
 * env.ts now refuses to start a production process without a real API_URL,
 * and this refuses to write the row if one ever gets past it. A failed upload
 * she can retry is better than a picture that silently never loads again.
 */
export function localFileUrl(key: string): string {
  const base = apiUrl();
  if (process.env.NODE_ENV === 'production' && LOOPBACK_HOSTS.test(base)) {
    throw new Error(
      'Refusing to store media against a loopback API_URL: the URL is persisted on the row and would be permanently broken. Set API_URL to the address this API answers on.'
    );
  }
  return `${base}/uploads/${normalizeKey(key)}`;
}

/** Resolves a key under the uploads root, refusing anything that escapes it. */
export function localFilePath(key: string): string {
  const resolved = path.resolve(LOCAL_UPLOADS_ROOT, normalizeKey(key));
  if (resolved !== LOCAL_UPLOADS_ROOT && !resolved.startsWith(`${LOCAL_UPLOADS_ROOT}${path.sep}`)) {
    throw new Error('Invalid media key');
  }
  return resolved;
}

/**
 * If the URL points at a file this server stores locally, the path to it;
 * otherwise null and the caller downloads it.
 */
export function localPathForUrl(url: string): string | null {
  const prefix = `${apiUrl()}/uploads/`;
  let key: string | null = null;
  if (url.startsWith(prefix)) key = url.slice(prefix.length);
  else if (url.startsWith('/uploads/')) key = url.slice('/uploads/'.length);
  if (!key) return null;
  try {
    const filePath = localFilePath(decodeURIComponent(key));
    return fs.existsSync(filePath) ? filePath : null;
  } catch {
    return null;
  }
}

// Local writes are asynchronous. They were writeFileSync and readFileSync,
// and a reel rendition can be hundreds of megabytes: for the whole of that
// write the event loop answered nothing, /readyz included, so an orchestrator
// could decide the instance was dead and kill it mid-write.

export async function storeBuffer(key: string, body: Buffer, contentType: string): Promise<string> {
  const normalized = normalizeKey(key);

  if (hasS3Credentials()) {
    try {
      await s3Client().send(
        new PutObjectCommand({ Bucket: BUCKET_NAME, Key: normalized, Body: body, ContentType: contentType })
      );
      return `${CDN_URL}/${normalized}`;
    } catch (error) {
      onS3WriteFailure(normalized, error);
    }
  }

  const filePath = localFilePath(normalized);
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, body);
  return localFileUrl(normalized);
}

/**
 * Stores a file the server produced. Streamed rather than read into memory
 * first: this is how the video pipeline stores its renditions, and holding a
 * whole rendition in the heap to hand it to S3 is how one large reel took the
 * process's memory with it.
 */
export async function storeFile(key: string, filePath: string, contentType: string): Promise<string> {
  const normalized = normalizeKey(key);

  if (hasS3Credentials()) {
    try {
      const { size } = await fs.promises.stat(filePath);
      await s3Client().send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: normalized,
          Body: fs.createReadStream(filePath),
          ContentLength: size,
          ContentType: contentType,
        })
      );
      return `${CDN_URL}/${normalized}`;
    } catch (error) {
      onS3WriteFailure(normalized, error);
    }
  }

  const target = localFilePath(normalized);
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  await fs.promises.copyFile(filePath, target);
  return localFileUrl(normalized);
}

/**
 * Asks S3 whether the configured bucket can be reached with the configured
 * credentials, and records the answer where /health/detailed shows it.
 *
 * Nothing used to ask. The only check was that the two credential variables
 * were non-empty, which the placeholder values in the env template pass, so a
 * deployment could run for weeks with every media write failing and nothing
 * but a warning per upload to say so. Called once at startup; it never
 * throws, because a bucket that is briefly unreachable is not a reason to keep
 * the API down, and the gauge is what an operator reads.
 */
export async function probeMediaStorage(): Promise<{ reachable: boolean; detail: string }> {
  if (!hasS3Credentials()) {
    const detail =
      process.env.NODE_ENV === 'production'
        ? 'No S3 credentials are configured, so media is written to this container’s disk and lost at the next deploy.'
        : 'No S3 credentials are configured; media is stored on this machine’s disk (development).';
    if (process.env.NODE_ENV === 'production') {
      recordCondition(MEDIA_STORAGE_CONDITION, 1, detail);
      logger.error('Media storage probe: ' + detail);
    }
    return { reachable: false, detail };
  }
  try {
    await s3Client().send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    recordCondition(MEDIA_STORAGE_CONDITION, 0, null);
    logger.info('Media storage probe: S3 bucket reachable', { bucket: BUCKET_NAME });
    return { reachable: true, detail: `S3 bucket ${BUCKET_NAME} is reachable` };
  } catch (error) {
    const detail = `S3 bucket ${BUCKET_NAME} could not be reached with the configured credentials (${messageOf(error)}); every media write will fail until it can.`;
    recordCondition(MEDIA_STORAGE_CONDITION, 1, detail);
    logger.error('Media storage probe: ' + detail);
    return { reachable: false, detail };
  }
}
