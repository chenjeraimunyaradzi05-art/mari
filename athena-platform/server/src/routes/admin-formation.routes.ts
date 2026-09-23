/**
 * Business formation, from the platform's side.
 *
 * The formation studio charges A$49 to A$699 to register a business. A paid
 * registration walks itself to SUBMITTED and stopped there for good: the
 * state machine gives SUBMITTED one exit, MARK_UNDER_REVIEW, and nothing in
 * the server or the client had ever called it. UNDER_REVIEW, APPROVED,
 * REJECTED and COMPLETED were unreachable, no ABN or ACN was ever attached to
 * a registration, no human was paged when one arrived, and there was no way
 * to give the money back. This router is the other half of that transaction.
 *
 * Every decision goes through formation.service's adminAdvanceRegistration,
 * which runs the state machine rather than writing the status column, so the
 * state history is recorded and the applicant is told. A rejection refunds
 * the fee before it is recorded, and refuses to record the rejection if the
 * refund fails - a woman must not be refused and left out of pocket in the
 * same click.
 *
 * Guards are attached per route rather than with router.use so this router
 * can sit in front of admin.routes.ts without re-authenticating every
 * /api/admin request it does not handle, the same arrangement
 * admin-grants.routes.ts uses.
 */

import { Router, Response, NextFunction, RequestHandler } from 'express';
import { BusinessStatus } from '@prisma/client';
import { z } from 'zod';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';
import {
  FORMATION_QUEUE_STATUSES,
  adminAdvanceRegistration,
  listFormationQueue,
  refundFormationFee,
} from '../services/formation.service';

const router = Router();

const adminOnly: RequestHandler[] = [authenticate, requireRole('ADMIN')];

/**
 * The decisions staff can take, and nothing else. The state machine refuses
 * an impossible one anyway, but naming them here means the error a reviewer
 * sees is about her input rather than about a state transition.
 */
const DECISIONS = ['MARK_UNDER_REVIEW', 'REQUEST_INFO', 'APPROVE', 'REJECT', 'COMPLETE'] as const;

/** A full http(s) link and nothing else; the certificate is rendered as one. */
const httpUrl = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'must be a full http(s) link');

const decisionSchema = z.object({
  decision: z.enum(DECISIONS),
  note: z.string().trim().min(1).max(2000).optional(),
  registrationNumber: z.string().trim().min(1).max(60).optional(),
  abn: z.string().trim().max(20).optional(),
  acn: z.string().trim().max(20).optional(),
  certificateUrl: httpUrl.optional(),
});

function parse<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ApiError(400, issue ? `${issue.path.join('.') || 'input'}: ${issue.message}` : 'Invalid input');
  }
  return parsed.data;
}

const isQueueStatus = (value: string): value is BusinessStatus =>
  (FORMATION_QUEUE_STATUSES as string[]).includes(value);

// ============================================================================
// QUEUE — what is waiting on a person
// ============================================================================

router.get('/formation', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const requested = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : '';
    if (requested && !isQueueStatus(requested)) {
      throw new ApiError(400, `status must be one of ${FORMATION_QUEUE_STATUSES.join(', ')}`);
    }

    const registrations = await listFormationQueue({
      statuses: isQueueStatus(requested) ? [requested] : undefined,
    });

    res.json({ success: true, data: registrations });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// DECIDE — the only way a registration moves past SUBMITTED
// ============================================================================

router.post('/formation/:id/decision', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = parse(decisionSchema, req.body);

    const result = await adminAdvanceRegistration({
      registrationId: req.params.id,
      decision: input.decision,
      reviewerId: req.user!.id,
      note: input.note,
      registrationNumber: input.registrationNumber,
      abn: input.abn,
      acn: input.acn,
      certificateUrl: input.certificateUrl,
    });

    res.json({
      success: true,
      data: {
        registration: result.registration,
        previousState: result.previousState,
        currentState: result.currentState,
        refund: result.refund,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// REFUND — without a rejection
// ============================================================================

/**
 * Giving the fee back on its own, for a registration ATHENA cannot carry out
 * but does not want to record as refused. Idempotent: a registration already
 * refunded answers with the refund it already has.
 */
router.post('/formation/:id/refund', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { note } = parse(z.object({ note: z.string().trim().min(1).max(2000) }), req.body);

    const refund = await refundFormationFee(req.params.id, note);
    if (refund.status === 'unavailable') {
      throw new ApiError(502, `The fee could not be refunded: ${refund.reason}`);
    }

    res.json({ success: true, data: refund });
  } catch (error) {
    next(error);
  }
});

export default router;
