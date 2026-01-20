"use strict";
/**
 * Search Routes
 * Advanced search with relevance ranking
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
const searchService = __importStar(require("../services/search.service"));
const router = (0, express_1.Router)();
/**
 * GET /api/search
 * Unified search across all content types
 */
router.get('/', auth_1.optionalAuth, async (req, res) => {
    try {
        const { q, type = 'all', sort = 'relevance', page = '1', limit = '20', 
        // Filters
        jobType, experienceLevel, salaryMin, salaryMax, remote, postType, hasMedia, level, free, role, verified, } = req.query;
        if (!q || typeof q !== 'string') {
            return res.status(400).json({ message: 'Search query is required' });
        }
        const salary = (salaryMin || salaryMax)
            ? {
                ...(salaryMin ? { min: parseInt(salaryMin) } : {}),
                ...(salaryMax ? { max: parseInt(salaryMax) } : {}),
            }
            : undefined;
        const options = {
            query: q,
            type: type,
            sort: sort,
            page: Math.max(1, parseInt(page)),
            limit: Math.min(50, Math.max(1, parseInt(limit))),
            persona: req.user?.persona,
            filters: {
                ...(jobType && { jobType: jobType }),
                ...(experienceLevel && { experienceLevel: experienceLevel }),
                ...(salary && { salary }),
                ...(remote === 'true' && { remote: true }),
                ...(postType && { postType: postType }),
                ...(hasMedia === 'true' && { hasMedia: true }),
                ...(level && { level: level }),
                ...(free === 'true' && { free: true }),
                ...(role && { role: role }),
                ...(verified === 'true' && { verified: true }),
            },
        };
        const results = await searchService.search(options);
        res.json(results);
    }
    catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ message: 'Search failed' });
    }
});
/**
 * GET /api/search/suggestions
 * Get search suggestions for autocomplete
 */
router.get('/suggestions', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || typeof q !== 'string') {
            return res.json({ suggestions: [] });
        }
        const suggestions = await searchService.getSearchSuggestions(q);
        res.json({ suggestions });
    }
    catch (error) {
        console.error('Get suggestions error:', error);
        res.status(500).json({ message: 'Failed to get suggestions' });
    }
});
/**
 * GET /api/search/trending
 * Get trending search topics
 */
router.get('/trending', async (req, res) => {
    try {
        const trending = await searchService.getTrendingSearches();
        res.json({ trending });
    }
    catch (error) {
        console.error('Get trending error:', error);
        res.status(500).json({ message: 'Failed to get trending searches' });
    }
});
/**
 * GET /api/search/users
 * Search users only
 */
router.get('/users', auth_1.optionalAuth, async (req, res) => {
    try {
        const { q, page = '1', limit = '20', role, verified } = req.query;
        if (!q || typeof q !== 'string') {
            return res.status(400).json({ message: 'Search query is required' });
        }
        const results = await searchService.search({
            query: q,
            type: 'users',
            page: parseInt(page),
            limit: parseInt(limit),
            persona: req.user?.persona,
            filters: {
                ...(role && { role: role }),
                ...(verified === 'true' && { verified: true }),
            },
        });
        res.json(results);
    }
    catch (error) {
        console.error('Search users error:', error);
        res.status(500).json({ message: 'Search failed' });
    }
});
/**
 * GET /api/search/posts
 * Search posts only
 */
router.get('/posts', auth_1.optionalAuth, async (req, res) => {
    try {
        const { q, page = '1', limit = '20', postType, hasMedia } = req.query;
        if (!q || typeof q !== 'string') {
            return res.status(400).json({ message: 'Search query is required' });
        }
        const results = await searchService.search({
            query: q,
            type: 'posts',
            page: parseInt(page),
            limit: parseInt(limit),
            filters: {
                ...(postType && { postType: postType }),
                ...(hasMedia === 'true' && { hasMedia: true }),
            },
        });
        res.json(results);
    }
    catch (error) {
        console.error('Search posts error:', error);
        res.status(500).json({ message: 'Search failed' });
    }
});
/**
 * GET /api/search/jobs
 * Search jobs only
 */
router.get('/jobs', auth_1.optionalAuth, async (req, res) => {
    try {
        const { q, page = '1', limit = '20', jobType, experienceLevel, salaryMin, salaryMax, remote, } = req.query;
        if (!q || typeof q !== 'string') {
            return res.status(400).json({ message: 'Search query is required' });
        }
        const results = await searchService.search({
            query: q,
            type: 'jobs',
            page: parseInt(page),
            limit: parseInt(limit),
            persona: req.user?.persona,
            filters: {
                ...(jobType && { jobType: jobType }),
                ...(experienceLevel && { experienceLevel: experienceLevel }),
                ...(salaryMin && { salary: { min: parseInt(salaryMin) } }),
                ...(salaryMax && { salary: { max: parseInt(salaryMax) } }),
                ...(remote === 'true' && { remote: true }),
            },
        });
        res.json(results);
    }
    catch (error) {
        console.error('Search jobs error:', error);
        res.status(500).json({ message: 'Search failed' });
    }
});
/**
 * GET /api/search/courses
 * Search courses only
 */
router.get('/courses', auth_1.optionalAuth, async (req, res) => {
    try {
        const { q, page = '1', limit = '20', level, free } = req.query;
        if (!q || typeof q !== 'string') {
            return res.status(400).json({ message: 'Search query is required' });
        }
        const results = await searchService.search({
            query: q,
            type: 'courses',
            page: parseInt(page),
            limit: parseInt(limit),
            filters: {
                ...(level && { level: level }),
                ...(free === 'true' && { free: true }),
            },
        });
        res.json(results);
    }
    catch (error) {
        console.error('Search courses error:', error);
        res.status(500).json({ message: 'Search failed' });
    }
});
/**
 * GET /api/search/videos
 * Search videos only
 */
router.get('/videos', auth_1.optionalAuth, async (req, res) => {
    try {
        const { q, page = '1', limit = '20' } = req.query;
        if (!q || typeof q !== 'string') {
            return res.status(400).json({ message: 'Search query is required' });
        }
        const results = await searchService.search({
            query: q,
            type: 'videos',
            page: parseInt(page),
            limit: parseInt(limit),
        });
        res.json(results);
    }
    catch (error) {
        console.error('Search videos error:', error);
        res.status(500).json({ message: 'Search failed' });
    }
});
/**
 * GET /api/search/mentors
 * Search mentors only
 */
router.get('/mentors', auth_1.optionalAuth, async (req, res) => {
    try {
        const { q, page = '1', limit = '20' } = req.query;
        if (!q || typeof q !== 'string') {
            return res.status(400).json({ message: 'Search query is required' });
        }
        const results = await searchService.search({
            query: q,
            type: 'mentors',
            page: parseInt(page),
            limit: parseInt(limit),
            persona: req.user?.persona,
        });
        res.json(results);
    }
    catch (error) {
        console.error('Search mentors error:', error);
        res.status(500).json({ message: 'Search failed' });
    }
});
exports.default = router;
//# sourceMappingURL=search.routes.js.map