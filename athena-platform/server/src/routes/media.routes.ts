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
import os from 'os';
import path from 'path';
import fs from 'fs';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { uploadLimiter } from '../middleware/rateLimiter';
import { logger } from '../utils/logger';
import { moderateImage } from '../services/moderation.service';
import { checkFileContent } from '../utils/file-signature';
import { hasS3Credentials, storeFile } from '../utils/media-storage';
import { canManageJobApplicants, isHiringMemberOfAny } from '../services/hiring-access.service';

const router = Router();

/** Enough of the start of a file for every signature checkFileContent knows. */
const SIGNATURE_BYTES = 4096;

/**
 * The first bytes of an upload, from memory or from the temporary file a
 * video is received into.
 */
async function leadingBytes(file: Express.Multer.File): Promise<Buffer> {
  if (file.buffer) return file.buffer.subarray(0, SIGNATURE_BYTES);
  const handle = await fs.promises.open(file.path, 'r');
  try {
    const head = Buffer.alloc(SIGNATURE_BYTES);
    const { bytesRead } = await handle.read(head, 0, SIGNATURE_BYTES, 0);
    return head.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

/**
 * The bytes have to agree with the declared type before anything else
 * looks at the file. The allow-lists below check the browser's claim; this
 * checks the file.
 */
async function assertContentMatches(file: Express.Multer.File): Promise<void> {
  const check = checkFileContent(file.mimetype, await leadingBytes(file));
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
 * Receives the upload with the ceiling of its own kind, not the video ceiling
 * for everything: a 400 MB "avatar" used to be buffered in full before the
 * 5 MB limit was looked at. Multer stops reading at the limit and its error is
 * answered as 413 by the error handler. An unknown kind is refused before a
 * byte is read.
 *
 * Pictures, documents and sounds are small enough to hold in memory, and the
 * image path needs the buffer for moderation and resizing. A video is not: up
 * to 500 MB of it sat in the heap for the length of the upload and again for
 * the write to S3, so a handful of members posting reels at once could take
 * the process down for everyone. Video goes to a temporary file instead and is
 * streamed from there; the route removes the file when it is done with it.
 */
function receiveUpload(
  limitFor: (req: AuthRequest) => number | null,
  field: string,
  options: { maxFiles?: number; toDisk?: (req: AuthRequest) => boolean } = {}
) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const fileSize = limitFor(req);
    if (!fileSize) {
      return next(new ApiError(400, 'Invalid upload type'));
    }
    const receiver = multer({
      storage: options.toDisk?.(req)
        ? multer.diskStorage({
            destination: os.tmpdir(),
            filename: (_req, _file, cb) => cb(null, `athena-upload-${uuidv4()}`),
          })
        : multer.memoryStorage(),
      limits: { fileSize, files: options.maxFiles ?? 1 },
    });
    const handler = options.maxFiles ? receiver.array(field, options.maxFiles) : receiver.single(field);
    handler(req, res, next);
  };
}

/** Removes the temporary file a disk-received upload left behind, if any. */
async function discardTemporaryUpload(file: Express.Multer.File | undefined): Promise<void> {
  if (!file?.path) return;
  try {
    await fs.promises.unlink(file.path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.warn('Could not remove a temporary upload', { path: file.path, error: (error as Error).message });
    }
  }
}

function configFor(type: unknown): FileConfig | null {
  return typeof type === 'string' && Object.prototype.hasOwnProperty.call(FILE_CONFIGS, type)
    ? FILE_CONFIGS[type as keyof typeof FILE_CONFIGS]
    : null;
}

/**
 * What a failed write to S3 becomes.
 *
 * It used to become a write to this container's disk, everywhere, and the
 * member was handed a URL that worked until the next deploy replaced the
 * container and then never again: her avatar, her reel, the résumé she had
 * attached to an application. utils/media-storage holds the rule for the files
 * the server produces; this route had its own copy of the old fallback. In
 * production the failure is now the answer, a 503 she can retry. Outside
 * production the disk is where a developer's files live anyway.
 */
function onS3UploadFailure(key: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  if (process.env.NODE_ENV === 'production') {
    logger.error('S3 upload failed; not storing on the container disk, which the next deploy wipes', { key, error: message });
    throw new ApiError(503, 'Media storage is unavailable. Please try again in a few minutes.');
  }
  logger.warn('S3 upload failed, storing locally instead (outside production only)', { key, error: message });
}

/**
 * Stores an upload held in memory: in S3 when it is configured, on the local
 * disk otherwise, and never on the local disk in production because S3 said
 * no. Returns the URL the file is served from.
 */
async function storeUploadedBuffer(options: {
  key: string;
  body: Buffer;
  contentType: string;
  visibility: FileConfig['visibility'];
  userId: string;
  originalName: string;
}): Promise<string> {
  const { key, body, contentType, visibility, userId, originalName } = options;
  if (hasS3Credentials()) {
    try {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          Body: body,
          ContentType: contentType,
          Metadata: { userId, originalName },
        })
      );
      return `${CDN_URL}/${key}`;
    } catch (s3Error) {
      onS3UploadFailure(key, s3Error);
    }
  }
  return saveFileLocally(body, key, visibility);
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

/**
 * Whether this reader is on the hiring side of an application the résumé was
 * attached to.
 *
 * The file travels with an application, so the people deciding on it may read
 * it. That used to mean anyone with an OrganizationMember row at the employer:
 * a VIEWER, whom the employer console shows counts and never people, or
 * someone whose invitation she had never accepted, could open every applicant's
 * résumé by its key. It now asks the same question the applicant lists ask
 * (services/hiring-access): for a job, canManageJobApplicants, which is the
 * organisation's accepted hiring staff, or the poster of a job with no
 * organisation; for an apprenticeship, accepted hiring staff of the RTO or the
 * host employer.
 *
 * Only applications made by the woman the key belongs to count. The upload
 * route writes `resumes/<her id>/…`, and an application can only carry her own
 * upload (assertOwnResumeUpload), so this matches what she sent and nothing
 * anyone else could have pointed at her file.
 */
async function isHiringReaderOfResume(normalizedKey: string, ownerId: string, readerId: string): Promise<boolean> {
  const where = { userId: ownerId, resumeUrl: { endsWith: `/${normalizedKey}` } };

  const [jobApplications, apprenticeshipApplications] = await Promise.all([
    prisma.jobApplication.findMany({
      where,
      select: { job: { select: { organizationId: true, postedById: true } } },
      take: 25,
    }),
    prisma.apprenticeshipApplication.findMany({
      where,
      select: { apprenticeship: { select: { rtoId: true, hostEmployerId: true } } },
      take: 25,
    }),
  ]);

  for (const application of jobApplications) {
    if (await canManageJobApplicants(application.job, readerId)) return true;
  }

  const organizationIds = Array.from(
    new Set(
      apprenticeshipApplications.flatMap(({ apprenticeship }) =>
        [apprenticeship.rtoId, apprenticeship.hostEmployerId].filter((id): id is string => Boolean(id))
      )
    )
  );
  return isHiringMemberOfAny(readerId, organizationIds);
}

/**
 * Who may read a private upload. The owner always. A résumé travels with a
 * job or apprenticeship application, so the hiring staff deciding on that
 * application may read that one file too (isHiringReaderOfResume). Anyone
 * else is told the file does not exist rather than whose it is.
 *
 * Deleting stays owner-only (validateOwnedUploadKey); this is for reads.
 */
async function resolveReadableUploadKey(
  key: string,
  userId: string
): Promise<{ normalizedKey: string; folder: string }> {
  const normalizedKey = normalizeUploadKey(key);
  const keyParts = normalizedKey.split('/');

  if (keyParts.length < 3 || !keyParts[2]) {
    throw new ApiError(400, 'Invalid file key format');
  }

  const [folder, ownerId] = keyParts;

  if (!VALID_UPLOAD_FOLDERS.has(folder)) {
    throw new ApiError(400, 'Invalid file path');
  }

  if (ownerId === userId) {
    return { normalizedKey, folder };
  }

  if (folder === FILE_CONFIGS.resume.folder && (await isHiringReaderOfResume(normalizedKey, ownerId, userId))) {
    return { normalizedKey, folder };
  }

  logger.warn('Private file requested by someone it does not belong to', {
    userId,
    attemptedKey: normalizedKey,
    keyUserId: ownerId,
  });
  throw new ApiError(404, 'File not found');
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

  // Asynchronous, like utils/media-storage: a synchronous write held the
  // event loop for as long as the file took to land, and every other request
  // on the instance, the health check included, waited with it.
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, buffer);
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
// PRESIGNED UPLOAD URL: withdrawn
// ===========================================
// POST /presigned-url signed a bare S3 PUT for anyone signed in: no size
// ceiling, an hour to use it, and nothing ever looked at what arrived. The
// multer limits and the content-signature check below only run on uploads
// that come through this server, so the signed URL was a way round both, into
// the public bucket. Nothing called it: the web client had a helper that no
// screen used, and the app posts to a path this server has never had. The
// route is gone rather than tightened, because a direct-to-bucket upload that
// is safe needs a signed POST policy and a confirm step that checks the bytes
// before anything points at them, and until that exists every upload goes
// through /upload/:type.

// ===========================================
// UPLOAD FILE (Direct Upload)
// ===========================================
router.post(
  '/upload/:type',
  authenticate,
  uploadLimiter,
  receiveUpload((req) => configFor(req.params.type)?.maxSize ?? null, 'file', {
    toDisk: (req) => req.params.type === 'video',
  }),
  async (req: AuthRequest, res, next) => {
    const file = req.file;
    try {
      const { type } = req.params;

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

      await assertContentMatches(file);

      const userId = req.user!.id;

      // A video was received to a temporary file, and is streamed from there
      // to S3 (storeFile sends it with its length, so it never has to be read
      // into memory). A production write that fails is a 503, never a copy on
      // this container's disk.
      if (file.path) {
        const key = `${config.folder}/${userId}/${uuidv4()}${getSafeExtensionForContentType(file.mimetype)}`;
        let url: string;
        try {
          url = await storeFile(key, file.path, file.mimetype);
        } catch (storageError) {
          logger.error('Streamed upload could not be stored', {
            key,
            error: storageError instanceof Error ? storageError.message : String(storageError),
          });
          throw new ApiError(503, 'Media storage is unavailable. Please try again in a few minutes.');
        }

        logger.info(`File uploaded: ${key} by user ${userId}`);
        res.json({
          success: true,
          data: { key, url, contentType: file.mimetype, size: file.size },
        });
        return;
      }

      let processedBuffer = file.buffer;
      let contentType = file.mimetype;

      if (file.mimetype.startsWith('image/')) {
        const moderationResult = await moderateImage(file.buffer);
        if (moderationResult.action === 'block') {
          logger.warn('Image upload blocked by moderation', {
            userId,
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
      const key = `${config.folder}/${userId}/${uuidv4()}${fileExtension}`;

      const publicUrl = await storeUploadedBuffer({
        key,
        body: processedBuffer,
        contentType,
        visibility: config.visibility,
        userId,
        originalName: file.originalname,
      });

      if (type === 'avatar') {
        await prisma.user.update({
          where: { id: userId },
          data: { avatar: publicUrl },
        });
      }

      logger.info(`File uploaded: ${key} by user ${userId}`);

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
    } finally {
      await discardTemporaryUpload(file);
    }
  }
);

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
// The owner of the file, or a team member of the organisation whose job the
// file was attached to as a résumé (resolveReadableUploadKey). A local file's
// URL points back at GET /local/*, which needs the session header, so the
// web client fetches it through the API rather than as a plain link.
router.post('/download-url', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { key } = req.body;

    if (!key || typeof key !== 'string' || key.length > 512) {
      throw new ApiError(400, 'File key is required');
    }

    const { normalizedKey, folder } = await resolveReadableUploadKey(key, req.user!.id);
    const visibility = PRIVATE_UPLOAD_FOLDERS.has(folder) ? 'private' : 'public';
    const fileName = path.basename(normalizedKey);

    if (hasLocalFile(normalizedKey)) {
      return res.json({
        success: true,
        data: {
          downloadUrl: buildLocalFileUrl(normalizedKey, visibility),
          fileName,
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
        fileName,
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

    const { normalizedKey, folder } = await resolveReadableUploadKey(key, req.user!.id);

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

    await assertContentMatches(file);

    const fileExtension = getSafeExtensionForContentType(file.mimetype);
    const key = `${config.folder}/${req.user!.id}/${uuidv4()}${fileExtension}`;

    const publicUrl = await storeUploadedBuffer({
      key,
      body: file.buffer,
      contentType: file.mimetype,
      visibility: config.visibility,
      userId: req.user!.id,
      originalName: file.originalname,
    });

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

      await assertContentMatches(file);

      // The same screening the single upload applies. Post images went
      // straight to the public bucket without it, so a picture the moderation
      // service would have refused as an avatar was accepted in a post.
      const moderationResult = await moderateImage(file.buffer);
      if (moderationResult.action === 'block') {
        logger.warn('Post image blocked by moderation', { userId: req.user?.id, reason: moderationResult.reason });
        throw new ApiError(400, `Image rejected: ${moderationResult.reason}`);
      }

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

      const fileUrl = await storeUploadedBuffer({
        key,
        body: processedBuffer,
        contentType,
        visibility: config.visibility,
        userId: req.user!.id,
        originalName: file.originalname,
      });

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
