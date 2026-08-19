"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const sharp_1 = __importDefault(require("sharp"));
const uuid_1 = require("uuid");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const prisma_1 = require("../utils/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const logger_1 = require("../utils/logger");
const moderation_service_1 = require("../services/moderation.service");
const router = (0, express_1.Router)();
// Configure S3 client
const s3Client = new client_s3_1.S3Client({
    region: process.env.AWS_REGION || 'ap-southeast-2',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});
const BUCKET_NAME = process.env.S3_BUCKET || 'athena-media';
const CDN_URL = process.env.CDN_URL || `https://${BUCKET_NAME}.s3.amazonaws.com`;
// File type configurations
const FILE_CONFIGS = {
    avatar: {
        maxSize: 5 * 1024 * 1024, // 5MB
        allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
        folder: 'avatars',
        resize: { width: 400, height: 400 },
        visibility: 'public',
    },
    cover: {
        maxSize: 10 * 1024 * 1024, // 10MB
        allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
        folder: 'covers',
        resize: { width: 1500, height: 500 },
        visibility: 'public',
    },
    post: {
        maxSize: 20 * 1024 * 1024, // 20MB
        allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        folder: 'posts',
        resize: { width: 1200, height: 1200 },
        visibility: 'public',
    },
    video: {
        maxSize: 500 * 1024 * 1024, // 500MB
        allowedTypes: ['video/mp4', 'video/quicktime', 'video/webm'],
        folder: 'videos',
        resize: null,
        visibility: 'public',
    },
    document: {
        maxSize: 25 * 1024 * 1024, // 25MB
        allowedTypes: [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        folder: 'documents',
        resize: null,
        visibility: 'private',
    },
    resume: {
        maxSize: 10 * 1024 * 1024, // 10MB
        allowedTypes: [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        folder: 'resumes',
        resize: null,
        visibility: 'private',
    },
};
const CONTENT_TYPE_EXTENSIONS = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
    'video/webm': '.webm',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};
const LOCAL_UPLOADS_ROOT = path_1.default.resolve(process.cwd(), 'uploads');
const VALID_UPLOAD_FOLDERS = new Set(Object.values(FILE_CONFIGS).map((config) => config.folder));
const PRIVATE_UPLOAD_FOLDERS = new Set(Object.values(FILE_CONFIGS)
    .filter((config) => config.visibility === 'private')
    .map((config) => config.folder));
// Configure multer for memory storage
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 500 * 1024 * 1024, // 500MB max (for videos)
    },
});
function hasS3Credentials() {
    return !!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY;
}
function getSafeExtensionForContentType(contentType) {
    return CONTENT_TYPE_EXTENSIONS[contentType] || '.bin';
}
function normalizeUploadKey(key) {
    return key.replace(/\\/g, '/').replace(/^\/+/, '');
}
function resolveLocalFilePath(key) {
    const normalizedKey = normalizeUploadKey(key);
    const filePath = path_1.default.resolve(LOCAL_UPLOADS_ROOT, normalizedKey);
    if (filePath !== LOCAL_UPLOADS_ROOT &&
        !filePath.startsWith(`${LOCAL_UPLOADS_ROOT}${path_1.default.sep}`)) {
        throw new errorHandler_1.ApiError(400, 'Invalid file path');
    }
    return filePath;
}
function buildLocalFileUrl(key, visibility) {
    const apiUrl = process.env.API_URL || 'http://localhost:5000';
    const normalizedKey = normalizeUploadKey(key);
    if (visibility === 'private') {
        return `${apiUrl}/api/media/local/${normalizedKey}`;
    }
    return `${apiUrl}/uploads/${normalizedKey}`;
}
function validateOwnedUploadKey(key, userId) {
    const normalizedKey = normalizeUploadKey(key);
    const keyParts = normalizedKey.split('/');
    if (keyParts.length < 3 || !keyParts[2]) {
        throw new errorHandler_1.ApiError(400, 'Invalid file key format');
    }
    const [folder, userIdInPath] = keyParts;
    if (!VALID_UPLOAD_FOLDERS.has(folder)) {
        throw new errorHandler_1.ApiError(400, 'Invalid file path');
    }
    if (userIdInPath !== userId) {
        logger_1.logger.warn('Unauthorized file access attempt', {
            userId,
            attemptedKey: normalizedKey,
            keyUserId: userIdInPath,
        });
        throw new errorHandler_1.ApiError(403, 'Not authorized to access this file');
    }
    return { normalizedKey, folder };
}
function hasLocalFile(key) {
    try {
        return fs_1.default.existsSync(resolveLocalFilePath(key));
    }
    catch {
        return false;
    }
}
async function saveFileLocally(buffer, key, visibility) {
    const filePath = resolveLocalFilePath(key);
    const dir = path_1.default.dirname(filePath);
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
    fs_1.default.writeFileSync(filePath, buffer);
    logger_1.logger.info('File saved locally', { filePath, key, visibility });
    return buildLocalFileUrl(key, visibility);
}
async function deleteLocalFileIfPresent(key) {
    const filePath = resolveLocalFilePath(key);
    if (!fs_1.default.existsSync(filePath)) {
        return false;
    }
    fs_1.default.unlinkSync(filePath);
    logger_1.logger.info('Local file deleted', { filePath, key });
    return true;
}
// ===========================================
// GET PRESIGNED UPLOAD URL
// ===========================================
router.post('/presigned-url', auth_1.authenticate, async (req, res, next) => {
    try {
        const { fileType, fileName, contentType } = req.body;
        if (!fileType || !fileName || !contentType) {
            throw new errorHandler_1.ApiError(400, 'fileType, fileName, and contentType are required');
        }
        const config = FILE_CONFIGS[fileType];
        if (!config) {
            throw new errorHandler_1.ApiError(400, 'Invalid file type');
        }
        if (!config.allowedTypes.includes(contentType)) {
            throw new errorHandler_1.ApiError(400, `Invalid content type for ${fileType}`);
        }
        const fileExtension = getSafeExtensionForContentType(contentType);
        const key = `${config.folder}/${req.user.id}/${(0, uuid_1.v4)()}${fileExtension}`;
        const command = new client_s3_1.PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            ContentType: contentType,
            Metadata: {
                userId: req.user.id,
                originalName: fileName,
            },
        });
        const signedUrl = await (0, s3_request_presigner_1.getSignedUrl)(s3Client, command, { expiresIn: 3600 });
        res.json({
            success: true,
            data: {
                uploadUrl: signedUrl,
                key,
                publicUrl: `${CDN_URL}/${key}`,
                expiresIn: 3600,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// UPLOAD FILE (Direct Upload)
// ===========================================
router.post('/upload/:type', auth_1.authenticate, upload.single('file'), async (req, res, next) => {
    try {
        const { type } = req.params;
        const file = req.file;
        logger_1.logger.info(`Upload request received: type=${type}, hasFile=${!!file}`);
        if (!file) {
            throw new errorHandler_1.ApiError(400, 'No file provided');
        }
        logger_1.logger.info(`File details: name=${file.originalname}, size=${file.size}, mimetype=${file.mimetype}`);
        const config = FILE_CONFIGS[type];
        if (!config) {
            throw new errorHandler_1.ApiError(400, 'Invalid upload type');
        }
        if (!config.allowedTypes.includes(file.mimetype)) {
            throw new errorHandler_1.ApiError(400, `Invalid file type. Allowed: ${config.allowedTypes.join(', ')}`);
        }
        if (file.size > config.maxSize) {
            throw new errorHandler_1.ApiError(400, `File too large. Max size: ${config.maxSize / (1024 * 1024)}MB`);
        }
        let processedBuffer = file.buffer;
        let contentType = file.mimetype;
        if (file.mimetype.startsWith('image/')) {
            const moderationResult = await (0, moderation_service_1.moderateImage)(file.buffer);
            if (moderationResult.action === 'block') {
                logger_1.logger.warn('Image upload blocked by moderation', {
                    userId: req.user?.id,
                    reason: moderationResult.reason,
                });
                throw new errorHandler_1.ApiError(400, `Image rejected: ${moderationResult.reason}`);
            }
        }
        if (config.resize &&
            file.mimetype.startsWith('image/') &&
            !file.mimetype.includes('gif')) {
            processedBuffer = await (0, sharp_1.default)(file.buffer)
                .resize(config.resize.width, config.resize.height, {
                fit: 'cover',
                position: 'center',
            })
                .webp({ quality: 85 })
                .toBuffer();
            contentType = 'image/webp';
        }
        const fileExtension = contentType === 'image/webp'
            ? '.webp'
            : getSafeExtensionForContentType(contentType);
        const key = `${config.folder}/${req.user.id}/${(0, uuid_1.v4)()}${fileExtension}`;
        let publicUrl;
        logger_1.logger.info(`AWS credentials check: hasKeyId=${!!process.env.AWS_ACCESS_KEY_ID}, hasSecret=${!!process.env.AWS_SECRET_ACCESS_KEY}`);
        if (hasS3Credentials()) {
            try {
                await s3Client.send(new client_s3_1.PutObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: key,
                    Body: processedBuffer,
                    ContentType: contentType,
                    Metadata: {
                        userId: req.user.id,
                        originalName: file.originalname,
                    },
                }));
                publicUrl = `${CDN_URL}/${key}`;
            }
            catch (s3Error) {
                logger_1.logger.warn(`S3 upload failed, falling back to local storage: ${s3Error.message}`);
                publicUrl = await saveFileLocally(processedBuffer, key, config.visibility);
            }
        }
        else {
            publicUrl = await saveFileLocally(processedBuffer, key, config.visibility);
        }
        if (type === 'avatar') {
            await prisma_1.prisma.user.update({
                where: { id: req.user.id },
                data: { avatar: publicUrl },
            });
        }
        logger_1.logger.info(`File uploaded: ${key} by user ${req.user.id}`);
        res.json({
            success: true,
            data: {
                key,
                url: publicUrl,
                contentType,
                size: processedBuffer.length,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// DELETE FILE
// ===========================================
router.delete('/delete', auth_1.authenticate, async (req, res, next) => {
    try {
        const { key } = req.body;
        if (!key) {
            throw new errorHandler_1.ApiError(400, 'File key is required');
        }
        const { normalizedKey } = validateOwnedUploadKey(key, req.user.id);
        let deletedFromS3 = false;
        if (hasS3Credentials()) {
            try {
                await s3Client.send(new client_s3_1.DeleteObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: normalizedKey,
                }));
                deletedFromS3 = true;
            }
            catch (s3Error) {
                logger_1.logger.warn('S3 delete failed, attempting local cleanup', {
                    key: normalizedKey,
                    error: s3Error.message,
                });
            }
        }
        const deletedLocally = await deleteLocalFileIfPresent(normalizedKey);
        if (!deletedFromS3 && !deletedLocally) {
            throw new errorHandler_1.ApiError(404, 'File not found');
        }
        logger_1.logger.info(`File deleted: ${normalizedKey} by user ${req.user.id}`);
        res.json({
            success: true,
            message: 'File deleted successfully',
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// GET SIGNED DOWNLOAD URL (for private files)
// ===========================================
router.post('/download-url', auth_1.authenticate, async (req, res, next) => {
    try {
        const { key } = req.body;
        if (!key) {
            throw new errorHandler_1.ApiError(400, 'File key is required');
        }
        const { normalizedKey, folder } = validateOwnedUploadKey(key, req.user.id);
        const visibility = PRIVATE_UPLOAD_FOLDERS.has(folder) ? 'private' : 'public';
        if (hasLocalFile(normalizedKey)) {
            return res.json({
                success: true,
                data: {
                    downloadUrl: buildLocalFileUrl(normalizedKey, visibility),
                    expiresIn: 3600,
                },
            });
        }
        if (!hasS3Credentials()) {
            throw new errorHandler_1.ApiError(404, 'File not found');
        }
        const command = new client_s3_1.GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: normalizedKey,
        });
        const signedUrl = await (0, s3_request_presigner_1.getSignedUrl)(s3Client, command, { expiresIn: 3600 });
        res.json({
            success: true,
            data: {
                downloadUrl: signedUrl,
                expiresIn: 3600,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/local/*', auth_1.authenticate, async (req, res, next) => {
    try {
        const key = req.params[0];
        if (!key) {
            throw new errorHandler_1.ApiError(400, 'File key is required');
        }
        const { normalizedKey, folder } = validateOwnedUploadKey(key, req.user.id);
        if (!PRIVATE_UPLOAD_FOLDERS.has(folder)) {
            throw new errorHandler_1.ApiError(404, 'File not found');
        }
        const filePath = resolveLocalFilePath(normalizedKey);
        if (!fs_1.default.existsSync(filePath)) {
            throw new errorHandler_1.ApiError(404, 'File not found');
        }
        res.setHeader('Cache-Control', 'private, no-store');
        res.sendFile(filePath);
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// UPLOAD RESUME
// ===========================================
router.post('/resume', auth_1.authenticate, upload.single('resume'), async (req, res, next) => {
    try {
        const file = req.file;
        if (!file) {
            throw new errorHandler_1.ApiError(400, 'No resume file provided');
        }
        const config = FILE_CONFIGS.resume;
        if (!config.allowedTypes.includes(file.mimetype)) {
            throw new errorHandler_1.ApiError(400, 'Invalid file type. Only PDF and Word documents are allowed.');
        }
        if (file.size > config.maxSize) {
            throw new errorHandler_1.ApiError(400, `File too large. Max size: ${config.maxSize / (1024 * 1024)}MB`);
        }
        const fileExtension = getSafeExtensionForContentType(file.mimetype);
        const key = `${config.folder}/${req.user.id}/${(0, uuid_1.v4)()}${fileExtension}`;
        let publicUrl;
        if (hasS3Credentials()) {
            try {
                await s3Client.send(new client_s3_1.PutObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: key,
                    Body: file.buffer,
                    ContentType: file.mimetype,
                    Metadata: {
                        userId: req.user.id,
                        originalName: file.originalname,
                    },
                }));
                publicUrl = `${CDN_URL}/${key}`;
            }
            catch (s3Error) {
                logger_1.logger.warn(`S3 resume upload failed, falling back to local storage: ${s3Error.message}`);
                publicUrl = await saveFileLocally(file.buffer, key, config.visibility);
            }
        }
        else {
            publicUrl = await saveFileLocally(file.buffer, key, config.visibility);
        }
        logger_1.logger.info(`Resume uploaded: ${key} by user ${req.user.id}`);
        res.json({
            success: true,
            data: {
                key,
                url: publicUrl,
                fileName: file.originalname,
                contentType: file.mimetype,
                size: file.size,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// UPLOAD MULTIPLE IMAGES (for posts)
// ===========================================
router.post('/post-images', auth_1.authenticate, upload.array('images', 10), async (req, res, next) => {
    try {
        const files = req.files;
        if (!files || files.length === 0) {
            throw new errorHandler_1.ApiError(400, 'No files provided');
        }
        const config = FILE_CONFIGS.post;
        const uploadedFiles = [];
        for (const file of files) {
            if (!config.allowedTypes.includes(file.mimetype)) {
                throw new errorHandler_1.ApiError(400, `Invalid file type: ${file.originalname}`);
            }
            if (file.size > config.maxSize) {
                throw new errorHandler_1.ApiError(400, `File too large: ${file.originalname}`);
            }
            let processedBuffer = file.buffer;
            let contentType = file.mimetype;
            if (!file.mimetype.includes('gif')) {
                processedBuffer = await (0, sharp_1.default)(file.buffer)
                    .resize(config.resize.width, config.resize.height, {
                    fit: 'inside',
                    withoutEnlargement: true,
                })
                    .webp({ quality: 85 })
                    .toBuffer();
                contentType = 'image/webp';
            }
            const fileExtension = contentType === 'image/webp'
                ? '.webp'
                : getSafeExtensionForContentType(contentType);
            const key = `${config.folder}/${req.user.id}/${(0, uuid_1.v4)()}${fileExtension}`;
            let fileUrl;
            if (hasS3Credentials()) {
                try {
                    await s3Client.send(new client_s3_1.PutObjectCommand({
                        Bucket: BUCKET_NAME,
                        Key: key,
                        Body: processedBuffer,
                        ContentType: contentType,
                        Metadata: {
                            userId: req.user.id,
                            originalName: file.originalname,
                        },
                    }));
                    fileUrl = `${CDN_URL}/${key}`;
                }
                catch (s3Error) {
                    logger_1.logger.warn(`S3 post image upload failed, falling back to local storage: ${s3Error.message}`);
                    fileUrl = await saveFileLocally(processedBuffer, key, config.visibility);
                }
            }
            else {
                fileUrl = await saveFileLocally(processedBuffer, key, config.visibility);
            }
            uploadedFiles.push({
                key,
                url: fileUrl,
                contentType,
                size: processedBuffer.length,
            });
        }
        logger_1.logger.info(`${uploadedFiles.length} post images uploaded by user ${req.user.id}`);
        res.json({
            success: true,
            data: {
                files: uploadedFiles,
                count: uploadedFiles.length,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=media.routes.js.map