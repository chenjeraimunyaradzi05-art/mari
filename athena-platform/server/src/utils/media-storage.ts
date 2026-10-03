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
import { randomUUID } from 'crypto';
import { DeleteObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { logger } from './logger';
import { recordCondition, recordFailure } from './ops-metrics';

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
 * The top-level folders of the bucket that hold private files.
 * Everything else the platform stores (avatars, covers, posts, videos,
 * thumbnails, captions, sounds) is public by design: it is shown to other
 * people, so it is served from the CDN. A résumé or a document is read only
 * through the API, by its owner or by hiring staff on an application it was
 * attached to (routes/media.routes.ts), and must never be reachable by its
 * address alone. A file sent in a conversation (chat/) is read only by the
 * people in that conversation, through a short-lived signed link the API mints
 * for each of them (services/chat-attachment.service.ts).
 *
 * That is a statement about the bucket as much as about this code, so the same
 * list is what the bucket policy has to agree with: public reads on the other
 * folders only, none on these. infrastructure/README.md ("Media bucket") says
 * how to set that up, and checkMediaExposure below proves it from the outside.
 */
export const PRIVATE_MEDIA_FOLDERS: ReadonlySet<string> = new Set(['resumes', 'documents', 'chat']);

/** Whether a storage key sits in one of the private folders. */
export function isPrivateMediaKey(key: string): boolean {
  return PRIVATE_MEDIA_FOLDERS.has(normalizeKey(key).split('/')[0]);
}

/** The address of an object in the bucket itself, which is never publicly readable for the private folders. */
export function bucketObjectUrl(key: string): string {
  const region = process.env.AWS_REGION || 'ap-southeast-2';
  return `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${normalizeKey(key)}`;
}

/** The address of an object through the CDN (or, with none configured, the bucket's own public address). */
export function cdnObjectUrl(key: string): string {
  return `${CDN_URL.replace(/\/+$/, '')}/${normalizeKey(key)}`;
}

/**
 * The URL a stored object is known by, which is what lands in a database row.
 *
 * A public file is addressed through the CDN. A private one is addressed at the
 * bucket itself: the URL still ends in its key, which is what the readers of
 * these rows look for (uploadKeyFromUrl on the web, isHiringReaderOfResume in
 * the media routes), but it is not a link anyone can open. It used to be
 * `${CDN_URL}/key` for everything, so a CDN put in front of the whole bucket
 * published every résumé to anybody holding the address.
 */
export function mediaUrlForKey(key: string): string {
  return isPrivateMediaKey(key) ? bucketObjectUrl(key) : cdnObjectUrl(key);
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
export function mayFallBackToLocalDisk(): boolean {
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
      return mediaUrlForKey(normalized);
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
      return mediaUrlForKey(normalized);
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
 * Removes the object stored under a key, from the bucket and from this host's
 * disk (where a development machine keeps it). True when something was removed.
 *
 * It never throws: a file already gone, or a bucket that refuses, must not stop
 * the row that pointed at it being deleted, because the row is the part a
 * member can still be identified from. A refusal is counted instead, so a
 * bucket that has started refusing every delete shows in the ops snapshot and
 * not as files that quietly stay.
 */
export async function deleteStoredKey(key: string): Promise<boolean> {
  const normalized = normalizeKey(key);
  let deleted = false;

  if (hasS3Credentials()) {
    try {
      await s3Client().send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: normalized }));
      deleted = true;
    } catch (error) {
      recordFailure('media-storage.delete', error);
      logger.warn('A stored file could not be removed from the bucket', { key: normalized, error: messageOf(error) });
    }
  }

  try {
    const filePath = localFilePath(normalized);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      deleted = true;
    }
  } catch (error) {
    recordFailure('media-storage.delete', error);
  }

  return deleted;
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

/** What checkMediaExposure found, in the words launch-readiness reports it in. */
export type MediaExposure =
  | { status: 'not_applicable'; detail: string; problems: [] }
  | { status: 'ok'; detail: string; problems: [] }
  | { status: 'exposed' | 'public_unreadable' | 'unverified'; detail: string; problems: string[] };

/** Written to the two probe objects, and looked for in what an anonymous request gets back. */
const EXPOSURE_PROBE_TEXT = 'ATHENA media exposure check. Safe to delete.';
const EXPOSURE_PROBE_FOLDER = '_exposure-check';

/**
 * Proves, from the outside, that the bucket and the CDN agree with the list of
 * private folders above.
 *
 * The code can only decide which URL to hand out. Whether a file is reachable
 * is decided by the bucket policy and by what the CDN is allowed to fetch, and
 * neither is visible from here: a CDN given access to the whole bucket would
 * publish every résumé to anybody who had its address, and a bucket kept fully
 * private with no CDN would break every avatar, and in both cases the
 * variables look right. So this writes one small probe object in a public
 * folder and one in a private folder, asks for each the way a stranger would
 * (no credentials, no cookie), and deletes both:
 *
 *   - the public probe must be readable at the address stored rows use;
 *   - the private probe must not be readable through the CDN address, and must
 *     not be readable at the bucket's own address.
 *
 * It needs the permissions the upload code already has (PutObject and
 * DeleteObject). It is run on request, as /health/launch-readiness?probe=media
 * behind the diagnostics token, and never on a request a member makes. A probe it cannot
 * write or delete is reported as unverified, not as fine.
 */
export async function checkMediaExposure(
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}
): Promise<MediaExposure> {
  if (!hasS3Credentials()) {
    return {
      status: 'not_applicable',
      detail: 'No S3 credentials are configured, so there is no bucket whose exposure could be checked.',
      problems: [],
    };
  }

  const doFetch = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 5_000;
  const id = randomUUID();
  const publicKey = `avatars/${EXPOSURE_PROBE_FOLDER}/${id}.txt`;
  const privateKey = `resumes/${EXPOSURE_PROBE_FOLDER}/${id}.txt`;
  const written: string[] = [];

  /**
   * What an anonymous request gets: the probe's own text back, an answer that is
   * not it (a refusal, an error page), or no answer at all. The last is its own
   * outcome: a request that timed out says nothing about whether the file is
   * readable, so it must never be taken for the file being safe.
   */
  const ask = async (url: string): Promise<'readable' | 'refused' | 'unreachable'> => {
    try {
      const response = await doFetch(url, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
      return response.ok && (await response.text()).includes(EXPOSURE_PROBE_TEXT) ? 'readable' : 'refused';
    } catch {
      return 'unreachable';
    }
  };

  try {
    for (const key of [publicKey, privateKey]) {
      await s3Client().send(
        new PutObjectCommand({ Bucket: BUCKET_NAME, Key: key, Body: EXPOSURE_PROBE_TEXT, ContentType: 'text/plain' })
      );
      written.push(key);
    }

    const problems: string[] = [];

    const publicUrl = mediaUrlForKey(publicKey);
    const publicAnswer = await ask(publicUrl);

    // The CDN address and the bucket address, once each when they are the same
    // thing (no CDN_URL set).
    const privateUrls = Array.from(new Set([cdnObjectUrl(privateKey), bucketObjectUrl(privateKey)]));
    const exposedAt: string[] = [];
    const notReached: string[] = [];
    if (publicAnswer === 'unreachable') notReached.push(publicUrl.replace(id, '<probe>'));
    for (const url of privateUrls) {
      const answer = await ask(url);
      if (answer === 'readable') exposedAt.push(url.replace(id, '<probe>'));
      else if (answer === 'unreachable') notReached.push(url.replace(id, '<probe>'));
    }

    if (exposedAt.length > 0) {
      problems.push(
        `Private files can be read by anyone who has the address: a probe in the ${Array.from(PRIVATE_MEDIA_FOLDERS).join('/')} ` +
          `folders was readable without signing in at ${exposedAt.join(' and ')}. Restrict the CDN and the bucket policy to the ` +
          'public folders only (infrastructure/README.md, "Media bucket").'
      );
    }
    if (notReached.length > 0) {
      problems.push(
        `No answer from ${notReached.join(' and ')} (the request failed or timed out), so what a stranger can read there is not known. ` +
          'Run the check again; if it keeps failing, check that this host can reach the CDN and the bucket.'
      );
    }
    if (publicAnswer === 'refused') {
      problems.push(
        `Public files cannot be read at the address stored rows use: a probe in a public folder was not readable at ${publicUrl.replace(id, '<probe>')}. ` +
          'Avatars, covers, post pictures and reels will not load until the CDN (or a bucket policy for the public folders) allows it.'
      );
    }

    // An exposed private folder outranks everything: it is the one finding that is
    // urgent whatever else could not be asked.
    if (exposedAt.length > 0) {
      return { status: 'exposed', detail: problems.join(' '), problems };
    }
    if (notReached.length > 0) {
      return { status: 'unverified', detail: problems.join(' '), problems };
    }
    if (publicAnswer === 'refused') {
      return { status: 'public_unreadable', detail: problems.join(' '), problems };
    }
    return {
      status: 'ok',
      detail: 'Public folders are readable at the address stored rows use, and the private folders are not readable without signing in.',
      problems: [],
    };
  } catch (error) {
    const detail = `The check could not be completed: ${messageOf(error)}. It needs the upload credentials to be able to write and delete a small probe object.`;
    return { status: 'unverified', detail, problems: [detail] };
  } finally {
    for (const key of written) {
      try {
        await s3Client().send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
      } catch (error) {
        logger.warn('Media exposure check: could not remove a probe object; it is safe to delete by hand', {
          key,
          error: messageOf(error),
        });
      }
    }
  }
}
