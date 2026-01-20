/**
 * S3 Storage Service
 * ==================
 * Handles file uploads to S3 with presigned URLs for direct client uploads.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

// ===========================================
// CONFIGURATION
// ===========================================

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-2',
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      }
    : undefined, // Use IAM role if no credentials
});

const BUCKETS = {
  MEDIA: process.env.S3_MEDIA_BUCKET || 'athena-media',
  UPLOADS: process.env.S3_UPLOADS_BUCKET || 'athena-uploads',
  EXPORTS: process.env.S3_EXPORTS_BUCKET || 'athena-exports',
  BACKUPS: process.env.S3_BACKUPS_BUCKET || 'athena-backups',
};

const CDN_URL = process.env.CDN_URL || `https://${BUCKETS.MEDIA}.s3.amazonaws.com`;
const PRESIGNED_URL_EXPIRY = 3600; // 1 hour

// ===========================================
// TYPES
// ===========================================

export interface UploadParams {
  bucket?: string;
  key: string;
  contentType: string;
  metadata?: Record<string, string>;
  acl?: 'private' | 'public-read';
}

export interface PresignedUploadResult {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  expiresAt: Date;
}

export interface FileInfo {
  key: string;
  size: number;
  lastModified: Date;
  contentType?: string;
  metadata?: Record<string, string>;
}

// ===========================================
// UPLOAD FUNCTIONS
// ===========================================

/**
 * Generate a presigned URL for direct client upload
 */
export async function getPresignedUploadUrl(
  params: UploadParams
): Promise<PresignedUploadResult> {
  const bucket = params.bucket || BUCKETS.UPLOADS;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: params.key,
    ContentType: params.contentType,
    Metadata: params.metadata,
    ACL: params.acl || 'private',
  });

  const uploadUrl = await getSignedUrl(s3Client, command, {
    expiresIn: PRESIGNED_URL_EXPIRY,
  });

  const expiresAt = new Date(Date.now() + PRESIGNED_URL_EXPIRY * 1000);

  return {
    uploadUrl,
    key: params.key,
    publicUrl: `${CDN_URL}/${params.key}`,
    expiresAt,
  };
}

/**
 * Generate a presigned URL for downloading/viewing
 */
export async function getPresignedDownloadUrl(
  key: string,
  bucket?: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket || BUCKETS.MEDIA,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Upload a file directly from the server
 */
export async function uploadFile(
  buffer: Buffer,
  key: string,
  contentType: string,
  bucket?: string,
  metadata?: Record<string, string>
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket || BUCKETS.MEDIA,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    Metadata: metadata,
  });

  await s3Client.send(command);
  logger.info('File uploaded to S3', { key, bucket: bucket || BUCKETS.MEDIA });

  return `${CDN_URL}/${key}`;
}

// ===========================================
// VIDEO-SPECIFIC FUNCTIONS
// ===========================================

/**
 * Generate upload URL for video with appropriate settings
 */
export async function getVideoUploadUrl(
  userId: string,
  filename: string,
  contentType: string
): Promise<PresignedUploadResult> {
  const ext = filename.split('.').pop() || 'mp4';
  const key = `videos/raw/${userId}/${uuidv4()}.${ext}`;

  return getPresignedUploadUrl({
    bucket: BUCKETS.UPLOADS,
    key,
    contentType,
    metadata: {
      'x-amz-meta-user-id': userId,
      'x-amz-meta-original-filename': filename,
      'x-amz-meta-upload-time': new Date().toISOString(),
    },
  });
}

/**
 * Generate upload URL for profile/media images
 */
export async function getImageUploadUrl(
  userId: string,
  type: 'avatar' | 'cover' | 'post' | 'message',
  contentType: string
): Promise<PresignedUploadResult> {
  const ext = contentType.split('/')[1] || 'jpg';
  const key = `images/${type}/${userId}/${uuidv4()}.${ext}`;

  return getPresignedUploadUrl({
    bucket: BUCKETS.MEDIA,
    key,
    contentType,
    acl: 'public-read',
  });
}

/**
 * Generate upload URL for documents
 */
export async function getDocumentUploadUrl(
  userId: string,
  filename: string,
  contentType: string
): Promise<PresignedUploadResult> {
  const key = `documents/${userId}/${uuidv4()}-${filename}`;

  return getPresignedUploadUrl({
    bucket: BUCKETS.UPLOADS,
    key,
    contentType,
    metadata: {
      'x-amz-meta-user-id': userId,
      'x-amz-meta-original-filename': filename,
    },
  });
}

// ===========================================
// FILE MANAGEMENT
// ===========================================

/**
 * Check if a file exists
 */
export async function fileExists(key: string, bucket?: string): Promise<boolean> {
  try {
    const command = new HeadObjectCommand({
      Bucket: bucket || BUCKETS.MEDIA,
      Key: key,
    });
    await s3Client.send(command);
    return true;
  } catch (error: any) {
    if (error.name === 'NotFound') {
      return false;
    }
    throw error;
  }
}

/**
 * Get file info
 */
export async function getFileInfo(key: string, bucket?: string): Promise<FileInfo | null> {
  try {
    const command = new HeadObjectCommand({
      Bucket: bucket || BUCKETS.MEDIA,
      Key: key,
    });
    const response = await s3Client.send(command);

    return {
      key,
      size: response.ContentLength || 0,
      lastModified: response.LastModified || new Date(),
      contentType: response.ContentType,
      metadata: response.Metadata,
    };
  } catch (error: any) {
    if (error.name === 'NotFound') {
      return null;
    }
    throw error;
  }
}

/**
 * Delete a file
 */
export async function deleteFile(key: string, bucket?: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: bucket || BUCKETS.MEDIA,
    Key: key,
  });
  await s3Client.send(command);
  logger.info('File deleted from S3', { key });
}

/**
 * Copy a file within S3
 */
export async function copyFile(
  sourceKey: string,
  destKey: string,
  sourceBucket?: string,
  destBucket?: string
): Promise<void> {
  const srcBucket = sourceBucket || BUCKETS.MEDIA;
  const dstBucket = destBucket || BUCKETS.MEDIA;

  const command = new CopyObjectCommand({
    Bucket: dstBucket,
    Key: destKey,
    CopySource: `${srcBucket}/${sourceKey}`,
  });

  await s3Client.send(command);
  logger.info('File copied in S3', { sourceKey, destKey });
}

/**
 * Move a file from uploads to media (after processing)
 */
export async function moveToMedia(uploadKey: string, mediaKey: string): Promise<string> {
  await copyFile(uploadKey, mediaKey, BUCKETS.UPLOADS, BUCKETS.MEDIA);
  await deleteFile(uploadKey, BUCKETS.UPLOADS);
  return `${CDN_URL}/${mediaKey}`;
}

/**
 * List files in a prefix
 */
export async function listFiles(
  prefix: string,
  bucket?: string,
  maxKeys: number = 100
): Promise<FileInfo[]> {
  const command = new ListObjectsV2Command({
    Bucket: bucket || BUCKETS.MEDIA,
    Prefix: prefix,
    MaxKeys: maxKeys,
  });

  const response = await s3Client.send(command);

  return (response.Contents || []).map((obj) => ({
    key: obj.Key || '',
    size: obj.Size || 0,
    lastModified: obj.LastModified || new Date(),
  }));
}

// ===========================================
// CDN URL HELPERS
// ===========================================

/**
 * Get public CDN URL for a key
 */
export function getCdnUrl(key: string): string {
  return `${CDN_URL}/${key}`;
}

/**
 * Extract key from a CDN URL
 */
export function getKeyFromUrl(url: string): string | null {
  if (url.startsWith(CDN_URL)) {
    return url.slice(CDN_URL.length + 1);
  }
  return null;
}

// ===========================================
// EXPORT BUCKET CONFIG
// ===========================================

export { BUCKETS, CDN_URL };
