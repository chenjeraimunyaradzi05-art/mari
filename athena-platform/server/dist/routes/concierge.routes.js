"use strict";
/**
 * Concierge Routes
 * AI Concierge / Career coaching assistant endpoints
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
const auth_1 = require("../middleware/auth");
const conciergeService = __importStar(require("../services/concierge.service"));
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
/**
 * @route POST /api/concierge/chat
 * @desc Send a message to the AI Concierge
 * @access Private
 */
router.post('/chat', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { message, conversationHistory } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }
        const response = await conciergeService.chat(userId, message, conversationHistory || []);
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Concierge chat error', { error });
        res.status(500).json({ error: 'Failed to process message' });
    }
});
/**
 * @route GET /api/concierge/suggestions
 * @desc Get proactive suggestions based on user context
 * @access Private
 */
router.get('/suggestions', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const suggestions = await conciergeService.getProactiveSuggestions(userId);
        res.json({ suggestions });
    }
    catch (error) {
        logger_1.logger.error('Failed to get suggestions', { error });
        res.status(500).json({ error: 'Failed to get suggestions' });
    }
});
/**
 * @route POST /api/concierge/intent
 * @desc Process a specific intent directly
 * @access Private
 */
router.post('/intent', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { intent, parameters } = req.body;
        if (!intent) {
            return res.status(400).json({ error: 'Intent is required' });
        }
        const result = await conciergeService.handleIntent(userId, intent, parameters || {});
        res.json(result);
    }
    catch (error) {
        logger_1.logger.error('Intent processing error', { error });
        res.status(500).json({ error: 'Failed to process intent' });
    }
});
/**
 * @route GET /api/concierge/faq
 * @desc Search FAQ knowledge base
 * @access Public
 */
router.get('/faq', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.status(400).json({ error: 'Query parameter "q" is required' });
        }
        const faq = conciergeService.searchFAQ(q);
        res.json({ results: faq });
    }
    catch (error) {
        logger_1.logger.error('FAQ search error', { error });
        res.status(500).json({ error: 'Failed to search FAQ' });
    }
});
/**
 * @route GET /api/concierge/onboarding
 * @desc Get personalized onboarding steps
 * @access Private
 */
router.get('/onboarding', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const steps = await conciergeService.getOnboardingSteps(userId);
        res.json({ steps });
    }
    catch (error) {
        logger_1.logger.error('Failed to get onboarding steps', { error });
        res.status(500).json({ error: 'Failed to get onboarding steps' });
    }
});
exports.default = router;
//# sourceMappingURL=concierge.routes.js.map