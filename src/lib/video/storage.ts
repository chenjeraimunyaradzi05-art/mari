import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '@/lib/logger';

const bucket = process.env.S3_BUCKET;
const region = process.env.S3_REGION || process.env.AWS_REGION;
const endpoint = process.env.S3_ENDPOINT; // allow R2/MinIO
const usePathStyle = process.env.S3_PATH_STYLE === 'true';

let s3: S3Client | null = null;
if (bucket && region) {
  s3 = new S3Client({ region, endpoint, forcePathStyle: usePathStyle });
}

export type UploadResult = { url: string; key: string };

export async function uploadIfConfigured(localPath: string, key: string, contentType?: string, cacheControl = 'public, max-age=31536000, immutable'): Promise<UploadResult> {
  if (!s3 || !bucket) {
    const fileUrl = `file://${localPath}`;
    logger.info('S3 not configured; returning local file url', { key, fileUrl });
    return { url: fileUrl, key };
  }

  const fileStream = createReadStream(localPath);
  const size = (await stat(localPath)).size;

  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: fileStream,
    ContentLength: size,
    CacheControl: cacheControl,
    ContentType: contentType,
  }));

  const url = endpoint
    ? `${endpoint.replace(/\/$/, '')}/${bucket}/${key}`
    : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

  return { url, key };
}
