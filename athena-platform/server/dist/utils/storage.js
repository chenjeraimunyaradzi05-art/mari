"use strict";
/**
 * S3 Storage Service
 * ==================
 * Handles file uploads to S3 with presigned URLs for direct client uploads.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CDN_URL = exports.BUCKETS = void 0;
exports.getPresignedUploadUrl = getPresignedUploadUrl;
exports.getPresignedDownloadUrl = getPresignedDownloadUrl;
exports.uploadFile = uploadFile;
exports.getVideoUploadUrl = getVideoUploadUrl;
exports.getImageUploadUrl = getImageUploadUrl;
exports.getDocumentUploadUrl = getDocumentUploadUrl;
exports.fileExists = fileExists;
exports.getFileInfo = getFileInfo;
exports.deleteFile = deleteFile;
exports.copyFile = copyFile;
exports.moveToMedia = moveToMedia;
exports.listFiles = listFiles;
exports.getCdnUrl = getCdnUrl;
exports.getKeyFromUrl = getKeyFromUrl;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const logger_1 = require("../utils/logger");
const uuid_1 = require("uuid");
// ===========================================
// CONFIGURATION
// ===========================================
const s3Client = new client_s3_1.S3Client({
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
exports.BUCKETS = BUCKETS;
const CDN_URL = process.env.CDN_URL || `https://${BUCKETS.MEDIA}.s3.amazonaws.com`;
exports.CDN_URL = CDN_URL;
const PRESIGNED_URL_EXPIRY = 3600; // 1 hour
// ===========================================
// UPLOAD FUNCTIONS
// ===========================================
/**
 * Generate a presigned URL for direct client upload
 */
async function getPresignedUploadUrl(params) {
    const bucket = params.bucket || BUCKETS.UPLOADS;
    const command = new client_s3_1.PutObjectCommand({
        Bucket: bucket,
        Key: params.key,
        ContentType: params.contentType,
        Metadata: params.metadata,
        ACL: params.acl || 'private',
    });
    const uploadUrl = await (0, s3_request_presigner_1.getSignedUrl)(s3Client, command, {
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
async function getPresignedDownloadUrl(key, bucket, expiresIn = 3600) {
    const command = new client_s3_1.GetObjectCommand({
        Bucket: bucket || BUCKETS.MEDIA,
        Key: key,
    });
    return (0, s3_request_presigner_1.getSignedUrl)(s3Client, command, { expiresIn });
}
/**
 * Upload a file directly from the server
 */
async function uploadFile(buffer, key, contentType, bucket, metadata) {
    const command = new client_s3_1.PutObjectCommand({
        Bucket: bucket || BUCKETS.MEDIA,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: metadata,
    });
    await s3Client.send(command);
    logger_1.logger.info('File uploaded to S3', { key, bucket: bucket || BUCKETS.MEDIA });
    return `${CDN_URL}/${key}`;
}
// ===========================================
// VIDEO-SPECIFIC FUNCTIONS
// ===========================================
/**
 * Generate upload URL for video with appropriate settings
 */
async function getVideoUploadUrl(userId, filename, contentType) {
    const ext = filename.split('.').pop() || 'mp4';
    const key = `videos/raw/${userId}/${(0, uuid_1.v4)()}.${ext}`;
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
async function getImageUploadUrl(userId, type, contentType) {
    const ext = contentType.split('/')[1] || 'jpg';
    const key = `images/${type}/${userId}/${(0, uuid_1.v4)()}.${ext}`;
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
async function getDocumentUploadUrl(userId, filename, contentType) {
    const key = `documents/${userId}/${(0, uuid_1.v4)()}-${filename}`;
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
async function fileExists(key, bucket) {
    try {
        const command = new client_s3_1.HeadObjectCommand({
            Bucket: bucket || BUCKETS.MEDIA,
            Key: key,
        });
        await s3Client.send(command);
        return true;
    }
    catch (error) {
        if (error.name === 'NotFound') {
            return false;
        }
        throw error;
    }
}
/**
 * Get file info
 */
async function getFileInfo(key, bucket) {
    try {
        const command = new client_s3_1.HeadObjectCommand({
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
    }
    catch (error) {
        if (error.name === 'NotFound') {
            return null;
        }
        throw error;
    }
}
/**
 * Delete a file
 */
async function deleteFile(key, bucket) {
    const command = new client_s3_1.DeleteObjectCommand({
        Bucket: bucket || BUCKETS.MEDIA,
        Key: key,
    });
    await s3Client.send(command);
    logger_1.logger.info('File deleted from S3', { key });
}
/**
 * Copy a file within S3
 */
async function copyFile(sourceKey, destKey, sourceBucket, destBucket) {
    const srcBucket = sourceBucket || BUCKETS.MEDIA;
    const dstBucket = destBucket || BUCKETS.MEDIA;
    const command = new client_s3_1.CopyObjectCommand({
        Bucket: dstBucket,
        Key: destKey,
        CopySource: `${srcBucket}/${sourceKey}`,
    });
    await s3Client.send(command);
    logger_1.logger.info('File copied in S3', { sourceKey, destKey });
}
/**
 * Move a file from uploads to media (after processing)
 */
async function moveToMedia(uploadKey, mediaKey) {
    await copyFile(uploadKey, mediaKey, BUCKETS.UPLOADS, BUCKETS.MEDIA);
    await deleteFile(uploadKey, BUCKETS.UPLOADS);
    return `${CDN_URL}/${mediaKey}`;
}
/**
 * List files in a prefix
 */
async function listFiles(prefix, bucket, maxKeys = 100) {
    const command = new client_s3_1.ListObjectsV2Command({
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
function getCdnUrl(key) {
    return `${CDN_URL}/${key}`;
}
/**
 * Extract key from a CDN URL
 */
function getKeyFromUrl(url) {
    if (url.startsWith(CDN_URL)) {
        return url.slice(CDN_URL.length + 1);
    }
    return null;
}
//# sourceMappingURL=storage.js.map