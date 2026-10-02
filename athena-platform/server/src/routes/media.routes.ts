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
import { randomUUID } from 'crypto';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdultAccount, requireWomanMember } from '../middleware/account-gates';
import { uploadLimiter } from '../middleware/rateLimiter';
import { logger } from '../utils/logger';
import { moderateImage } from '../services/moderation.service';
import { screenVideoFrames } from '../services/video-screening.service';
import { checkFileContent } from '../utils/file-signature';
import {
  hasS3Credentials,
  mayFallBackToLocalDisk,
  mediaUrlForKey,
  PRIVATE_MEDIA_FOLDERS,
  storeFile,
} from '../utils/media-storage';
import {
  hasStrippableMetadata,
  MediaMetadataError,
  stripMediaMetadata,
  stripMediaMetadataBuffer,
} from '../services/video-pipeline.service';
import { canManageJobApplicants, isHiringMemberOfAny } from '../services/hiring-access.service';
import { screenUpload } from '../services/malware-scan.service';
import { mayReadChatAttachment, resolveChatUploadScope } from '../services/chat-attachment.service';
import { CHAT_FOLDER, CHAT_LINK_SECONDS, chatObjectKey, parseChatKey } from '../utils/chat-attachments';

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
  // A file sent in a direct message or a group chat. Private: the key names the
  // conversation, and only the people in it are given a link, which expires
  // (utils/chat-attachments). maxSize is the most a clip may be; everything else
  // is held to CHAT_FILE_LIMIT. It used to go up as a post picture or a reel, to
  // a public link with no audience, no expiry and no deletion.
  chat: {
    maxSize: 100 * 1024 * 1024, // 100MB, a clip
    allowedTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'video/mp4',
      'video/quicktime',
      'video/webm',
      'audio/mpeg',
      'audio/mp4',
      'audio/x-m4a',
      'audio/aac',
      'audio/wav',
      'audio/ogg',
      'audio/webm',
      'application/pdf',
    ],
    folder: CHAT_FOLDER,
    resize: null,
    visibility: 'private' as const,
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

/** The most a chat file that is not a clip may be: a picture, a voice note, a PDF. A clip is streamed to disk and may be larger. */
const CHAT_FILE_LIMIT = 25 * 1024 * 1024;

/**
 * Whether this upload says it is a clip. The ceiling and where it is received
 * (memory or a temporary file) have to be decided before a byte is read, and the
 * file's own type is not known until it has been, so the client says. It is only
 * a request: the route checks the type it actually got agrees (a clip received
 * to disk is a video, and anything received to memory is not).
 */
const isChatClip = (req: AuthRequest) => req.query.video === '1';

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
// The same list utils/media-storage uses to decide which files are never
// addressed through the CDN; a kind marked private above has to be on it, and
// media.upload.private.test.ts fails if one is not.
const PRIVATE_UPLOAD_FOLDERS = PRIVATE_MEDIA_FOLDERS;

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
            filename: (_req, _file, cb) => cb(null, `athena-upload-${randomUUID()}`),
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

/**
 * A photo, a video or a recording carries more than its picture or its sound.
 * A phone writes where it was taken, which phone took it and when into the
 * file, and a member who sends one in a message or posts it has not chosen to
 * share any of that. For a woman who has left somebody it can be the address
 * she is staying at. Everything stored here is rewritten without it:
 *
 *   - pictures go through sharp, which drops every tag on re-encoding. The
 *     orientation tag is read first (.rotate()), because dropping it on its
 *     own turns a portrait photo on its side.
 *   - video and sound are copied across by ffmpeg with their tags, chapters
 *     and data tracks left out (video-pipeline.service stripMediaMetadata).
 *
 * A GIF is stored as it was sent: the format has no place for a location.
 * Documents are stored as sent too; they go to the private folders and are
 * not offered in a chat.
 */

/** A picture that could not be decoded is the member's file to replace, not a server fault. */
async function readableImage(work: Promise<Buffer>): Promise<Buffer> {
  try {
    return await work;
  } catch (error) {
    logger.warn('Upload refused: the image could not be read', { error: error instanceof Error ? error.message : String(error) });
    throw new ApiError(400, 'That image could not be read. Try saving it again, or choose another.');
  }
}

/** A picture kept in the format it came in, at the size it came in, minus its tags. */
function reencodedAsSent(buffer: Buffer, mimetype: string): Promise<Buffer> {
  const image = sharp(buffer).rotate();
  if (mimetype === 'image/png') return image.png().toBuffer();
  if (mimetype === 'image/webp') return image.webp({ quality: 90 }).toBuffer();
  return image.jpeg({ quality: 90 }).toBuffer();
}

/**
 * What to do when a file could not be copied without its metadata. A file
 * ffmpeg cannot read is refused; so is every file when the host has no ffmpeg
 * in production, since the alternative is to publish it with the tags in. A
 * developer's machine without the binary stores the file as it is.
 */
function refuseOrPassThrough(error: unknown, noun: 'video' | 'recording'): void {
  if (!(error instanceof MediaMetadataError)) throw error;

  if (error.reason === 'unreadable') {
    logger.warn(`Upload refused: the ${noun} could not be read`, { error: error.message });
    throw new ApiError(400, `That ${noun} could not be read. Try saving it again, or choose another.`);
  }
  if (process.env.NODE_ENV === 'production') {
    logger.error(`Upload refused: the ${noun} could not be cleaned of its metadata`, { error: error.message });
    throw new ApiError(503, `We cannot prepare this ${noun} just now. Please try again in a few minutes.`);
  }
  logger.warn(`Storing a ${noun} with its metadata (outside production only)`, { error: error.message });
}

/**
 * The temporary file a video was received into, or a copy of it without its
 * metadata. discard() removes the copy; the route removes the received file.
 */
async function videoWithoutMetadata(
  file: Express.Multer.File
): Promise<{ path: string; size: number; discard: () => Promise<void> }> {
  if (!hasStrippableMetadata(file.mimetype)) {
    return { path: file.path, size: file.size, discard: async () => undefined };
  }

  const cleanPath = path.join(os.tmpdir(), `athena-clean-${randomUUID()}`);
  try {
    await stripMediaMetadata(file.path, cleanPath, file.mimetype);
  } catch (error) {
    refuseOrPassThrough(error, 'video');
    return { path: file.path, size: file.size, discard: async () => undefined };
  }

  const { size } = await fs.promises.stat(cleanPath);
  return { path: cleanPath, size, discard: () => fs.promises.rm(cleanPath, { force: true }) };
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
  if (!mayFallBackToLocalDisk()) {
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
      // A public file is addressed through the CDN; a résumé or a document is
      // addressed at the bucket, never the CDN (utils/media-storage).
      return mediaUrlForKey(key);
    } catch (s3Error) {
      onS3UploadFailure(key, s3Error);
    }
  }
  return saveFileLocally(body, key, visibility);
}

function getSafeExtensionForContentType(contentType: string): string {
  return CONTENT_TYPE_EXTENSIONS[contentType] || '.bin';
}

/**
 * A key is a path of plain names. One that climbs (`.` or `..`), or has an empty
 * or control-character segment, is refused here, because the checks below read
 * the owner and the folder off the key's own segments, and the disk resolves the
 * climb afterwards: `resumes/<my id>/../<her id>/cv.pdf` is "mine" to the first
 * and hers to the second. Every key this server writes is `<folder>/<user
 * id>/<uuid><ext>`, so nothing honest is turned away.
 */
function normalizeUploadKey(key: string): string {
  const normalized = key.replace(/\\/g, '/').replace(/^\/+/, '');
  const segments = normalized.split('/');
  // eslint-disable-next-line no-control-regex -- control characters are exactly what is refused
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..') || /[\u0000-\u001f]/.test(normalized)) {
    throw new ApiError(400, 'Invalid file path');
  }
  return normalized;
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

  // A chat file's second segment is the conversation, not an owner: the one who
  // may take it back is the member who sent it, and the key says who that is.
  if (folder === CHAT_FOLDER) {
    if (parseChatKey(normalizedKey)?.senderId !== userId) {
      logger.warn('Unauthorized file access attempt', { userId, attemptedKey: normalizedKey });
      throw new ApiError(403, 'Not authorized to access this file');
    }
    return { normalizedKey, folder };
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

  // A chat file belongs to a conversation, not to a member: whoever is in it
  // may read it, and nobody else, and the answer to anybody else is the one for
  // a file that is not there (services/chat-attachment).
  if (folder === CHAT_FOLDER) {
    if (await mayReadChatAttachment(normalizedKey, userId)) {
      return { normalizedKey, folder };
    }
    logger.warn('Chat file requested by someone outside the conversation', { userId, attemptedKey: normalizedKey });
    throw new ApiError(404, 'File not found');
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
// A FILE SENT IN A CONVERSATION
// ===========================================
// POST /upload/chat?conversationId=<id> or ?groupId=<id>. Who the file is for is
// decided before it is read, so nobody who may not send in that conversation has
// a file buffered on the server's behalf: she has to be in the thread, under the
// floors sending a message has (the age gate for a thread, the women-only gate for
// a group room) and the rules about requests, blocks and a group's mute and ban
// (services/chat-attachment). The file is then stored under the conversation's own
// key and given to nobody but the people in it.
const chatFloor = (req: AuthRequest, res: Response, next: NextFunction) =>
  (req.query.groupId ? requireWomanMember : requireAdultAccount)(req, res, next);

const onlyForChat =
  (middleware: (req: AuthRequest, res: Response, next: NextFunction) => unknown) =>
  (req: AuthRequest, res: Response, next: NextFunction) =>
    req.params.type === CHAT_FOLDER ? middleware(req, res, next) : next();

async function chatAudience(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.locals.chatScopeId = await resolveChatUploadScope(req.user!.id, req.query);
    next();
  } catch (error) {
    next(error);
  }
}

/** The key a new upload is stored under: a member's own folder, or the conversation's for a chat file. */
function newObjectKey(config: FileConfig, userId: string, extension: string, chatScopeId?: string): string {
  return config.folder === CHAT_FOLDER
    ? chatObjectKey(chatScopeId!, userId, extension)
    : `${config.folder}/${userId}/${randomUUID()}${extension}`;
}

// ===========================================
// UPLOAD FILE (Direct Upload)
// ===========================================
router.post(
  '/upload/:type',
  authenticate,
  uploadLimiter,
  onlyForChat(chatFloor),
  onlyForChat(chatAudience),
  receiveUpload(
    (req) =>
      req.params.type === CHAT_FOLDER
        ? isChatClip(req)
          ? FILE_CONFIGS.chat.maxSize
          : CHAT_FILE_LIMIT
        : (configFor(req.params.type)?.maxSize ?? null),
    'file',
    { toDisk: (req) => req.params.type === 'video' || (req.params.type === CHAT_FOLDER && isChatClip(req)) }
  ),
  async (req: AuthRequest, res, next) => {
    const file = req.file;
    try {
      const { type } = req.params;
      const chatScopeId: string | undefined = res.locals.chatScopeId;

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

      // A chat file is received to disk when the member said it is a clip and to
      // memory when she did not; what it really is has to agree with which it
      // was, or a picture would take the clip's path and miss the picture's.
      if (type === CHAT_FOLDER && file.mimetype.startsWith('video/') !== Boolean(file.path)) {
        throw new ApiError(400, file.path ? 'That file is not a video.' : 'This looks like a video and has to be sent as one.');
      }

      await assertContentMatches(file);

      const userId = req.user!.id;

      // Looked inside before anything is rewritten, moderated or stored, and as
      // received: a video is scanned from its temporary file, ahead of the
      // ffmpeg pass that would otherwise be the first thing to parse it.
      await screenUpload(file.path ? { path: file.path } : { buffer: file.buffer }, { folder: config.folder, userId });

      // A video was received to a temporary file, and is streamed from there
      // to S3 (storeFile sends it with its length, so it never has to be read
      // into memory). A production write that fails is a 503, never a copy on
      // this container's disk.
      if (file.path) {
        // A video is public the way a picture is, and was never looked at: this
        // branch returned before the picture check below, so an explicit video
        // went up as easily as a refused photograph. A few frames of it are
        // looked at now, by the same check, before it is stored.
        await screenVideoFrames(file.path, { userId });

        const key = newObjectKey(config, userId, getSafeExtensionForContentType(file.mimetype), chatScopeId);
        // What is stored is a copy without the tags the phone wrote into it
        // (where it was filmed, which phone), not the file as received.
        const clean = await videoWithoutMetadata(file);
        let url: string;
        try {
          url = await storeFile(key, clean.path, file.mimetype);
        } catch (storageError) {
          logger.error('Streamed upload could not be stored', {
            key,
            error: storageError instanceof Error ? storageError.message : String(storageError),
          });
          throw new ApiError(503, 'Media storage is unavailable. Please try again in a few minutes.');
        } finally {
          await clean.discard();
        }

        logger.info(`File uploaded: ${key} by user ${userId}`);
        res.json({
          success: true,
          data: { key, url, contentType: file.mimetype, size: clean.size },
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
        processedBuffer = await readableImage(
          sharp(file.buffer)
            .rotate()
            .resize(config.resize.width, config.resize.height, {
              fit: 'cover',
              position: 'center',
            })
            .webp({ quality: 85 })
            .toBuffer()
        );
        contentType = 'image/webp';
      } else if (file.mimetype.startsWith('image/') && !file.mimetype.includes('gif')) {
        // A picture stored at the size it was sent (a poster frame) is still
        // re-encoded, for the tags in it.
        processedBuffer = await readableImage(reencodedAsSent(file.buffer, file.mimetype));
      } else if (hasStrippableMetadata(file.mimetype)) {
        try {
          processedBuffer = await stripMediaMetadataBuffer(file.buffer, file.mimetype);
        } catch (error) {
          refuseOrPassThrough(error, 'recording');
        }
      }

      const fileExtension =
        contentType === 'image/webp'
          ? '.webp'
          : getSafeExtensionForContentType(contentType);
      const key = newObjectKey(config, userId, fileExtension, chatScopeId);

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
// validated: key must be text of at most 512 characters and validateOwnedUploadKey requires it to
//   sit under her own folder.
router.delete('/delete', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { key } = req.body;

    if (!key || typeof key !== 'string' || key.length > 512) {
      throw new ApiError(400, 'File key is required');
    }

    const { normalizedKey } = validateOwnedUploadKey(key, req.user!.id);

    let deletedFromS3 = false;
    let s3Failed = false;
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
        s3Failed = true;
        logger.warn('S3 delete failed, attempting local cleanup', {
          key: normalizedKey,
          error: (s3Error as Error).message,
        });
      }
    }

    const deletedLocally = await deleteLocalFileIfPresent(normalizedKey);

    if (!deletedFromS3 && !deletedLocally) {
      // S3 answers a delete of a key that is not there with success, so a
      // failure here is S3 failing, not the file being absent. Telling her
      // "File not found" would send her away believing it was already gone
      // when it is still stored.
      if (s3Failed) {
        throw new ApiError(503, 'We could not remove that file just now. Please try again in a few minutes.');
      }
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
// file was attached to as a résumé, or the people in the conversation a chat
// file was sent in (resolveReadableUploadKey). A local file's
// URL points back at GET /local/*, which needs the session header, so the
// web client fetches it through the API rather than as a plain link.
//
// The link lives for PRIVATE_LINK_SECONDS. It used to be an hour, which is how
// long a link copied out of the page, or out of a browser's history, kept
// opening a résumé or a photograph for whoever held it. Every page that shows
// one asks again, so nothing a member does needs it to last.
const PRIVATE_LINK_SECONDS = CHAT_LINK_SECONDS;

// validated: key must be text of at most 512 characters and resolveReadableUploadKey checks she may
//   read it.
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
          expiresIn: PRIVATE_LINK_SECONDS,
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

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: PRIVATE_LINK_SECONDS });

    res.json({
      success: true,
      data: {
        downloadUrl: signedUrl,
        fileName,
        expiresIn: PRIVATE_LINK_SECONDS,
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

    // A résumé is stored exactly as it was sent and opened by hiring staff, so
    // it is the file that most needs looking inside. With no scanner to ask it
    // is refused in production (see services/malware-scan.service).
    await screenUpload({ buffer: file.buffer }, { folder: config.folder, userId: req.user?.id });

    const fileExtension = getSafeExtensionForContentType(file.mimetype);
    const key = `${config.folder}/${req.user!.id}/${randomUUID()}${fileExtension}`;

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

    // Every picture is looked inside before the first is stored, so a refusal
    // on the fourth does not leave the first three in the bucket with nothing
    // pointing at them. A type the loop below will refuse is left for it.
    for (const file of files) {
      if (!config.allowedTypes.includes(file.mimetype)) continue;
      await assertContentMatches(file);
      await screenUpload({ buffer: file.buffer }, { folder: config.folder, userId: req.user?.id });
    }

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
        processedBuffer = await readableImage(
          sharp(file.buffer)
            .rotate()
            .resize(config.resize!.width, config.resize!.height, {
              fit: 'inside',
              withoutEnlargement: true,
            })
            .webp({ quality: 85 })
            .toBuffer()
        );
        contentType = 'image/webp';
      }

      const fileExtension =
        contentType === 'image/webp'
          ? '.webp'
          : getSafeExtensionForContentType(contentType);
      const key = `${config.folder}/${req.user!.id}/${randomUUID()}${fileExtension}`;

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
