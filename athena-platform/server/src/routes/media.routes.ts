import { Router } from 'express';
import multer from 'multer';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { moderateImage } from '../services/moderation.service';

const router = Router();

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
  },
  cover: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    folder: 'covers',
    resize: { width: 1500, height: 500 },
  },
  post: {
    maxSize: 20 * 1024 * 1024, // 20MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    folder: 'posts',
    resize: { width: 1200, height: 1200 },
  },
  video: {
    maxSize: 500 * 1024 * 1024, // 500MB
    allowedTypes: ['video/mp4', 'video/quicktime', 'video/webm'],
    folder: 'videos',
    resize: null,
  },
  document: {
    maxSize: 25 * 1024 * 1024, // 25MB
    allowedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    folder: 'documents',
    resize: null,
  },
  resume: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    folder: 'resumes',
    resize: null,
  },
};

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max (for videos)
  },
});

// ===========================================
// GET PRESIGNED UPLOAD URL
// ===========================================
router.post('/presigned-url', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { fileType, fileName, contentType } = req.body;

    if (!fileType || !fileName || !contentType) {
      throw new ApiError(400, 'fileType, fileName, and contentType are required');
    }

    const config = FILE_CONFIGS[fileType as keyof typeof FILE_CONFIGS];
    if (!config) {
      throw new ApiError(400, 'Invalid file type');
    }

    if (!config.allowedTypes.includes(contentType)) {
      throw new ApiError(400, `Invalid content type for ${fileType}`);
    }

    const fileExtension = path.extname(fileName);
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
router.post('/upload/:type', authenticate, upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    const { type } = req.params;
    const file = req.file;

    logger.info(`Upload request received: type=${type}, hasFile=${!!file}`);

    if (!file) {
      throw new ApiError(400, 'No file provided');
    }

    logger.info(`File details: name=${file.originalname}, size=${file.size}, mimetype=${file.mimetype}`);

    const config = FILE_CONFIGS[type as keyof typeof FILE_CONFIGS];
    if (!config) {
      throw new ApiError(400, 'Invalid upload type');
    }

    if (!config.allowedTypes.includes(file.mimetype)) {
      throw new ApiError(400, `Invalid file type. Allowed: ${config.allowedTypes.join(', ')}`);
    }

    if (file.size > config.maxSize) {
      throw new ApiError(400, `File too large. Max size: ${config.maxSize / (1024 * 1024)}MB`);
    }

    let processedBuffer = file.buffer;
    let contentType = file.mimetype;

    // Moderate content before processing/upload
    if (file.mimetype.startsWith('image/')) {
        const moderationResult = await moderateImage(file.buffer);
        if (moderationResult.action === 'block') {
            logger.warn('Image upload blocked by moderation', { userId: req.user?.id, reason: moderationResult.reason });
            throw new ApiError(400, `Image rejected: ${moderationResult.reason}`);
        }
        // If 'review', we could flag it in DB but allow upload. For now, strict allowance.
    }

    // Process images
    if (config.resize && file.mimetype.startsWith('image/') && !file.mimetype.includes('gif')) {
      processedBuffer = await sharp(file.buffer)
        .resize(config.resize.width, config.resize.height, {
          fit: 'cover',
          position: 'center',
        })
        .webp({ quality: 85 })
        .toBuffer();
      contentType = 'image/webp';
    }

    const fileExtension = contentType === 'image/webp' ? '.webp' : path.extname(file.originalname);
    const key = `${config.folder}/${req.user!.id}/${uuidv4()}${fileExtension}`;

    let publicUrl: string;

    // Helper function to save file locally
    const saveLocally = async (buffer: Buffer): Promise<string> => {
      const uploadsDir = path.join(__dirname, '../../uploads');
      const filePath = path.join(uploadsDir, key);
      const dir = path.dirname(filePath);

      logger.info(`Saving file locally: uploadsDir=${uploadsDir}, filePath=${filePath}`);

      if (!fs.existsSync(dir)) {
        logger.info(`Creating directory: ${dir}`);
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, buffer);
      logger.info(`File written successfully: ${filePath}, size=${buffer.length}`);
      
      // Return relative path so it works with Next.js rewrites and avoiding mixed content/CORS issues
      // The Next.js frontend is configured to proxy /uploads/* to the backend
      const localUrl = `/uploads/${key}`;
      
      logger.info(`File saved locally: ${filePath}, URL: ${localUrl}`);
      return localUrl;
    };

    logger.info(`AWS credentials check: hasKeyId=${!!process.env.AWS_ACCESS_KEY_ID}, hasSecret=${!!process.env.AWS_SECRET_ACCESS_KEY}`);

    // Try S3 if credentials are present, fallback to local storage on failure
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
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
        // S3 failed, fallback to local storage
        logger.warn(`S3 upload failed, falling back to local storage: ${(s3Error as Error).message}`);
        publicUrl = await saveLocally(processedBuffer);
      }
    } else {
      // No S3 credentials, use local storage
      publicUrl = await saveLocally(processedBuffer);
    }

    // Update user profile if avatar
    if (type === 'avatar') {
      await prisma.user.update({
        where: { id: req.user!.id },
        data: { avatar: publicUrl },
      });
    }
    // Note: cover image field not in schema - store URL but don't persist to DB

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

    // Verify ownership (key should contain user ID)
    if (!key.includes(req.user!.id)) {
      throw new ApiError(403, 'Not authorized to delete this file');
    }

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );

    logger.info(`File deleted: ${key} by user ${req.user!.id}`);

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

    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
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

// ===========================================
// UPLOAD RESUME
// ===========================================
router.post('/resume', authenticate, upload.single('resume'), async (req: AuthRequest, res, next) => {
  try {
    const file = req.file;

    if (!file) {
      throw new ApiError(400, 'No resume file provided');
    }

    const config = FILE_CONFIGS.resume;

    if (!config.allowedTypes.includes(file.mimetype)) {
      throw new ApiError(400, 'Invalid file type. Only PDF and Word documents are allowed.');
    }

    if (file.size > config.maxSize) {
      throw new ApiError(400, `File too large. Max size: ${config.maxSize / (1024 * 1024)}MB`);
    }

    const fileExtension = path.extname(file.originalname);
    const key = `${config.folder}/${req.user!.id}/${uuidv4()}${fileExtension}`;

    let publicUrl: string;

    // Helper function to save file locally
    const saveLocally = async (buffer: Buffer): Promise<string> => {
      const uploadsDir = path.join(__dirname, '../../uploads');
      const filePath = path.join(uploadsDir, key);
      const dir = path.dirname(filePath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, buffer);
      
      const apiUrl = process.env.API_URL || 'http://localhost:5000';
      logger.info(`Resume saved locally: ${filePath}`);
      return `${apiUrl}/uploads/${key}`;
    };

    // Try S3 if credentials are present, fallback to local storage on failure
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
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
        logger.warn(`S3 resume upload failed, falling back to local storage: ${(s3Error as Error).message}`);
        publicUrl = await saveLocally(file.buffer);
      }
    } else {
      publicUrl = await saveLocally(file.buffer);
    }

    // Store resume as media asset - URL is returned to client
    // Resume can be fetched from MediaAsset by type 'resume'

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
router.post('/post-images', authenticate, upload.array('images', 10), async (req: AuthRequest, res, next) => {
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

      let processedBuffer = file.buffer;
      let contentType = file.mimetype;

      // Process images (except GIFs)
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

      const fileExtension = contentType === 'image/webp' ? '.webp' : path.extname(file.originalname);
      const key = `${config.folder}/${req.user!.id}/${uuidv4()}${fileExtension}`;

      let fileUrl: string;

      // Helper function to save file locally
      const saveLocally = async (buffer: Buffer, fileKey: string): Promise<string> => {
        const uploadsDir = path.join(__dirname, '../../uploads');
        const filePath = path.join(uploadsDir, fileKey);
        const dir = path.dirname(filePath);

        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(filePath, buffer);
        
        const apiUrl = process.env.API_URL || 'http://localhost:5000';
        logger.info(`Post image saved locally: ${filePath}`);
        return `${apiUrl}/uploads/${fileKey}`;
      };

      // Try S3 if credentials are present, fallback to local storage on failure
      if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
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
          logger.warn(`S3 post image upload failed, falling back to local storage: ${(s3Error as Error).message}`);
          fileUrl = await saveLocally(processedBuffer, key);
        }
      } else {
        fileUrl = await saveLocally(processedBuffer, key);
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
