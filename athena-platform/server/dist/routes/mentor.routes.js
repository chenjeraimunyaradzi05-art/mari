"use strict";
/**
 * Mentor Routes
 * API endpoints for mentorship marketplace
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const mentorService = __importStar(require("../services/mentor.service"));
const router = (0, express_1.Router)();
// ==========================================
// PUBLIC / SEMI-PUBLIC ENDPOINTS
// ==========================================
/**
 * GET /api/mentors
 * Search for mentors
 */
router.get('/', [
    (0, express_validator_1.query)('page').optional().isInt({ min: 1 }),
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 100 }),
    (0, express_validator_1.query)('minRate').optional().isFloat({ min: 0 }),
    (0, express_validator_1.query)('maxRate').optional().isFloat({ min: 0 }),
], async (req, res, next) => {
    try {
        const filters = {
            specialization: req.query.specialization,
            minRate: req.query.minRate ? parseFloat(req.query.minRate) : undefined,
            maxRate: req.query.maxRate ? parseFloat(req.query.maxRate) : undefined,
            available: req.query.available === 'true',
            search: req.query.search,
        };
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const result = await mentorService.getMentors(filters, page, limit);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/mentors/profile/:userId
 * Get public mentor profile
 */
router.get('/profile/:userId', async (req, res, next) => {
    try {
        const profile = await mentorService.getMentorProfile(req.params.userId);
        if (!profile) {
            throw new errorHandler_1.ApiError(404, 'Mentor profile not found');
        }
        res.json(profile);
    }
    catch (error) {
        next(error);
    }
});
// ==========================================
// PROTECTED ENDPOINTS
// ==========================================
/**
 * POST /api/mentors/me
 * Create or update own mentor profile
 */
router.post('/me', auth_1.authenticate, [
    (0, express_validator_1.body)('specializations').optional().isArray(),
    (0, express_validator_1.body)('hourlyRate').optional().isFloat({ min: 0 }),
    (0, express_validator_1.body)('yearsExperience').optional().isInt({ min: 0 }),
    (0, express_validator_1.body)('isAvailable').optional().isBoolean(),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, 'Validation failed: ' + errors.array().map(e => e.msg).join(', '));
        }
        const profile = await mentorService.updateMentorProfile(req.user.id, req.body);
        res.json(profile);
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/mentors/enable
 * Enable mentor monetization (Stripe Connect)
 */
router.post('/enable', auth_1.authenticate, async (req, res, next) => {
    try {
        const profile = await mentorService.enableMentorMonetization(req.user.id);
        res.status(201).json({ success: true, data: profile });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/mentors/onboard
 * Generate Stripe Express onboarding link
 */
router.post('/onboard', auth_1.authenticate, async (req, res, next) => {
    try {
        const url = await mentorService.generateMentorStripeOnboardingLink(req.user.id);
        res.json({ success: true, url });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/mentors/stripe-login
 * Generate Stripe Express dashboard login link
 */
router.post('/stripe-login', auth_1.authenticate, async (req, res, next) => {
    try {
        const url = await mentorService.generateMentorStripeLoginLink(req.user.id);
        res.json({ success: true, url });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/mentors/:mentorId/book
 * Request a session
 */
router.post('/:mentorId/book', auth_1.authenticate, [
    (0, express_validator_1.body)('scheduledAt').isISO8601().withMessage('Valid date required'),
    (0, express_validator_1.body)('durationMinutes').optional().isInt({ min: 15, max: 240 }),
    (0, express_validator_1.body)('note').optional().isString().isLength({ max: 500 }),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, 'Validation failed: ' + errors.array().map(e => e.msg).join(', '));
        }
        const result = await mentorService.requestSession(req.user.id, req.params.mentorId, {
            scheduledAt: new Date(req.body.scheduledAt),
            durationMinutes: req.body.durationMinutes,
            note: req.body.note,
        });
        res.status(201).json(result);
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/mentors/sessions
 * Get sessions for the current user
 */
router.get('/sessions', auth_1.authenticate, [(0, express_validator_1.query)('role').isIn(['mentor', 'mentee'])], async (req, res, next) => {
    try {
        const role = req.query.role || 'mentee';
        const sessions = await mentorService.getUserSessions(req.user.id, role);
        res.json(sessions);
    }
    catch (error) {
        next(error);
    }
});
/**
 * PATCH /api/mentors/sessions/:sessionId/status
 * Update session status (e.g., mentor accepting, or cancelling)
 */
router.patch('/sessions/:sessionId/status', auth_1.authenticate, [
    (0, express_validator_1.body)('status').isIn(['CONFIRMED', 'CANCELED', 'COMPLETED']),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, 'Validation failed: ' + errors.array().map(e => e.msg).join(', '));
        }
        const session = await mentorService.getSession(req.params.sessionId);
        if (!session)
            throw new errorHandler_1.ApiError(404, 'Session not found');
        let derivedActionBy;
        if (session.menteeId === req.user.id) {
            derivedActionBy = 'mentee';
        }
        else if (session.mentorProfile.userId === req.user.id) {
            derivedActionBy = 'mentor';
        }
        else {
            throw new errorHandler_1.ApiError(403, 'Not authorized');
        }
        const updated = await mentorService.updateSessionStatus(req.params.sessionId, req.user.id, req.body.status, derivedActionBy);
        res.json(updated);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=mentor.routes.js.map