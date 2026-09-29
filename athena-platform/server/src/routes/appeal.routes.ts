import { Router, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import { AppealStatus, AppealType, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { reverseEnforcement } from '../services/content-report.service';
// Audit rows here follow a committed change, so a failed insert is logged
// rather than turned into a 500 for work that succeeded.
import { auditAfterCommit } from '../services/admin-audit.service';
import { escapeHtml, sendEmail } from '../services/email.service';
import { bestEffort } from '../utils/best-effort';
import { logger } from '../utils/logger';
import { recordFailure } from '../utils/ops-metrics';

const router = Router();

const APPEAL_TYPES = Object.values(AppealType);
const APPEAL_STATUSES = Object.values(AppealStatus);

/** How much free-form context an appeal may carry beside its reason. */
const MAX_METADATA_BYTES = 8000;

// ===========================================
// SUBMIT APPEAL
// ===========================================
router.post(
  '/',
  authenticate,
  [
    body('type').isIn(APPEAL_TYPES),
    body('reason').isString().notEmpty().isLength({ max: 5000 }).withMessage('Reason must be less than 5000 characters'),
    // The form sends its own details — which action, a reference, where to
    // write back — as an object. Anything else, or anything large enough to be
    // a payload rather than context, is refused rather than stored.
    body('metadata')
      .optional({ values: 'null' })
      .custom((value) => {
        if (typeof value !== 'object' || Array.isArray(value)) {
          throw new Error('metadata must be an object');
        }
        if (JSON.stringify(value).length > MAX_METADATA_BYTES) {
          throw new Error('Please keep the extra details shorter');
        }
        return true;
      }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { type, reason, metadata } = req.body;

      const appeal = await prisma.appeal.create({
        data: {
          userId: req.user!.id,
          type,
          reason,
          metadata: metadata ?? undefined,
          status: 'PENDING',
        },
      });

      await auditAfterCommit({
        action: 'USER_APPEAL_SUBMIT',
        actorUserId: req.user?.id ?? null,
        targetUserId: req.user?.id ?? null,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || undefined,
        metadata: { appealId: appeal.id, type },
      });

      res.status(201).json({
        success: true,
        data: appeal,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// LIST CURRENT USER APPEALS
// ===========================================
router.get('/me', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const appeals = await prisma.appeal.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: appeals,
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// LIST APPEALS (admins and moderators)
// ===========================================
/**
 * The appeals queue, a page at a time.
 *
 * This read every appeal on every load, with the member attached to each, so
 * the page grew heavier with every appeal ever filed and would eventually stop
 * loading at all. It is paged now, oldest waiting first for the open statuses
 * so the longest wait is at the top, and newest first for decided ones.
 */
router.get(
  '/',
  authenticate,
  requireRole('ADMIN', 'MODERATOR'),
  [
    query('status').optional().isIn(APPEAL_STATUSES),
    query('type').optional().isIn(APPEAL_TYPES),
    query('userId').optional().isString().trim().isLength({ min: 1, max: 100 }),
    query('page').optional().isInt({ min: 1, max: 10_000 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const status = req.query.status as AppealStatus | undefined;
      const type = req.query.type as AppealType | undefined;
      const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 50);

      const where: Prisma.AppealWhereInput = {
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
        ...(userId ? { userId } : {}),
      };
      const waiting = status === 'PENDING' || status === 'UNDER_REVIEW';

      const [appeals, total] = await Promise.all([
        prisma.appeal.findMany({
          where,
          orderBy: { createdAt: waiting ? 'asc' : 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        }),
        prisma.appeal.count({ where }),
      ]);

      res.json({
        success: true,
        data: appeals,
        total,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// ADMIN REVIEW APPEAL
// ===========================================

type AppealMetadata = {
  reportId?: unknown;
  referenceId?: unknown;
  contentType?: unknown;
  contentId?: unknown;
  contactEmail?: unknown;
  submittedFrom?: unknown;
};

function readMetadata(value: Prisma.JsonValue | null): AppealMetadata {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as AppealMetadata) : {};
}

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);

/**
 * The report an appeal is about, when the member named one.
 *
 * The appeal form asks for a reference and sends it as referenceId; the
 * reversal only ever looked for reportId, which the form never sends. So an
 * upheld appeal against a removed post restored nothing unless someone had
 * written the id in by hand. The reference is now looked up — as a report id or
 * as the RPT- reference the reporter was emailed — and only a report made
 * against this member's own account is accepted, so an appeal cannot be used to
 * reverse a decision about somebody else.
 */
async function reportForAppeal(userId: string, metadata: AppealMetadata): Promise<string | null> {
  const named = text(metadata.reportId) ?? text(metadata.referenceId);
  if (!named || named.length > 100) return null;

  const report =
    (await prisma.contentReport.findFirst({
      where: { id: named, reportedUserId: userId },
      select: { id: true },
    })) ??
    (await prisma.contentReport.findFirst({
      where: { reportedUserId: userId, evidence: { path: ['ticketId'], equals: named } },
      select: { id: true },
    }));

  return report?.id ?? null;
}

const DECISION_WORDS: Record<'APPROVED' | 'REJECTED', string> = {
  APPROVED: 'upheld',
  REJECTED: 'not upheld',
};

/**
 * What a member is told about her appeal, and what happens next.
 *
 * An upheld verification appeal does not verify her: it sends her request back
 * to the women-only reviewer, who decides again with her appeal in front of
 * them. Saying "you are verified" would be a promise the platform has not made.
 */
function decisionMessage(type: AppealType, status: 'APPROVED' | 'REJECTED', reversal: Reversal | null): string {
  if (status === 'REJECTED') {
    return 'We looked at your appeal again and the original decision stands.';
  }
  if (type === 'VERIFICATION_DECISION') {
    return reversal?.verificationReopened
      ? 'Your appeal was upheld. Your women-only verification is back with a reviewer, who will decide again with your appeal in front of them.'
      : 'Your appeal was upheld. A reviewer will be in touch about your verification.';
  }
  if (reversal?.banKept) {
    return 'Your appeal about this content was upheld. Your account remains banned; that is a separate decision, which you can appeal on its own.';
  }
  if (reversal?.suspensionLifted) {
    return 'Your appeal was upheld and your account has been restored. You can sign in again.';
  }
  if (reversal?.contentRestored) {
    return 'Your appeal was upheld and your content has been restored.';
  }
  return 'Your appeal was upheld.';
}

type Reversal = Partial<Awaited<ReturnType<typeof reverseEnforcement>>> & { verificationReopened?: boolean };

/**
 * Tell her the decision, in the app and by email.
 *
 * She was told nothing at all: the decision was written to the appeal row and
 * the audit log, and the member who asked found out only if she went looking.
 * An appeal against a suspension filed from the sign-in page is the sharpest
 * case, because she cannot sign in to read an in-app notice — so every decision
 * goes by email as well, to the address she asked us to use if she gave one,
 * otherwise to her account's. Neither send is allowed to undo or fail the
 * decision, which has already been recorded; a failure is counted instead.
 */
async function tellMemberOfDecision(input: {
  appealId: string;
  userId: string;
  type: AppealType;
  status: 'APPROVED' | 'REJECTED';
  decisionNote: string | null;
  metadata: AppealMetadata;
  reversal: Reversal | null;
}): Promise<void> {
  const message = decisionMessage(input.type, input.status, input.reversal);
  const title = `Your appeal was ${DECISION_WORDS[input.status]}`;

  await bestEffort('appeal decision notification', () =>
    prisma.notification.create({
      data: {
        userId: input.userId,
        type: 'SYSTEM',
        title,
        message,
        link: '/help/appeals',
        data: { appealId: input.appealId, status: input.status },
      },
    })
  );

  const account = await bestEffort(
    'appeal decision recipient',
    () => prisma.user.findUnique({ where: { id: input.userId }, select: { email: true, firstName: true } }),
    null
  );
  const to = text(input.metadata.contactEmail) ?? account?.email ?? null;
  if (!to) {
    recordFailure('appeal.decision-email', new Error('no address to tell the member of her appeal decision'));
    return;
  }

  const base = (process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  const greeting = account?.firstName ? `Hi ${escapeHtml(account.firstName)},` : 'Hi,';
  const note = input.decisionNote ? `<p><strong>From the reviewer:</strong> ${escapeHtml(input.decisionNote)}</p>` : '';

  const sent = await bestEffort(
    'appeal decision email',
    () =>
      sendEmail({
        to,
        subject: title,
        html: `<p>${greeting}</p><p>${escapeHtml(message)}</p>${note}<p><a href="${base}/help/appeals">See your appeals</a></p><p>ATHENA Trust &amp; Safety</p>`,
        text: `${message}${input.decisionNote ? `\n\nFrom the reviewer: ${input.decisionNote}` : ''}\n\nSee your appeals: ${base}/help/appeals`,
      }),
    false
  );
  if (!sent) {
    logger.error('An appeal decision could not be emailed to the member', { appealId: input.appealId });
    recordFailure('appeal.decision-email', new Error('appeal decision email was not sent'));
  }
}

router.patch(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'MODERATOR'),
  [
    body('status').isIn(['UNDER_REVIEW', 'APPROVED', 'REJECTED']),
    body('decisionNote').optional({ values: 'null' }).isString().isLength({ max: 2000 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const status = req.body.status as 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
      const decisionNote = text(req.body.decisionNote);

      const existing = await prisma.appeal.findUnique({ where: { id } });
      if (!existing) {
        throw new ApiError(404, 'Appeal not found');
      }
      // A decided appeal is decided. Deciding it again would reverse the
      // enforcement a second time, or put back a decision the member has
      // already been told was overturned.
      if (existing.status === 'APPROVED' || existing.status === 'REJECTED') {
        throw new ApiError(409, 'This appeal has already been decided');
      }

      const appeal = await prisma.appeal.update({
        where: { id },
        data: {
          status,
          decisionNote,
          reviewedAt: new Date(),
          reviewedById: req.user!.id,
        },
      });

      const metadata = readMetadata(appeal.metadata);
      let reversal: Reversal | null = null;

      if (status === 'APPROVED') {
        // Upholding an appeal has to undo what was done, otherwise the decision
        // is only ever paperwork.
        if (appeal.type === 'CONTENT_MODERATION' || appeal.type === 'ACCOUNT_SUSPENSION') {
          reversal = await reverseEnforcement({
            userId: appeal.userId,
            reportId: await reportForAppeal(appeal.userId, metadata),
            contentType: text(metadata.contentType),
            contentId: text(metadata.contentId),
            // Bans and suspensions are both appealed as ACCOUNT_SUSPENSION: an
            // upheld appeal against the account's lock lifts a ban too. An
            // appeal about one piece of content does not.
            liftBan: appeal.type === 'ACCOUNT_SUSPENSION',
          });
        } else if (appeal.type === 'VERIFICATION_DECISION') {
          // Upholding her appeal used to leave her REJECTED, and the only
          // other way back — asking again — refuses a rejected member by
          // design. Her request goes back to PENDING, which puts her in front
          // of the women-only reviewer again; the reviewer, not the appeal,
          // makes the verification decision.
          const reopened = await prisma.user.updateMany({
            where: { id: appeal.userId, womanVerificationStatus: 'REJECTED' },
            data: { womanVerificationStatus: 'PENDING', womanVerifiedAt: null },
          });
          reversal = { verificationReopened: reopened.count > 0 };
        }
      }

      await auditAfterCommit({
        action: 'ADMIN_APPEAL_DECISION',
        actorUserId: req.user?.id ?? null,
        targetUserId: appeal.userId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || undefined,
        metadata: { appealId: appeal.id, type: appeal.type, status, decisionNote, reversal },
      });

      if (status === 'APPROVED' || status === 'REJECTED') {
        await tellMemberOfDecision({
          appealId: appeal.id,
          userId: appeal.userId,
          type: appeal.type,
          status,
          decisionNote,
          metadata,
          reversal,
        });
      }

      res.json({
        success: true,
        data: appeal,
        reversal,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
