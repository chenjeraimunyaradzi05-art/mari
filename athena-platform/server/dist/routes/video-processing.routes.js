"use strict";
/**
 * Video Processing Routes
 * Video upload, transcoding, captions, and effects
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const video_processing_service_1 = require("../services/video-processing.service");
const router = (0, express_1.Router)();
/**
 * POST /api/video-processing/submit
 * Submit video for processing
 */
router.post('/submit', auth_1.authenticate, [
    (0, express_validator_1.body)('videoId').isString().notEmpty(),
    (0, express_validator_1.body)('videoUrl').isString().notEmpty(),
    (0, express_validator_1.body)('generateCaptions').optional().isBoolean(),
    (0, express_validator_1.body)('presets').optional().isArray(),
    (0, express_validator_1.body)('effects').optional().isArray(),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const { videoId, videoUrl, generateCaptions, presets, effects } = req.body;
        const job = await video_processing_service_1.videoProcessingService.submitForProcessing(videoId, videoUrl, {
            generateCaptions: generateCaptions ?? true,
            presets: presets || ['mobile', 'hd'],
            effects,
        });
        res.status(202).json({
            success: true,
            data: {
                jobId: job.id,
                status: job.status,
                message: 'Video submitted for processing',
            },
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/video-processing/job/:jobId
 * Get processing job status
 */
router.get('/job/:jobId', auth_1.authenticate, async (req, res, next) => {
    try {
        const { jobId } = req.params;
        const job = video_processing_service_1.videoProcessingService.getJobStatus(jobId);
        if (!job) {
            throw new errorHandler_1.ApiError(404, 'Processing job not found');
        }
        res.json({
            success: true,
            data: job,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/video-processing/effects
 * Get available video effects
 */
router.get('/effects', async (_req, res, next) => {
    try {
        res.json({
            success: true,
            data: {
                effects: video_processing_service_1.VIDEO_EFFECTS,
                categories: ['filter', 'transition', 'overlay', 'speed', 'audio'],
            },
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/video-processing/effects/:category
 * Get effects by category
 */
router.get('/effects/:category', async (req, res, next) => {
    try {
        const { category } = req.params;
        const validCategories = ['filter', 'transition', 'overlay', 'speed', 'audio'];
        if (!validCategories.includes(category)) {
            throw new errorHandler_1.ApiError(400, 'Invalid category');
        }
        const effects = video_processing_service_1.videoProcessingService.getEffectsByCategory(category);
        res.json({
            success: true,
            data: effects,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/video-processing/presets
 * Get available transcoding presets
 */
router.get('/presets', async (_req, res, next) => {
    try {
        res.json({
            success: true,
            data: video_processing_service_1.VIDEO_PRESETS,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/video-processing/captions
 * Upload custom captions
 */
router.post('/captions', auth_1.authenticate, [
    (0, express_validator_1.body)('videoId').isString().notEmpty(),
    (0, express_validator_1.body)('language').isString().notEmpty(),
    (0, express_validator_1.body)('content').isString().notEmpty(),
    (0, express_validator_1.body)('format').optional().isIn(['vtt', 'srt']),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const { videoId, language, content, format } = req.body;
        const caption = await video_processing_service_1.videoProcessingService.uploadCaptions(videoId, language, content, format || 'vtt');
        res.json({
            success: true,
            data: caption,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/video-processing/captions/generate
 * Generate auto-captions for video
 */
router.post('/captions/generate', auth_1.authenticate, [
    (0, express_validator_1.body)('videoId').isString().notEmpty(),
    (0, express_validator_1.body)('videoUrl').isString().notEmpty(),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const { videoId, videoUrl } = req.body;
        const captions = await video_processing_service_1.videoProcessingService.generateCaptions(videoUrl, videoId);
        res.json({
            success: true,
            data: captions,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/video-processing/thumbnail
 * Generate video thumbnail
 */
router.post('/thumbnail', auth_1.authenticate, [
    (0, express_validator_1.body)('videoId').isString().notEmpty(),
    (0, express_validator_1.body)('videoUrl').isString().notEmpty(),
    (0, express_validator_1.body)('timestamp').optional().isFloat({ min: 0 }),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const { videoId, videoUrl } = req.body;
        const thumbnailUrl = await video_processing_service_1.videoProcessingService.generateThumbnail(videoUrl, videoId);
        res.json({
            success: true,
            data: { thumbnailUrl },
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/video-processing/chunked-upload/start
 * Start chunked upload session for large videos
 */
router.post('/chunked-upload/start', auth_1.authenticate, [
    (0, express_validator_1.body)('fileName').isString().notEmpty(),
    (0, express_validator_1.body)('fileSize').isInt({ min: 1 }),
    (0, express_validator_1.body)('contentType').isString().notEmpty(),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const { fileName, fileSize, contentType } = req.body;
        // Validate file size (max 500MB)
        if (fileSize > 500 * 1024 * 1024) {
            throw new errorHandler_1.ApiError(400, 'File size exceeds maximum of 500MB');
        }
        // Validate content type
        const allowedTypes = ['video/mp4', 'video/quicktime', 'video/webm'];
        if (!allowedTypes.includes(contentType)) {
            throw new errorHandler_1.ApiError(400, 'Invalid video format');
        }
        const session = await video_processing_service_1.videoProcessingService.createChunkedUploadSession(req.user.id, fileName, fileSize, contentType);
        res.json({
            success: true,
            data: session,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/video-processing/chunked-upload/complete
 * Complete chunked upload and start processing
 */
router.post('/chunked-upload/complete', auth_1.authenticate, [
    (0, express_validator_1.body)('sessionId').isString().notEmpty(),
    (0, express_validator_1.body)('title').optional().isString(),
    (0, express_validator_1.body)('description').optional().isString(),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const { sessionId, title, description } = req.body;
        const result = await video_processing_service_1.videoProcessingService.completeChunkedUpload(sessionId, req.user.id, title, description);
        res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=video-processing.routes.js.map