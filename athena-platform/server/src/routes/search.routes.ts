/**
 * Search Routes
 * Advanced search with relevance ranking
 */

import { Router, Request, Response } from 'express';
import { optionalAuth, AuthRequest } from '../middleware/auth';
import * as searchService from '../services/search.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/search
 * Unified search across all content types
 */
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const {
      q,
      type = 'all',
      sort = 'relevance',
      page = '1',
      limit = '20',
      // Filters
      jobType,
      experienceLevel,
      salaryMin,
      salaryMax,
      remote,
      postType,
      hasMedia,
      level,
      free,
      role,
      verified,
    } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const salary = (salaryMin || salaryMax)
      ? {
          ...(salaryMin ? { min: parseInt(salaryMin as string) } : {}),
          ...(salaryMax ? { max: parseInt(salaryMax as string) } : {}),
        }
      : undefined;

    const options: searchService.SearchOptions = {
      query: q,
      type: type as any,
      sort: sort as any,
      page: Math.max(1, parseInt(page as string)),
      limit: Math.min(50, Math.max(1, parseInt(limit as string))),
      persona: (req as AuthRequest).user?.persona,
      filters: {
        ...(jobType && { jobType: jobType as string }),
        ...(experienceLevel && { experienceLevel: experienceLevel as string }),
        ...(salary && { salary }),
        ...(remote === 'true' && { remote: true }),
        ...(postType && { postType: postType as any }),
        ...(hasMedia === 'true' && { hasMedia: true }),
        ...(level && { level: level as string }),
        ...(free === 'true' && { free: true }),
        ...(role && { role: role as string }),
        ...(verified === 'true' && { verified: true }),
      },
    };

    const results = await searchService.search(options);
    res.json(results);
  } catch (error) {
    logger.error('Search error', { error });
    res.status(500).json({ message: 'Search failed' });
  }
});

/**
 * GET /api/search/suggestions
 * Get search suggestions for autocomplete
 */
router.get('/suggestions', async (req: Request, res: Response) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      return res.json({ suggestions: [] });
    }

    const suggestions = await searchService.getSearchSuggestions(q);
    res.json({ suggestions });
  } catch (error) {
    logger.error('Get suggestions error', { error });
    res.status(500).json({ message: 'Failed to get suggestions' });
  }
});

/**
 * GET /api/search/trending
 * Get trending search topics
 */
router.get('/trending', async (req: Request, res: Response) => {
  try {
    const trending = await searchService.getTrendingSearches();
    res.json({ trending });
  } catch (error) {
    logger.error('Get trending error', { error });
    res.status(500).json({ message: 'Failed to get trending searches' });
  }
});

/**
 * GET /api/search/users
 * Search users only
 */
router.get('/users', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { q, page = '1', limit = '20', role, verified } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const results = await searchService.search({
      query: q,
      type: 'users',
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      persona: (req as AuthRequest).user?.persona,
      filters: {
        ...(role && { role: role as string }),
        ...(verified === 'true' && { verified: true }),
      },
    });

    res.json(results);
  } catch (error) {
    logger.error('Search users error', { error });
    res.status(500).json({ message: 'Search failed' });
  }
});

/**
 * GET /api/search/posts
 * Search posts only
 */
router.get('/posts', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { q, page = '1', limit = '20', postType, hasMedia } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const results = await searchService.search({
      query: q,
      type: 'posts',
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      filters: {
        ...(postType && { postType: postType as any }),
        ...(hasMedia === 'true' && { hasMedia: true }),
      },
    });

    res.json(results);
  } catch (error) {
    logger.error('Search posts error', { error });
    res.status(500).json({ message: 'Search failed' });
  }
});

/**
 * GET /api/search/jobs
 * Search jobs only
 */
router.get('/jobs', optionalAuth, async (req: Request, res: Response) => {
  try {
    const {
      q,
      page = '1',
      limit = '20',
      jobType,
      experienceLevel,
      salaryMin,
      salaryMax,
      remote,
    } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const results = await searchService.search({
      query: q,
      type: 'jobs',
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      persona: (req as AuthRequest).user?.persona,
      filters: {
        ...(jobType && { jobType: jobType as string }),
        ...(experienceLevel && { experienceLevel: experienceLevel as string }),
        ...(salaryMin && { salary: { min: parseInt(salaryMin as string) } }),
        ...(salaryMax && { salary: { max: parseInt(salaryMax as string) } }),
        ...(remote === 'true' && { remote: true }),
      },
    });

    res.json(results);
  } catch (error) {
    logger.error('Search jobs error', { error });
    res.status(500).json({ message: 'Search failed' });
  }
});

/**
 * GET /api/search/courses
 * Search courses only
 */
router.get('/courses', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { q, page = '1', limit = '20', level, free } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const results = await searchService.search({
      query: q,
      type: 'courses',
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      filters: {
        ...(level && { level: level as string }),
        ...(free === 'true' && { free: true }),
      },
    });

    res.json(results);
  } catch (error) {
    logger.error('Search courses error', { error });
    res.status(500).json({ message: 'Search failed' });
  }
});

/**
 * GET /api/search/videos
 * Search videos only
 */
router.get('/videos', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { q, page = '1', limit = '20' } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const results = await searchService.search({
      query: q,
      type: 'videos',
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });

    res.json(results);
  } catch (error) {
    logger.error('Search videos error', { error });
    res.status(500).json({ message: 'Search failed' });
  }
});

/**
 * GET /api/search/mentors
 * Search mentors only
 */
router.get('/mentors', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { q, page = '1', limit = '20' } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const results = await searchService.search({
      query: q,
      type: 'mentors',
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      persona: (req as AuthRequest).user?.persona,
    });

    res.json(results);
  } catch (error) {
    logger.error('Search mentors error', { error });
    res.status(500).json({ message: 'Search failed' });
  }
});

export default router;
