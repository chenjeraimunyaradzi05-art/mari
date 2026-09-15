import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { uploadLimiter } from '../middleware/rateLimiter';
import { logger } from '../utils/logger';
import { moderateImage } from '../services/moderation.service';
import { checkFileContent } from '../utils/file-signature';

const router = Router();

/**
 * The bytes have to agree with the declared type before anything else
 * looks at the file. The allow-lists below check the browser's claim; this
 * checks the file.
 */
function assertContentMatches(file: Express.Multer.File): void {
  const check = checkFileContent(file.mimetype, file.buffer);
  if (!check.ok) {
    logger.warn('Upload refused: content does not match declared type', {
      declared: file.mimetype,
      detected: check.detected,
      name: file.originalname,
    });
    throw new ApiError(400, `The file is not what it says it is: ${check.reason}.`);
  }
}

// Configure S3 client
const s3Client = new S3Client({
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
    visibility: 'public' as const,
  },
  cover: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    folder: 'covers',
    resize: { width: 1500, height: 500 },
    visibility: 'public' as const,
  },
  post: {
    maxSize: 20 * 1024 * 1024, // 20MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    folder: 'posts',
    resize: { width: 1200, height: 1200 },
    visibility: 'public' as const,
  },
  video: {
    maxSize: 500 * 1024 * 1024, // 500MB
    allowedTypes: ['video/mp4', 'video/quicktime', 'video/webm'],
    folder: 'videos',
    resize: null,
    visibility: 'public' as const,
  },
  // A poster frame the creator studio captures in the browser before the
  // pipeline makes its own. Stored as sent: cropping it square would cut the
  // head off a portrait reel.
  thumbnail: {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    folder: 'thumbnails',
    resize: null,
    visibility: 'public' as const,
  },
  // Captions for a reel, as WebVTT. Public because the player fetches them.
  captions: {
    maxSize: 1024 * 1024, // 1MB
    allowedTypes: ['text/vtt', 'text/plain'],
    folder: 'captions',
    resize: null,
    visibility: 'public' as const,
  },
  // Sounds a reel can be set to. The pipeline writes extracted original
  // sounds into the same folder.
  audio: {
    maxSize: 20 * 1024 * 1024, // 20MB
    allowedTypes: ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/ogg', 'audio/webm'],
    folder: 'sounds',
    resize: null,
    visibility: 'public' as const,
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
    visibility: 'private' as const,
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
    visibility: 'private' as const,
  },
};

type FileConfig = (typeof FILE_CONFIGS)[keyof typeof FILE_CONFIGS];

const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/x-m4a': '.m4a',
  'audio/aac': '.aac',
  'audio/wav': '.wav',
  'audio/ogg': '.ogg',
  'audio/webm': '.weba',
  'text/vtt': '.vtt',
  'text/plain': '.vtt',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};

const LOCAL_UPLOADS_ROOT = path.resolve(process.cwd(), 'uploads');
const VALID_UPLOAD_FOLDERS = new Set(
  Object.values(FILE_CONFIGS).map((config) => config.folder)
);
const PRIVATE_UPLOAD_FOLDERS = new Set(
  Object.values(FILE_CONFIGS)
    .filter((config) => config.visibility === 'private')
    .map((config) => config.folder)
);

/**
 * Reads the upload into memory with the ceiling of its own kind, not the
 * video ceiling for everything: a 400 MB "avatar" used to be buffered in
 * full before the 5 MB limit was looked at. Multer stops reading at the
 * limit and its error is answered as 413 by the error handler. An unknown
 * kind is refused before a byte is read.
 */
function receiveUpload(
  limitFor: (req: AuthRequest) => number | null,
  field: string,
  options: { maxFiles?: number } = {}
) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const fileSize = limitFor(req);
    if (!fileSize) {
      return next(new ApiError(400, 'Invalid upload type'));
    }
    const receiver = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize, files: options.maxFiles ?? 1 },
    });
    const handler = options.maxFiles ? receiver.array(field, options.maxFiles) : receiver.single(field);
    handler(req, res, next);
  };
}

function configFor(type: unknown): FileConfig | null {
  return typeof type === 'string' && Object.prototype.hasOwnProperty.call(FILE_CONFIGS, type)
    ? FILE_CONFIGS[type as keyof typeof FILE_CONFIGS]
    : null;
}

function hasS3Credentials(): boolean {
  return !!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY;
}

function getSafeExtensionForContentType(contentType: string): string {
  return CONTENT_TYPE_EXTENSIONS[contentType] || '.bin';
}

function normalizeUploadKey(key: string): string {
  return key.replace(/\\/g, '/').replace(/^\/+/, '');
}

function resolveLocalFilePath(key: string): string {
  const normalizedKey = normalizeUploadKey(key);
  const filePath = path.resolve(LOCAL_UPLOADS_ROOT, normalizedKey);

  if (
    filePath !== LOCAL_UPLOADS_ROOT &&
    !filePath.startsWith(`${LOCAL_UPLOADS_ROOT}${path.sep}`)
  ) {
    throw new ApiError(400, 'Invalid file path');
  }

  return filePath;
}

function buildLocalFileUrl(
  key: string,
  visibility: FileConfig['visibility']
): string {
  const apiUrl = process.env.API_URL || 'http://localhost:5000';
  const normalizedKey = normalizeUploadKey(key);

  if (visibility === 'private') {
    return `${apiUrl}/api/media/local/${normalizedKey}`;
  }

  return `${apiUrl}/uploads/${normalizedKey}`;
}

function validateOwnedUploadKey(key: string, userId: string) {
  const normalizedKey = normalizeUploadKey(key);
  const keyParts = normalizedKey.split('/');

  if (keyParts.length < 3 || !keyParts[2]) {
    throw new ApiError(400, 'Invalid file key format');
  }

  const [folder, userIdInPath] = keyParts;

  if (!VALID_UPLOAD_FOLDERS.has(folder)) {
    throw new ApiError(400, 'Invalid file path');
  }

  if (userIdInPath !== userId) {
    logger.warn('Unauthorized file access attempt', {
      userId,
      attemptedKey: normalizedKey,
      keyUserId: userIdInPath,
    });
    throw new ApiError(403, 'Not authorized to access this file');
  }

  return { normalizedKey, folder };
}

function hasLocalFile(key: string): boolean {
  try {
    return fs.existsSync(resolveLocalFilePath(key));
  } catch {
    return false;
  }
}

async function saveFileLocally(
  buffer: Buffer,
  key: string,
  visibility: FileConfig['visibility']
): Promise<string> {
  const filePath = resolveLocalFilePath(key);
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, buffer);
  logger.info('File saved locally', { filePath, key, visibility });

  return buildLocalFileUrl(key, visibility);
}

async function deleteLocalFileIfPresent(key: string): Promise<boolean> {
  const filePath = resolveLocalFilePath(key);

  if (!fs.existsSync(filePath)) {
    return false;
  }

  fs.unlinkSync(filePath);
  logger.info('Local file deleted', { filePath, key });
  return true;
}

// ===========================================
// GET PRESIGNED UPLOAD URL
// ===========================================
router.post('/presigned-url', authenticate, uploadLimiter, async (req: AuthRequest, res, next) => {
  try {
    const { fileType, fileName, contentType } = req.body;

    if (!fileType || !fileName || !contentType) {
      throw new ApiError(400, 'fileType, fileName, and contentType are required');
    }

    // The name is stored as object metadata, which has a size ceiling of its
    // own and no business carrying control characters.
    // eslint-disable-next-line no-control-regex -- refusing control characters is the point
    if (typeof fileName !== 'string' || typeof contentType !== 'string' || fileName.length > 255 || /[ -]/.test(fileName)) {
      throw new ApiError(400, 'fileName must be a plain name of 255 characters or fewer');
    }

    const config = configFor(fileType);
    if (!config) {
      throw new ApiError(400, 'Invalid file type');
    }

    if (!config.allowedTypes.includes(contentType)) {
      throw new ApiError(400, `Invalid content type for ${fileType}`);
    }

    const fileExtension = getSafeExtensionForContentType(contentType);
    const key = `${config.folder}/${req.user!.id}/${uuidv4()}${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      Metadata: {
        userId: req.user!.id,
        originalName: fileName,
      },
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    res.json({
      success: true,
      data: {
        uploadUrl: signedUrl,
        key,
        publicUrl: `${CDN_URL}/${key}`,
        expiresIn: 3600,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// UPLOAD FILE (Direct Upload)
// ===========================================
router.post('/upload/:type', authenticate, uploadLimiter, receiveUpload((req) => configFor(req.params.type)?.maxSize ?? null, 'file'), async (req: AuthRequest, res, next) => {
  try {
    const { type } = req.params;
    const file = req.file;

    logger.info(`Upload request received: type=${type}, hasFile=${!!file}`);

    if (!file) {
      throw new ApiError(400, 'No file provided');
    }

    logger.info(
      `File details: name=${file.originalname}, size=${file.size}, mimetype=${file.mimetype}`
    );

    const config = FILE_CONFIGS[type as keyof typeof FILE_CONFIGS];
    if (!config) {
      throw new ApiError(400, 'Invalid upload type');
    }

    if (!config.allowedTypes.includes(file.mimetype)) {
      throw new ApiError(
        400,
        `Invalid file type. Allowed: ${config.allowedTypes.join(', ')}`
      );
    }

    if (file.size > config.maxSize) {
      throw new ApiError(
        400,
        `File too large. Max size: ${config.maxSize / (1024 * 1024)}MB`
      );
    }

    assertContentMatches(file);

    let processedBuffer = file.buffer;
    let contentType = file.mimetype;

    if (file.mimetype.startsWith('image/')) {
      const moderationResult = await moderateImage(file.buffer);
      if (moderationResult.action === 'block') {
        logger.warn('Image upload blocked by moderation', {
          userId: req.user?.id,
          reason: moderationResult.reason,
        });
        throw new ApiError(400, `Image rejected: ${moderationResult.reason}`);
      }
    }

    if (
      config.resize &&
      file.mimetype.startsWith('image/') &&
      !file.mimetype.includes('gif')
    ) {
      processedBuffer = await sharp(file.buffer)
        .resize(config.resize.width, config.resize.height, {
          fit: 'cover',
          position: 'center',
        })
        .webp({ quality: 85 })
        .toBuffer();
      contentType = 'image/webp';
    }

    const fileExtension =
      contentType === 'image/webp'
        ? '.webp'
        : getSafeExtensionForContentType(contentType);
    const key = `${config.folder}/${req.user!.id}/${uuidv4()}${fileExtension}`;

    let publicUrl: string;

    logger.info(
      `AWS credentials check: hasKeyId=${!!process.env.AWS_ACCESS_KEY_ID}, hasSecret=${!!process.env.AWS_SECRET_ACCESS_KEY}`
    );

    if (hasS3Credentials()) {
      try {
        await s3Client.send(
          new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: processedBuffer,
            ContentType: contentType,
            Metadata: {
              userId: req.user!.id,
              originalName: file.originalname,
            },
          })
        );
        publicUrl = `${CDN_URL}/${key}`;
      } catch (s3Error) {
        logger.warn(
          `S3 upload failed, falling back to local storage: ${(s3Error as Error).message}`
        );
        publicUrl = await saveFileLocally(
          processedBuffer,
          key,
          config.visibility
        );
      }
    } else {
      publicUrl = await saveFileLocally(processedBuffer, key, config.visibility);
    }

    if (type === 'avatar') {
      await prisma.user.update({
        where: { id: req.user!.id },
        data: { avatar: publicUrl },
      });
    }

    logger.info(`File uploaded: ${key} by user ${req.user!.id}`);

    res.json({
      success: true,
      data: {
        key,
        url: publicUrl,
        contentType,
        size: processedBuffer.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// DELETE FILE
// ===========================================
router.delete('/delete', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { key } = req.body;

    if (!key) {
      throw new ApiError(400, 'File key is required');
    }

    const { normalizedKey } = validateOwnedUploadKey(key, req.user!.id);

    let deletedFromS3 = false;
    if (hasS3Credentials()) {
      try {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: normalizedKey,
          })
        );
        deletedFromS3 = true;
      } catch (s3Error) {
        logger.warn('S3 delete failed, attempting local cleanup', {
          key: normalizedKey,
          error: (s3Error as Error).message,
        });
      }
    }

    const deletedLocally = await deleteLocalFileIfPresent(normalizedKey);

    if (!deletedFromS3 && !deletedLocally) {
      throw new ApiError(404, 'File not found');
    }

    logger.info(`File deleted: ${normalizedKey} by user ${req.user!.id}`);

    res.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// GET SIGNED DOWNLOAD URL (for private files)
// ===========================================
router.post('/download-url', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { key } = req.body;

    if (!key) {
      throw new ApiError(400, 'File key is required');
    }

    const { normalizedKey, folder } = validateOwnedUploadKey(key, req.user!.id);
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
      throw new ApiError(404, 'File not found');
    }

    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: normalizedKey,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    res.json({
      success: true,
      data: {
        downloadUrl: signedUrl,
        expiresIn: 3600,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/local/*', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const key = req.params[0];

    if (!key) {
      throw new ApiError(400, 'File key is required');
    }

    const { normalizedKey, folder } = validateOwnedUploadKey(key, req.user!.id);

    if (!PRIVATE_UPLOAD_FOLDERS.has(folder)) {
      throw new ApiError(404, 'File not found');
    }

    const filePath = resolveLocalFilePath(normalizedKey);
    if (!fs.existsSync(filePath)) {
      throw new ApiError(404, 'File not found');
    }

    // A private document is handed over as a download, sandboxed and never
    // sniffed: a PDF or Word file rendered inline under this origin could
    // otherwise run script with the API's cookies in reach.
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${path.basename(filePath).replace(/[^A-Za-z0-9._-]/g, '_')}"`
    );
    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
});

// ===========================================
// UPLOAD RESUME
// ===========================================
router.post('/resume', authenticate, uploadLimiter, receiveUpload(() => FILE_CONFIGS.resume.maxSize, 'resume'), async (req: AuthRequest, res, next) => {
  try {
    const file = req.file;

    if (!file) {
      throw new ApiError(400, 'No resume file provided');
    }

    const config = FILE_CONFIGS.resume;

    if (!config.allowedTypes.includes(file.mimetype)) {
      throw new ApiError(
        400,
        'Invalid file type. Only PDF and Word documents are allowed.'
      );
    }

    if (file.size > config.maxSize) {
      throw new ApiError(
        400,
        `File too large. Max size: ${config.maxSize / (1024 * 1024)}MB`
      );
    }

    assertContentMatches(file);

    const fileExtension = getSafeExtensionForContentType(file.mimetype);
    const key = `${config.folder}/${req.user!.id}/${uuidv4()}${fileExtension}`;

    let publicUrl: string;

    if (hasS3Credentials()) {
      try {
        await s3Client.send(
          new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
            Metadata: {
              userId: req.user!.id,
              originalName: file.originalname,
            },
          })
        );
        publicUrl = `${CDN_URL}/${key}`;
      } catch (s3Error) {
        logger.warn(
          `S3 resume upload failed, falling back to local storage: ${(s3Error as Error).message}`
        );
        publicUrl = await saveFileLocally(file.buffer, key, config.visibility);
      }
    } else {
      publicUrl = await saveFileLocally(file.buffer, key, config.visibility);
    }

    logger.info(`Resume uploaded: ${key} by user ${req.user!.id}`);

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
  } catch (error) {
    next(error);
  }
});

// ===========================================
// UPLOAD MULTIPLE IMAGES (for posts)
// ===========================================
router.post('/post-images', authenticate, uploadLimiter, receiveUpload(() => FILE_CONFIGS.post.maxSize, 'images', { maxFiles: 10 }), async (req: AuthRequest, res, next) => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      throw new ApiError(400, 'No files provided');
    }

    const config = FILE_CONFIGS.post;
    const uploadedFiles = [];

    for (const file of files) {
      if (!config.allowedTypes.includes(file.mimetype)) {
        throw new ApiError(400, `Invalid file type: ${file.originalname}`);
      }

      if (file.size > config.maxSize) {
        throw new ApiError(400, `File too large: ${file.originalname}`);
      }

      assertContentMatches(file);

      let processedBuffer = file.buffer;
      let contentType = file.mimetype;

      if (!file.mimetype.includes('gif')) {
        processedBuffer = await sharp(file.buffer)
          .resize(config.resize!.width, config.resize!.height, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: 85 })
          .toBuffer();
        contentType = 'image/webp';
      }

      const fileExtension =
        contentType === 'image/webp'
          ? '.webp'
          : getSafeExtensionForContentType(contentType);
      const key = `${config.folder}/${req.user!.id}/${uuidv4()}${fileExtension}`;

      let fileUrl: string;

      if (hasS3Credentials()) {
        try {
          await s3Client.send(
            new PutObjectCommand({
              Bucket: BUCKET_NAME,
              Key: key,
              Body: processedBuffer,
              ContentType: contentType,
              Metadata: {
                userId: req.user!.id,
                originalName: file.originalname,
              },
            })
          );
          fileUrl = `${CDN_URL}/${key}`;
        } catch (s3Error) {
          logger.warn(
            `S3 post image upload failed, falling back to local storage: ${(s3Error as Error).message}`
          );
          fileUrl = await saveFileLocally(
            processedBuffer,
            key,
            config.visibility
          );
        }
      } else {
        fileUrl = await saveFileLocally(processedBuffer, key, config.visibility);
      }

      uploadedFiles.push({
        key,
        url: fileUrl,
        contentType,
        size: processedBuffer.length,
      });
    }

    logger.info(`${uploadedFiles.length} post images uploaded by user ${req.user!.id}`);

    res.json({
      success: true,
      data: {
        files: uploadedFiles,
        count: uploadedFiles.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
