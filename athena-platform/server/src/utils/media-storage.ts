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
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { logger } from './logger';

const BUCKET_NAME = process.env.S3_BUCKET || 'athena-media';
const CDN_URL = process.env.CDN_URL || `https://${BUCKET_NAME}.s3.amazonaws.com`;
export const LOCAL_UPLOADS_ROOT = path.resolve(process.cwd(), 'uploads');

let s3: S3Client | null = null;

function hasS3Credentials(): boolean {
  return !!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY;
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

export function localFileUrl(key: string): string {
  return `${apiUrl()}/uploads/${normalizeKey(key)}`;
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

export async function storeBuffer(key: string, body: Buffer, contentType: string): Promise<string> {
  const normalized = normalizeKey(key);

  if (hasS3Credentials()) {
    try {
      await s3Client().send(
        new PutObjectCommand({ Bucket: BUCKET_NAME, Key: normalized, Body: body, ContentType: contentType })
      );
      return `${CDN_URL}/${normalized}`;
    } catch (error) {
      logger.warn('S3 write failed, storing locally instead', {
        key: normalized,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const filePath = localFilePath(normalized);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, body);
  return localFileUrl(normalized);
}

export async function storeFile(key: string, filePath: string, contentType: string): Promise<string> {
  return storeBuffer(key, fs.readFileSync(filePath), contentType);
}
