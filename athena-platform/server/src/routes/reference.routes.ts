/**
 * Reference Check Routes
 * API endpoints for reference requests and responses
 * Phase 2: Backend Logic & Integrations
 */

import { Router } from 'express';
import { z } from 'zod';
import { referenceCheckService } from '../services/reference-check.service';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';
import { publicFormLimiter } from '../middleware/socialLimits';
import { canManageJobApplicants } from '../services/hiring-access.service';

const router = Router();

/**
 * What the referee's form may send.
 *
 * Nothing about the body was checked beyond "answers is an array" and
 * "wouldRecommend is a boolean", on a route reached by a token alone and
 * whose contents are later shown to the employer: anyone holding one link
 * could store up to the body-parser's limit — megabytes of text, objects in
 * place of answers, a rating of a million — on a candidate's application.
 * The bounds are generous for a real reference and tight for anything else,
 * and a body with fields the form does not have is refused rather than
 * stored. Which questions an answer may be for, and what kind of answer each
 * takes, is checked against the request itself in the service.
 */
const MAX_REFERENCE_TEXT = 5000;

const referenceSubmissionSchema = z
  .object({
    answers: z
      .array(
        z
          .object({
            questionId: z.string().min(1).max(64),
            // Text for written and multiple-choice questions; the form sends a
            // number for a star rating and a boolean for yes or no.
            answer: z.union([
              z.string().max(MAX_REFERENCE_TEXT, 'Each answer must be 5,000 characters or fewer.'),
              z.boolean(),
              z.number().int().min(0).max(10),
            ]),
          })
          .strict(),
        { invalid_type_error: 'answers array is required', required_error: 'answers array is required' }
      )
      .max(50, 'A reference can answer at most 50 questions.'),
    overallRating: z.number().int().min(1).max(5, 'The overall rating is from 1 to 5.').nullish(),
    wouldRecommend: z.boolean({
      invalid_type_error: 'wouldRecommend is required',
      required_error: 'wouldRecommend is required',
    }),
    additionalComments: z
      .string()
      .max(MAX_REFERENCE_TEXT, 'Additional comments must be 5,000 characters or fewer.')
      .nullish(),
  })
  .strict();

const referenceDeclineSchema = z
  .object({
    reason: z.string().max(2000, 'Keep the reason to 2,000 characters or fewer.').nullish(),
  })
  .strict();

/** The body, parsed, or a 400 that says what was wrong with it. */
function parsePublicBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const unexpected = issue?.code === 'unrecognized_keys';
    throw new ApiError(
      400,
      unexpected ? 'That reference contained fields the form does not have.' : issue?.message || 'That reference could not be read.'
    );
  }
  return parsed.data;
}

/**
 * The reference service throws plain errors for a token that matches nothing.
 * On the public routes that has to be a 404 the referee can understand, not a
 * generic 500. Its submit and decline paths throw typed errors of their own —
 * a 409 for a reference already answered, a 400 for a missed question — and
 * those are passed on as they are.
 */
async function publicReference<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof Error && /not found|expired|already/i.test(error.message)) {
      throw new ApiError(/expired/i.test(error.message) ? 410 : 404, error.message);
    }
    throw error;
  }
}

/**
 * References hang off the candidate's own job application, so an applicationId
 * arriving in a request body proves nothing on its own. An application that is
 * not the caller's is reported as missing: a 403 would let anyone confirm which
 * application ids exist.
 */
async function requireOwnApplication(applicationId: string, userId: string): Promise<void> {
  const application = await prisma.jobApplication.findUnique({
    where: { id: applicationId },
    select: { userId: true },
  });

  if (!application || application.userId !== userId) {
    throw new ApiError(404, 'Application not found');
  }
}

/**
 * Referee feedback is readable by the candidate it is about and by the people
 * hiring for the job.
 *
 * "The people hiring" used to mean the person who created the listing, for
 * ever, or any member row of the organisation behind it — a VIEWER, or someone
 * who had been sent an invitation and never answered it. What a former manager
 * says about a woman is among the most sensitive things on her application, so
 * it takes the same rule as the applicant board: an accepted member with a
 * hiring role, or the poster of a listing that belongs to no organisation.
 */
async function canReadApplicationReferences(
  applicationId: string,
  user: { id: string; role: string }
): Promise<boolean> {
  const application = await prisma.jobApplication.findUnique({
    where: { id: applicationId },
    select: {
      userId: true,
      job: { select: { postedById: true, organizationId: true } },
    },
  });

  if (!application) return false;
  if (application.userId === user.id || user.role === 'ADMIN') return true;

  return canManageJobApplicants(application.job, user.id);
}

// ==========================================
// CANDIDATE ROUTES
// ==========================================

/**
 * @route POST /api/references/request
 * @desc Create a reference request
 * @access Private
 */
/**
 * A referee, as the candidate names one.
 *
 * This took whatever arrived, `customQuestions` included, and the questions
 * went out under ATHENA's name to any address typed in: a candidate could send
 * a stranger a form of her own wording, with the platform's branding on it.
 * No screen sends custom questions, so none are taken; the questions are the
 * standard set for the reference type. The other fields are bounded the way
 * the form bounds them.
 */
const REFERENCE_TYPES = ['PROFESSIONAL', 'CHARACTER', 'ACADEMIC', 'EMPLOYMENT_VERIFICATION'] as const;

const refereeSchema = z.object({
  refereeEmail: z.string().trim().email('Enter the referee’s email address.').max(254),
  refereeName: z.string().trim().min(1, 'Enter the referee’s name.').max(120),
  refereeTitle: z.string().trim().max(120).nullish(),
  refereeCompany: z.string().trim().max(160).nullish(),
  relationship: z.string().trim().min(1, 'Choose how you know the referee.').max(40),
  type: z.enum(REFERENCE_TYPES, { errorMap: () => ({ message: 'Choose a reference type.' }) }),
});

const referenceRequestSchema = refereeSchema.extend({
  applicationId: z.string().min(1).max(64).nullish(),
});

/** At most a handful at once: each one is an email to someone who did not ask for it. */
const MAX_REFEREES_PER_BATCH = 5;

const referenceBatchSchema = z.object({
  applicationId: z.string().min(1).max(64).nullish(),
  referees: z
    .array(
      z.object({
        email: refereeSchema.shape.refereeEmail,
        name: refereeSchema.shape.refereeName,
        title: refereeSchema.shape.refereeTitle,
        company: refereeSchema.shape.refereeCompany,
        relationship: refereeSchema.shape.relationship,
        type: refereeSchema.shape.type,
      })
    )
    .min(1, 'referees array is required')
    .max(MAX_REFEREES_PER_BATCH, `Ask at most ${MAX_REFEREES_PER_BATCH} referees at a time.`),
});

/** The body, parsed, or a 400 carrying the first thing wrong with it. */
function parseCandidateBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues[0]?.message || 'That reference request could not be read.');
  }
  return parsed.data;
}

router.post('/request', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { applicationId, refereeEmail, refereeName, refereeTitle, refereeCompany, relationship, type } =
      parseCandidateBody(referenceRequestSchema, req.body);

    if (applicationId) {
      await requireOwnApplication(applicationId, req.user!.id);
    }

    const request = await referenceCheckService.createReferenceRequest({
      candidateId: req.user!.id,
      applicationId: applicationId ?? undefined,
      refereeEmail,
      refereeName,
      refereeTitle: refereeTitle || undefined,
      refereeCompany: refereeCompany || undefined,
      relationship,
      type,
    });

    // Not the row. The row carries the token that opens the referee's form,
    // and handing it to the candidate let her open that form herself and
    // write her own reference, which the employer then read as the referee's.
    res.json({
      success: true,
      data: {
        id: request.id,
        applicationId: request.applicationId ?? null,
        refereeName: request.refereeName,
        refereeEmail: request.refereeEmail,
        refereeTitle: request.refereeTitle ?? null,
        refereeCompany: request.refereeCompany ?? null,
        relationship: request.relationship,
        type: request.type,
        status: request.status,
        expiresAt: request.expiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/references/batch
 * @desc Send batch reference requests
 * @access Private
 */
router.post('/batch', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { referees, applicationId } = parseCandidateBody(referenceBatchSchema, req.body);

    if (applicationId) {
      await requireOwnApplication(applicationId, req.user!.id);
    }

    const result = await referenceCheckService.batchSendReferenceRequests(
      req.user!.id,
      referees.map((referee) => ({
        ...referee,
        title: referee.title || undefined,
        company: referee.company || undefined,
      })),
      applicationId ?? undefined
    );
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/references/:referenceId/send
 * @desc Send reference request email
 * @access Private
 */
router.post('/:referenceId/send', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { referenceId } = req.params;

    const reference = await prisma.referenceRequest.findUnique({
      where: { id: referenceId },
      select: { candidateId: true },
    });

    // Only the candidate the reference is about can put their name in front of
    // a referee.
    if (!reference || reference.candidateId !== req.user!.id) {
      throw new ApiError(404, 'Reference request not found');
    }

    const success = await referenceCheckService.sendReferenceRequest(referenceId);
    
    res.json({
      success,
      message: success ? 'Reference request sent' : 'Failed to send reference request',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/references/summary
 * @desc Get reference summary for current user
 * @access Private
 */
router.get('/summary', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const summary = await referenceCheckService.getCandidateReferenceSummary(req.user!.id);
    
    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/references/application/:applicationId
 * @desc Get references for a job application
 * @access Private (Candidate or hiring employer)
 */
router.get('/application/:applicationId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { applicationId } = req.params;

    if (!(await canReadApplicationReferences(applicationId, req.user!))) {
      throw new ApiError(404, 'Application not found');
    }

    const references = await referenceCheckService.getApplicationReferences(applicationId);
    
    res.json({
      success: true,
      data: references,
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// REFEREE ROUTES (Public with token)
// ==========================================

/**
 * @route GET /api/references/form/:token
 * @desc Get reference form by token (for referee)
 * @access Public
 */
router.get('/form/:token', publicFormLimiter, async (req, res, next) => {
  try {
    const { token } = req.params;
    
    const data = await publicReference(() => referenceCheckService.getReferenceByToken(token));
    
    if (data.expired) {
      throw new ApiError(410, 'This reference request has expired');
    }
    
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/references/form/:token/submit
 * @desc Submit reference response
 * @access Public
 */
router.post('/form/:token/submit', publicFormLimiter, async (req, res, next) => {
  try {
    const { token } = req.params;
    const { answers, overallRating, wouldRecommend, additionalComments } = parsePublicBody(
      referenceSubmissionSchema,
      req.body
    );

    const success = await publicReference(() => referenceCheckService.submitReferenceResponse(token, {
      answers,
      overallRating: overallRating ?? undefined,
      wouldRecommend,
      additionalComments: additionalComments?.trim() || undefined,
      submittedAt: new Date(),
    }));
    
    res.json({
      success,
      message: 'Thank you for submitting your reference',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/references/form/:token/decline
 * @desc Decline reference request
 * @access Public
 */
router.post('/form/:token/decline', publicFormLimiter, async (req, res, next) => {
  try {
    const { token } = req.params;
    const { reason } = parsePublicBody(referenceDeclineSchema, req.body);

    const success = await publicReference(() =>
      referenceCheckService.declineReferenceRequest(token, reason ?? undefined)
    );
    
    res.json({
      success,
      message: 'Reference request declined',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
