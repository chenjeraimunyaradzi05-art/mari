/**
 * S3 Storage Service
 * ==================
 * Handles file uploads to S3 with presigned URLs for direct client uploads.
 */
declare const BUCKETS: {
    MEDIA: string;
    UPLOADS: string;
    EXPORTS: string;
    BACKUPS: string;
};
declare const CDN_URL: string;
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
/**
 * Generate a presigned URL for direct client upload
 */
export declare function getPresignedUploadUrl(params: UploadParams): Promise<PresignedUploadResult>;
/**
 * Generate a presigned URL for downloading/viewing
 */
export declare function getPresignedDownloadUrl(key: string, bucket?: string, expiresIn?: number): Promise<string>;
/**
 * Upload a file directly from the server
 */
export declare function uploadFile(buffer: Buffer, key: string, contentType: string, bucket?: string, metadata?: Record<string, string>): Promise<string>;
/**
 * Generate upload URL for video with appropriate settings
 */
export declare function getVideoUploadUrl(userId: string, filename: string, contentType: string): Promise<PresignedUploadResult>;
/**
 * Generate upload URL for profile/media images
 */
export declare function getImageUploadUrl(userId: string, type: 'avatar' | 'cover' | 'post' | 'message', contentType: string): Promise<PresignedUploadResult>;
/**
 * Generate upload URL for documents
 */
export declare function getDocumentUploadUrl(userId: string, filename: string, contentType: string): Promise<PresignedUploadResult>;
/**
 * Check if a file exists
 */
export declare function fileExists(key: string, bucket?: string): Promise<boolean>;
/**
 * Get file info
 */
export declare function getFileInfo(key: string, bucket?: string): Promise<FileInfo | null>;
/**
 * Delete a file
 */
export declare function deleteFile(key: string, bucket?: string): Promise<void>;
/**
 * Copy a file within S3
 */
export declare function copyFile(sourceKey: string, destKey: string, sourceBucket?: string, destBucket?: string): Promise<void>;
/**
 * Move a file from uploads to media (after processing)
 */
export declare function moveToMedia(uploadKey: string, mediaKey: string): Promise<string>;
/**
 * List files in a prefix
 */
export declare function listFiles(prefix: string, bucket?: string, maxKeys?: number): Promise<FileInfo[]>;
/**
 * Get public CDN URL for a key
 */
export declare function getCdnUrl(key: string): string;
/**
 * Extract key from a CDN URL
 */
export declare function getKeyFromUrl(url: string): string | null;
export { BUCKETS, CDN_URL };
//# sourceMappingURL=storage.d.ts.map