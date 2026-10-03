/**
 * Reference Check Service
 * Automated reference request and verification system
 * Phase 2: Backend Logic & Integrations
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';
import { emailService } from './email.service';
import crypto from 'crypto';

// ==========================================
// TYPES
// ==========================================

export type ReferenceStatus = 
  | 'PENDING'
  | 'SENT'
  | 'COMPLETED'
  | 'EXPIRED'
  | 'DECLINED';

export type ReferenceType =
  | 'PROFESSIONAL'
  | 'CHARACTER'
  | 'ACADEMIC'
  | 'EMPLOYMENT_VERIFICATION';

export interface ReferenceRequest {
  id: string;
  candidateId: string;
  applicationId?: string;
  refereeEmail: string;
  refereeName: string;
  refereeTitle?: string;
  refereeCompany?: string;
  relationship: string;
  type: ReferenceType;
  status: ReferenceStatus;
  token: string;
  questions: ReferenceQuestion[];
  response?: ReferenceResponse;
  requestedAt: Date;
  sentAt?: Date;
  completedAt?: Date;
  expiresAt: Date;
}

export interface ReferenceQuestion {
  id: string;
  question: string;
  type: 'TEXT' | 'RATING' | 'YES_NO' | 'MULTIPLE_CHOICE';
  options?: string[];
  required: boolean;
}

export interface ReferenceResponse {
  answers: {
    questionId: string;
    answer: string | number | boolean;
  }[];
  overallRating?: number;
  wouldRecommend: boolean;
  additionalComments?: string;
  submittedAt: Date;
}

// ==========================================
// DEFAULT QUESTIONS
// ==========================================

const DEFAULT_PROFESSIONAL_QUESTIONS: ReferenceQuestion[] = [
  {
    id: 'q1',
    question: 'How long have you known the candidate and in what capacity?',
    type: 'TEXT',
    required: true,
  },
  {
    id: 'q2',
    question: 'How would you rate their overall job performance?',
    type: 'RATING',
    required: true,
  },
  {
    id: 'q3',
    question: 'What are their key strengths?',
    type: 'TEXT',
    required: true,
  },
  {
    id: 'q4',
    question: 'What areas could they improve in?',
    type: 'TEXT',
    required: true,
  },
  {
    id: 'q5',
    question: 'How would you rate their communication skills?',
    type: 'RATING',
    required: true,
  },
  {
    id: 'q6',
    question: 'How would you rate their teamwork abilities?',
    type: 'RATING',
    required: true,
  },
  {
    id: 'q7',
    question: 'Would you rehire this person if given the opportunity?',
    type: 'YES_NO',
    required: true,
  },
  {
    id: 'q8',
    question: 'Is there anything else you would like to add?',
    type: 'TEXT',
    required: false,
  },
];

const DEFAULT_CHARACTER_QUESTIONS: ReferenceQuestion[] = [
  {
    id: 'c1',
    question: 'How long have you known the candidate?',
    type: 'TEXT',
    required: true,
  },
  {
    id: 'c2',
    question: 'How would you describe their character?',
    type: 'TEXT',
    required: true,
  },
  {
    id: 'c3',
    question: 'How would you rate their reliability?',
    type: 'RATING',
    required: true,
  },
  {
    id: 'c4',
    question: 'How would you rate their integrity?',
    type: 'RATING',
    required: true,
  },
  {
    id: 'c5',
    question: 'Would you recommend them for a position of trust?',
    type: 'YES_NO',
    required: true,
  },
];

const DEFAULT_EMPLOYMENT_VERIFICATION_QUESTIONS: ReferenceQuestion[] = [
  {
    id: 'e1',
    question: 'Please confirm the candidate\'s job title during their employment.',
    type: 'TEXT',
    required: true,
  },
  {
    id: 'e2',
    question: 'Please confirm their dates of employment.',
    type: 'TEXT',
    required: true,
  },
  {
    id: 'e3',
    question: 'What were their primary responsibilities?',
    type: 'TEXT',
    required: true,
  },
  {
    id: 'e4',
    question: 'What was the reason for leaving?',
    type: 'MULTIPLE_CHOICE',
    options: ['Resigned', 'Laid Off', 'Terminated', 'Contract Ended', 'Other'],
    required: true,
  },
  {
    id: 'e5',
    question: 'Is the candidate eligible for rehire?',
    type: 'YES_NO',
    required: true,
  },
];

// ==========================================
// REFERENCE REQUEST MANAGEMENT
// ==========================================

/**
 * Create a new reference request
 */
export async function createReferenceRequest(data: {
  candidateId: string;
  applicationId?: string;
  refereeEmail: string;
  refereeName: string;
  refereeTitle?: string;
  refereeCompany?: string;
  relationship: string;
  type: ReferenceType;
  customQuestions?: ReferenceQuestion[];
  expiresInDays?: number;
}): Promise<ReferenceRequest> {
  // Generate secure token
  const token = crypto.randomBytes(32).toString('hex');
  
  // Set expiration (default 14 days)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (data.expiresInDays || 14));
  
  // Get questions based on type
  let questions = data.customQuestions;
  if (!questions) {
    switch (data.type) {
      case 'PROFESSIONAL':
        questions = DEFAULT_PROFESSIONAL_QUESTIONS;
        break;
      case 'CHARACTER':
        questions = DEFAULT_CHARACTER_QUESTIONS;
        break;
      case 'EMPLOYMENT_VERIFICATION':
        questions = DEFAULT_EMPLOYMENT_VERIFICATION_QUESTIONS;
        break;
      default:
        questions = DEFAULT_PROFESSIONAL_QUESTIONS;
    }
  }
  
  // Create in database
  const reference = await prisma.referenceRequest.create({
    data: {
      candidateId: data.candidateId,
      applicationId: data.applicationId,
      refereeEmail: data.refereeEmail,
      refereeName: data.refereeName,
      refereeTitle: data.refereeTitle,
      refereeCompany: data.refereeCompany,
      relationship: data.relationship,
      type: data.type,
      status: 'PENDING',
      token,
      customQuestions: questions as any,
      expiresAt,
    },
  });
  
  logger.info(`Created reference request ${reference.id} for candidate ${data.candidateId}`);
  
  return reference as unknown as ReferenceRequest;
}

/**
 * Send reference request email to referee
 */
export async function sendReferenceRequest(
  referenceId: string
): Promise<boolean> {
  const reference = await prisma.referenceRequest.findUnique({
    where: { id: referenceId },
    include: {
      candidate: { select: { displayName: true, firstName: true, lastName: true } },
      application: {
        include: {
          job: {
            select: { title: true, organization: { select: { name: true } } },
          },
        },
      },
    },
  });
  
  if (!reference) {
    throw new Error('Reference request not found');
  }
  
  if (reference.status !== 'PENDING') {
    throw new Error('Reference request has already been processed');
  }
  
  const candidateName = reference.candidate?.displayName 
    || `${reference.candidate?.firstName} ${reference.candidate?.lastName}`;
  
  // Build reference form URL
  const referenceUrl = `${process.env.CLIENT_URL}/reference/${reference.token}`;
  
  // Send email
  try {
    await emailService.sendEmail({
      to: reference.refereeEmail,
      subject: `Reference Request for ${candidateName}`,
      template: 'reference-request',
      data: {
        refereeName: reference.refereeName,
        candidateName,
        relationship: reference.relationship,
        jobTitle: reference.application?.job?.title,
        companyName: reference.application?.job?.organization?.name,
        referenceUrl,
        expiresAt: reference.expiresAt,
      },
    });
    
    // Update status
    await prisma.referenceRequest.update({
      where: { id: referenceId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
      },
    });
    
    // The referee's address is hers to give and ours to keep out of the log: the
    // request id finds the row.
    logger.info('Sent a reference request email', { referenceId });
    return true;
  } catch (error) {
    logger.error('Failed to send a reference request email', { referenceId, error });
    return false;
  }
}

/**
 * Batch send reference requests
 */
export async function batchSendReferenceRequests(
  candidateId: string,
  referees: Array<{
    email: string;
    name: string;
    title?: string;
    company?: string;
    relationship: string;
    type: ReferenceType;
  }>,
  applicationId?: string
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  
  for (const referee of referees) {
    try {
      const request = await createReferenceRequest({
        candidateId,
        applicationId,
        refereeEmail: referee.email,
        refereeName: referee.name,
        refereeTitle: referee.title,
        refereeCompany: referee.company,
        relationship: referee.relationship,
        type: referee.type,
      });
      
      const success = await sendReferenceRequest(request.id);
      if (success) {
        sent++;
      } else {
        failed++;
      }
    } catch (error) {
      logger.error('Failed to create or send a reference request', { candidateId, error });
      failed++;
    }
  }
  
  return { sent, failed };
}

// ==========================================
// REFERENCE RESPONSE HANDLING
// ==========================================

/**
 * Get reference request by token (for referee to view)
 */
export async function getReferenceByToken(token: string): Promise<{
  request: Partial<ReferenceRequest>;
  candidate: any;
  expired: boolean;
}> {
  const reference = await prisma.referenceRequest.findUnique({
    where: { token },
    include: {
      candidate: {
        select: {
          displayName: true,
          firstName: true,
          lastName: true,
          avatar: true,
          headline: true,
        },
      },
    },
  });
  
  if (!reference) {
    throw new Error('Reference request not found');
  }
  
  const expired = reference.expiresAt ? new Date() > reference.expiresAt : false;
  
  // Don't expose sensitive data
  return {
    request: {
      id: reference.id,
      refereeName: reference.refereeName,
      relationship: reference.relationship,
      type: reference.type as ReferenceType,
      status: reference.status as ReferenceStatus,
      questions: reference.customQuestions as unknown as ReferenceQuestion[],
      expiresAt: reference.expiresAt ?? undefined,
    },
    candidate: reference.candidate,
    expired,
  };
}

/**
 * The referee's answers, kept to the questions she was actually asked and to
 * the kind of answer each one takes.
 *
 * Answers were stored as they arrived. The form is reached by a token alone,
 * and what it stores is shown to the employer beside the candidate's
 * application, so an answer to a question nobody asked, a rating of 400 or a
 * "yes or no" answered with an essay all went straight onto that page. An
 * answer for a question that is not on this request is dropped; one of the
 * wrong kind is refused. A later answer to the same question replaces an
 * earlier one, and a blank text answer counts as no answer.
 */
function checkedAnswers(
  questions: ReferenceQuestion[],
  submitted: ReferenceResponse['answers']
): ReferenceResponse['answers'] {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const kept = new Map<string, ReferenceResponse['answers'][number]>();

  for (const { questionId, answer } of submitted) {
    const question = byId.get(questionId);
    if (!question) continue;

    switch (question.type) {
      case 'RATING':
        if (typeof answer !== 'number' || !Number.isInteger(answer) || answer < 1 || answer > 5) {
          throw new ApiError(400, 'Each rating must be a whole number from 1 to 5.');
        }
        break;
      case 'YES_NO':
        if (typeof answer !== 'boolean') {
          throw new ApiError(400, 'Each yes-or-no question needs a yes or a no.');
        }
        break;
      case 'MULTIPLE_CHOICE':
        if (typeof answer !== 'string' || !(question.options ?? []).includes(answer)) {
          throw new ApiError(400, 'Choose one of the options offered for each multiple-choice question.');
        }
        break;
      default:
        if (typeof answer !== 'string') {
          throw new ApiError(400, 'Each written answer must be text.');
        }
        if (!answer.trim()) {
          kept.delete(questionId);
          continue;
        }
    }

    kept.set(questionId, { questionId, answer: typeof answer === 'string' ? answer.trim() : answer });
  }

  return Array.from(kept.values());
}

/**
 * Submit reference response
 */
export async function submitReferenceResponse(
  token: string,
  response: ReferenceResponse
): Promise<boolean> {
  const reference = await prisma.referenceRequest.findUnique({
    where: { token },
    include: {
      candidate: { select: { id: true, email: true, displayName: true } },
      application: {
        include: {
          job: {
            include: {
              organization: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  
  // Typed errors rather than plain ones. The route turned any plain error it
  // did not recognise into a 500, so a referee who missed a question, or who
  // opened the link again after declining, was told the server had broken.
  if (!reference) {
    throw new ApiError(404, 'Reference request not found');
  }

  if (reference.status === 'COMPLETED') {
    throw new ApiError(409, 'This reference has already been submitted');
  }

  if (reference.status === 'DECLINED') {
    throw new ApiError(409, 'This reference request was declined, so it can no longer be answered');
  }

  if (reference.expiresAt && new Date() > reference.expiresAt) {
    await prisma.referenceRequest.update({
      where: { id: reference.id },
      data: { status: 'EXPIRED' },
    });
    throw new ApiError(410, 'This reference request has expired');
  }

  const questions = (reference.customQuestions || []) as unknown as ReferenceQuestion[];
  const answers = checkedAnswers(questions, response.answers);

  const answeredIds = new Set(answers.map((a) => a.questionId));
  const missingRequired = questions.filter((q) => q.required && !answeredIds.has(q.id));

  if (missingRequired.length > 0) {
    throw new ApiError(
      400,
      `Please answer every required question before submitting (${missingRequired.length} still to answer).`
    );
  }

  // Only a request still waiting on the referee moves to COMPLETED. Two
  // submissions racing each other used to both pass the status check above
  // and the second overwrote the first.
  const saved = await prisma.referenceRequest.updateMany({
    where: { id: reference.id, status: { notIn: ['COMPLETED', 'DECLINED', 'EXPIRED'] } },
    data: {
      status: 'COMPLETED',
      responses: {
        answers,
        overallRating: response.overallRating,
        wouldRecommend: response.wouldRecommend,
        additionalComments: response.additionalComments,
        submittedAt: new Date(),
      } as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  });
  if (saved.count === 0) {
    throw new ApiError(409, 'This reference has already been submitted');
  }
  
  // Notify candidate - use candidateId since we don't have candidate included
  logger.info(`Reference ${reference.id} completed, candidate ${reference.candidateId} will be notified`);
  
  // Update application if linked
  if (reference.applicationId) {
    await updateApplicationReferenceStatus(reference.applicationId);
  }
  
  logger.info('A reference was completed by its referee', { referenceId: reference.id });
  
  return true;
}

/**
 * Decline reference request
 */
export async function declineReferenceRequest(
  token: string,
  reason?: string
): Promise<boolean> {
  const reference = await prisma.referenceRequest.findUnique({
    where: { token },
  });
  
  if (!reference) {
    throw new ApiError(404, 'Reference request not found');
  }

  if (reference.status === 'COMPLETED') {
    throw new ApiError(409, 'This reference has already been submitted');
  }

  // The same guard the submit path uses: only a request still waiting on the
  // referee moves to DECLINED. A second decline, or one racing a submission,
  // used to overwrite the stored reason or the submitted answers.
  const declined = await prisma.referenceRequest.updateMany({
    where: { id: reference.id, status: { notIn: ['COMPLETED', 'DECLINED', 'EXPIRED'] } },
    data: {
      status: 'DECLINED',
      responses: { declined: true, reason: reason?.trim() || null },
    },
  });
  if (declined.count === 0) {
    throw new ApiError(409, 'This reference request has already been answered or has expired');
  }

  logger.info('A reference was declined by its referee', { referenceId: reference.id });
  
  return true;
}

// ==========================================
// REFERENCE ANALYTICS
// ==========================================

/**
 * Get reference summary for a candidate
 */
export async function getCandidateReferenceSummary(candidateId: string): Promise<{
  total: number;
  completed: number;
  pending: number;
  averageRating: number | null;
  wouldRecommendPercentage: number | null;
}> {
  const references = await prisma.referenceRequest.findMany({
    where: { candidateId },
  });
  
  const completed = references.filter((r) => r.status === 'COMPLETED');
  const pending = references.filter((r) => 
    r.status === 'PENDING' || r.status === 'SENT'
  );
  
  // Calculate average rating from responses
  let totalRating = 0;
  let ratingCount = 0;
  let recommendCount = 0;
  
  for (const ref of completed) {
    const responses = ref.responses as unknown as ReferenceResponse;
    if (responses?.overallRating) {
      totalRating += responses.overallRating;
      ratingCount++;
    }
    if (responses?.wouldRecommend) {
      recommendCount++;
    }
  }
  
  return {
    total: references.length,
    completed: completed.length,
    pending: pending.length,
    averageRating: ratingCount > 0 ? totalRating / ratingCount : null,
    wouldRecommendPercentage: completed.length > 0 
      ? (recommendCount / completed.length) * 100 
      : null,
  };
}

/**
 * Get references for a job application
 */
export async function getApplicationReferences(applicationId: string): Promise<any[]> {
  return prisma.referenceRequest.findMany({
    where: { applicationId },
    select: {
      id: true,
      refereeName: true,
      refereeTitle: true,
      refereeCompany: true,
      relationship: true,
      type: true,
      status: true,
      sentAt: true,
      completedAt: true,
      responses: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Update application reference status
 */
async function updateApplicationReferenceStatus(applicationId: string): Promise<void> {
  const references = await prisma.referenceRequest.findMany({
    where: { applicationId },
  });
  
  const allCompleted = references.every((r: { status: string }) => r.status === 'COMPLETED');
  const completedCount = references.filter((r: { status: string }) => r.status === 'COMPLETED').length;
  
  // Update application metadata
  await prisma.jobApplication.update({
    where: { id: applicationId },
    data: {
      referenceStatus: allCompleted ? 'COMPLETE' : 'PARTIAL',
      referencesReceived: completedCount,
      referencesTotal: references.length,
    },
  });
}

// ==========================================
// REMINDER & CLEANUP JOBS
// ==========================================

/**
 * Send reminder emails for pending references
 */
export async function sendReferenceReminders(): Promise<{ sent: number }> {
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  
  const pendingReferences = await prisma.referenceRequest.findMany({
    where: {
      status: 'SENT',
      sentAt: { lte: threeDaysAgo },
      expiresAt: { gt: new Date() },
      // Haven't been reminded in the last 3 days
      lastReminderAt: {
        OR: [
          { equals: null },
          { lte: threeDaysAgo },
        ],
      } as any,
    },
    include: {
      candidate: { select: { displayName: true } },
    },
  });
  
  let sent = 0;
  
  for (const reference of pendingReferences) {
    try {
      await emailService.sendEmail({
        to: reference.refereeEmail,
        subject: `Reminder: Reference Request for ${reference.candidate?.displayName}`,
        template: 'reference-reminder',
        data: {
          refereeName: reference.refereeName,
          candidateName: reference.candidate?.displayName,
          referenceUrl: `${process.env.CLIENT_URL}/reference/${reference.token}`,
          expiresAt: reference.expiresAt,
        },
      });
      
      await prisma.referenceRequest.update({
        where: { id: reference.id },
        data: { lastReminderAt: new Date() },
      });
      
      sent++;
    } catch (error) {
      logger.error(`Failed to send reminder for reference ${reference.id}: ${error}`);
    }
  }
  
  logger.info(`Sent ${sent} reference reminders`);
  return { sent };
}

/**
 * Mark expired reference requests
 */
export async function markExpiredReferences(): Promise<{ expired: number }> {
  const result = await prisma.referenceRequest.updateMany({
    where: {
      status: { in: ['PENDING', 'SENT'] },
      expiresAt: { lte: new Date() },
    },
    data: {
      status: 'EXPIRED',
    },
  });
  
  if (result.count > 0) {
    logger.info(`Marked ${result.count} reference requests as expired`);
  }
  
  return { expired: result.count };
}

export const referenceCheckService = {
  createReferenceRequest,
  sendReferenceRequest,
  batchSendReferenceRequests,
  getReferenceByToken,
  submitReferenceResponse,
  declineReferenceRequest,
  getCandidateReferenceSummary,
  getApplicationReferences,
  sendReferenceReminders,
  markExpiredReferences,
};
