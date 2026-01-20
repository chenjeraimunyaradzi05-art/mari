"use strict";
/**
 * Stories Routes
 * Stories, ephemeral content, status updates
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const story_service_1 = require("../services/story.service");
const router = (0, express_1.Router)();
/**
 * POST /api/stories
 * Create a new story
 */
router.post('/', auth_1.authenticate, [
    (0, express_validator_1.body)('type').isIn(['image', 'video', 'text', 'poll', 'question', 'link']),
    (0, express_validator_1.body)('content').isObject(),
    (0, express_validator_1.body)('visibility').optional().isIn(['public', 'followers', 'close_friends', 'connections']),
    (0, express_validator_1.body)('duration').optional().isInt({ min: 1, max: 168 }), // Max 1 week
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const story = await story_service_1.storyService.createStory(req.user.id, {
            type: req.body.type,
            content: req.body.content,
            visibility: req.body.visibility,
            duration: req.body.duration,
        });
        res.status(201).json({
            success: true,
            data: story,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/stories/feed
 * Get stories feed for current user
 */
router.get('/feed', auth_1.authenticate, async (req, res, next) => {
    try {
        const { limit, cursor } = req.query;
        const feed = await story_service_1.storyService.getStoriesFeed(req.user.id, {
            limit: limit ? parseInt(limit) : undefined,
            cursor: cursor,
        });
        res.json({
            success: true,
            data: feed,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/stories/user/:userId
 * Get stories for a specific user
 */
router.get('/user/:userId', auth_1.optionalAuth, async (req, res, next) => {
    try {
        const stories = await story_service_1.storyService.getUserStories(req.params.userId, req.user?.id);
        res.json({
            success: true,
            data: stories,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/stories/:id
 * Get a specific story
 */
router.get('/:id', auth_1.optionalAuth, async (req, res, next) => {
    try {
        // View the story
        if (req.user) {
            await story_service_1.storyService.viewStory(req.params.id, req.user.id);
        }
        res.json({
            success: true,
            message: 'Story viewed',
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/stories/:id/view
 * Mark story as viewed
 */
router.post('/:id/view', auth_1.authenticate, async (req, res, next) => {
    try {
        await story_service_1.storyService.viewStory(req.params.id, req.user.id);
        res.json({
            success: true,
            message: 'Story viewed',
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/stories/:id/viewers
 * Get story viewers (only for story owner)
 */
router.get('/:id/viewers', auth_1.authenticate, async (req, res, next) => {
    try {
        const viewers = await story_service_1.storyService.getStoryViewers(req.params.id, req.user.id);
        res.json({
            success: true,
            data: viewers,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/stories/:id/react
 * React to a story
 */
router.post('/:id/react', auth_1.authenticate, [(0, express_validator_1.body)('emoji').isString().notEmpty()], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        await story_service_1.storyService.reactToStory(req.params.id, req.user.id, req.body.emoji);
        res.json({
            success: true,
            message: 'Reaction added',
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/stories/:id/reply
 * Reply to a story
 */
router.post('/:id/reply', auth_1.authenticate, [(0, express_validator_1.body)('text').isString().notEmpty().trim().isLength({ max: 500 })], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const reply = await story_service_1.storyService.replyToStory(req.params.id, req.user.id, req.body.text);
        res.json({
            success: true,
            data: reply,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * DELETE /api/stories/:id
 * Delete a story
 */
router.delete('/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        await story_service_1.storyService.deleteStory(req.params.id, req.user.id);
        res.json({
            success: true,
            message: 'Story deleted',
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/stories/:id/poll/vote
 * Vote on a story poll
 */
router.post('/:id/poll/vote', auth_1.authenticate, [(0, express_validator_1.body)('optionId').isString().notEmpty()], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        await story_service_1.storyService.votePoll(req.params.id, req.user.id, req.body.optionId);
        res.json({
            success: true,
            message: 'Vote recorded',
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/stories/:id/question/answer
 * Answer a story question
 */
router.post('/:id/question/answer', auth_1.authenticate, [
    (0, express_validator_1.body)('answer').isString().notEmpty().trim().isLength({ max: 500 }),
    (0, express_validator_1.body)('anonymous').optional().isBoolean(),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        await story_service_1.storyService.answerQuestion(req.params.id, req.user.id, req.body.answer, req.body.anonymous);
        res.json({
            success: true,
            message: 'Answer submitted',
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/stories/highlights
 * Create a story highlight
 */
router.post('/highlights', auth_1.authenticate, [
    (0, express_validator_1.body)('title').isString().notEmpty().trim().isLength({ max: 50 }),
    (0, express_validator_1.body)('coverUrl').optional().isURL(),
    (0, express_validator_1.body)('storyIds').isArray({ min: 1 }),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const highlight = await story_service_1.storyService.createHighlight(req.user.id, {
            title: req.body.title,
            coverUrl: req.body.coverUrl,
            storyIds: req.body.storyIds,
        });
        res.status(201).json({
            success: true,
            data: highlight,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/stories/highlights/:userId
 * Get user's story highlights
 */
router.get('/highlights/:userId', auth_1.optionalAuth, async (req, res, next) => {
    try {
        const highlights = await story_service_1.storyService.getUserHighlights(req.params.userId);
        res.json({
            success: true,
            data: highlights,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/stories/status
 * Update user status
 */
router.post('/status', auth_1.authenticate, [
    (0, express_validator_1.body)('type').isIn(['availability', 'activity', 'milestone', 'mood', 'custom']),
    (0, express_validator_1.body)('status').isString().notEmpty().trim().isLength({ max: 100 }),
    (0, express_validator_1.body)('emoji').optional().isString(),
    (0, express_validator_1.body)('duration').optional().isInt({ min: 1, max: 168 }), // Max 1 week
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const status = await story_service_1.storyService.updateStatus(req.user.id, {
            type: req.body.type,
            status: req.body.status,
            emoji: req.body.emoji,
            duration: req.body.duration,
        });
        res.json({
            success: true,
            data: status,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/stories/status/:userId
 * Get user status
 */
router.get('/status/:userId', auth_1.optionalAuth, async (req, res, next) => {
    try {
        const status = await story_service_1.storyService.getUserStatus(req.params.userId);
        res.json({
            success: true,
            data: status,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=story.routes.js.map