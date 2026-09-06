/**
 * The public side of marketing: the forms on the site that create a lead.
 * The waitlist, the contact-sales page and partner, press and influencer
 * enquiries all land here as a Lead the admin hub works from. No account is
 * needed; the rate limiter keeps a script from filling the register.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { createRateLimiter } from '../middleware/rateLimiter';
import { logger } from '../utils/logger';

const router = Router();

const PUBLIC_SOURCES = ['WAITLIST', 'CONTACT_SALES', 'PARTNER', 'PRESS', 'INFLUENCER'] as const;
type PublicSource = (typeof PUBLIC_SOURCES)[number];

const leadLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  handler: (_req, res) => {
    res.status(429).json({ success: false, message: 'Too many submissions from this address; try again in an hour.' });
  },
});

const clean = (value: unknown, max: number): string | null => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null);

// POST /api/marketing/leads
router.post(
  '/leads',
  leadLimiter,
  [
    body('email').isEmail().withMessage('Enter a valid email address').isLength({ max: 254 }).normalizeEmail(),
    body('source').isIn(PUBLIC_SOURCES).withMessage('That kind of enquiry is not accepted here'),
    body('name').optional().isString().isLength({ max: 120 }),
    body('organisation').optional().isString().isLength({ max: 160 }),
    body('role').optional().isString().isLength({ max: 120 }),
    body('interest').optional().isString().isLength({ max: 200 }),
    body('message').optional().isString().isLength({ max: 4000 }),
    body('utmSource').optional().isString().isLength({ max: 100 }),
    body('utmMedium').optional().isString().isLength({ max: 100 }),
    body('utmCampaign').optional().isString().isLength({ max: 100 }),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }
      const email = String(req.body.email).toLowerCase();
      const source = req.body.source as PublicSource;
      const utmCampaign = clean(req.body.utmCampaign, 100);

      // A campaign whose utm name matches gets the credit.
      const campaign = utmCampaign ? await prisma.marketingCampaign.findUnique({ where: { utmCampaign }, select: { id: true } }) : null;

      const details = {
        name: clean(req.body.name, 120),
        organisation: clean(req.body.organisation, 160),
        role: clean(req.body.role, 120),
        interest: clean(req.body.interest, 200),
        message: clean(req.body.message, 4000),
        utmSource: clean(req.body.utmSource, 100),
        utmMedium: clean(req.body.utmMedium, 100),
        utmCampaign,
        campaignId: campaign?.id ?? null,
      };

      // The same person on the same form twice updates what they told us
      // rather than counting twice.
      const lead = await prisma.lead.upsert({
        where: { email_source: { email, source } },
        create: { email, source, ...details },
        update: Object.fromEntries(Object.entries(details).filter(([, v]) => v !== null)),
      });

      let position: number | null = null;
      if (source === 'WAITLIST') {
        const ahead = await prisma.lead.count({ where: { source: 'WAITLIST', createdAt: { lt: lead.createdAt } } });
        position = ahead + 1;
      }

      logger.info('Lead captured', { source, leadId: lead.id });
      res.status(201).json({ success: true, data: { id: lead.id, position } });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
