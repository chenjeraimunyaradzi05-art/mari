/**
 * Reference Check Routes
 * API endpoints for reference requests and responses
 * Phase 2: Backend Logic & Integrations
 */

import { Router } from 'express';
import { referenceCheckService } from '../services/reference-check.service';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';

const router = Router();

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
 * Referee feedback is readable by the candidate it is about and by the employer
 * hiring for the job, which means the person who posted it or the staff of the
 * organization behind it.
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
  if (application.job.postedById === user.id) return true;
  if (!application.job.organizationId) return false;

  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: application.job.organizationId,
        userId: user.id,
      },
    },
    select: { id: true },
  });

  return Boolean(membership);
}

// ==========================================
// CANDIDATE ROUTES
// ==========================================

/**
 * @route POST /api/references/request
 * @desc Create a reference request
 * @access Private
 */
router.post('/request', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const {
      applicationId,
      refereeEmail,
      refereeName,
      refereeTitle,
      refereeCompany,
      relationship,
      type,
      customQuestions,
    } = req.body;
    
    if (!refereeEmail || !refereeName || !relationship || !type) {
      throw new ApiError(400, 'refereeEmail, refereeName, relationship, and type are required');
    }

    if (applicationId) {
      await requireOwnApplication(applicationId, req.user!.id);
    }

    const request = await referenceCheckService.createReferenceRequest({
      candidateId: req.user!.id,
      applicationId,
      refereeEmail,
      refereeName,
      refereeTitle,
      refereeCompany,
      relationship,
      type,
      customQuestions,
    });
    
    res.json({
      success: true,
      data: request,
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
    const { referees, applicationId } = req.body;
    
    if (!referees || !Array.isArray(referees) || referees.length === 0) {
      throw new ApiError(400, 'referees array is required');
    }

    if (applicationId) {
      await requireOwnApplication(applicationId, req.user!.id);
    }

    const result = await referenceCheckService.batchSendReferenceRequests(
      req.user!.id,
      referees,
      applicationId
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
router.get('/form/:token', async (req, res, next) => {
  try {
    const { token } = req.params;
    
    const data = await referenceCheckService.getReferenceByToken(token);
    
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
router.post('/form/:token/submit', async (req, res, next) => {
  try {
    const { token } = req.params;
    const { answers, overallRating, wouldRecommend, additionalComments } = req.body;
    
    if (!answers || !Array.isArray(answers)) {
      throw new ApiError(400, 'answers array is required');
    }
    
    if (typeof wouldRecommend !== 'boolean') {
      throw new ApiError(400, 'wouldRecommend is required');
    }
    
    const success = await referenceCheckService.submitReferenceResponse(token, {
      answers,
      overallRating,
      wouldRecommend,
      additionalComments,
      submittedAt: new Date(),
    });
    
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
router.post('/form/:token/decline', async (req, res, next) => {
  try {
    const { token } = req.params;
    const { reason } = req.body;
    
    const success = await referenceCheckService.declineReferenceRequest(token, reason);
    
    res.json({
      success,
      message: 'Reference request declined',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
