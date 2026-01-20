"use strict";
/**
 * Reference Check Service
 * Automated reference request and verification system
 * Phase 2: Backend Logic & Integrations
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.referenceCheckService = void 0;
exports.createReferenceRequest = createReferenceRequest;
exports.sendReferenceRequest = sendReferenceRequest;
exports.batchSendReferenceRequests = batchSendReferenceRequests;
exports.getReferenceByToken = getReferenceByToken;
exports.submitReferenceResponse = submitReferenceResponse;
exports.declineReferenceRequest = declineReferenceRequest;
exports.getCandidateReferenceSummary = getCandidateReferenceSummary;
exports.getApplicationReferences = getApplicationReferences;
exports.sendReferenceReminders = sendReferenceReminders;
exports.markExpiredReferences = markExpiredReferences;
const prisma_1 = require("../utils/prisma");
const logger_1 = require("../utils/logger");
const email_service_1 = require("./email.service");
const crypto_1 = __importDefault(require("crypto"));
// ==========================================
// DEFAULT QUESTIONS
// ==========================================
const DEFAULT_PROFESSIONAL_QUESTIONS = [
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
const DEFAULT_CHARACTER_QUESTIONS = [
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
const DEFAULT_EMPLOYMENT_VERIFICATION_QUESTIONS = [
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
async function createReferenceRequest(data) {
    // Generate secure token
    const token = crypto_1.default.randomBytes(32).toString('hex');
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
    const reference = await prisma_1.prisma.referenceRequest.create({
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
            questions: questions,
            expiresAt,
        },
    });
    logger_1.logger.info(`Created reference request ${reference.id} for candidate ${data.candidateId}`);
    return reference;
}
/**
 * Send reference request email to referee
 */
async function sendReferenceRequest(referenceId) {
    const reference = await prisma_1.prisma.referenceRequest.findUnique({
        where: { id: referenceId },
        include: {
            candidate: { select: { displayName: true, firstName: true, lastName: true } },
            application: {
                include: {
                    job: { select: { title: true } },
                    organization: { select: { name: true } },
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
        await email_service_1.emailService.sendEmail({
            to: reference.refereeEmail,
            subject: `Reference Request for ${candidateName}`,
            template: 'reference-request',
            data: {
                refereeName: reference.refereeName,
                candidateName,
                relationship: reference.relationship,
                jobTitle: reference.application?.job?.title,
                companyName: reference.application?.organization?.name,
                referenceUrl,
                expiresAt: reference.expiresAt,
            },
        });
        // Update status
        await prisma_1.prisma.referenceRequest.update({
            where: { id: referenceId },
            data: {
                status: 'SENT',
                sentAt: new Date(),
            },
        });
        logger_1.logger.info(`Sent reference request email to ${reference.refereeEmail}`);
        return true;
    }
    catch (error) {
        logger_1.logger.error(`Failed to send reference request email: ${error}`);
        return false;
    }
}
/**
 * Batch send reference requests
 */
async function batchSendReferenceRequests(candidateId, referees, applicationId) {
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
            }
            else {
                failed++;
            }
        }
        catch (error) {
            logger_1.logger.error(`Failed to create/send reference request for ${referee.email}: ${error}`);
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
async function getReferenceByToken(token) {
    const reference = await prisma_1.prisma.referenceRequest.findUnique({
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
    const expired = new Date() > reference.expiresAt;
    // Don't expose sensitive data
    return {
        request: {
            id: reference.id,
            refereeName: reference.refereeName,
            relationship: reference.relationship,
            type: reference.type,
            status: reference.status,
            questions: reference.questions,
            expiresAt: reference.expiresAt,
        },
        candidate: reference.candidate,
        expired,
    };
}
/**
 * Submit reference response
 */
async function submitReferenceResponse(token, response) {
    const reference = await prisma_1.prisma.referenceRequest.findUnique({
        where: { token },
        include: {
            candidate: { select: { id: true, email: true, displayName: true } },
            application: {
                include: {
                    organization: { select: { name: true } },
                },
            },
        },
    });
    if (!reference) {
        throw new Error('Reference request not found');
    }
    if (reference.status === 'COMPLETED') {
        throw new Error('Reference has already been submitted');
    }
    if (reference.status === 'DECLINED') {
        throw new Error('Reference request was declined');
    }
    if (new Date() > reference.expiresAt) {
        await prisma_1.prisma.referenceRequest.update({
            where: { id: reference.id },
            data: { status: 'EXPIRED' },
        });
        throw new Error('Reference request has expired');
    }
    // Validate required questions are answered
    const questions = reference.questions;
    const requiredQuestionIds = questions
        .filter((q) => q.required)
        .map((q) => q.id);
    const answeredIds = response.answers.map((a) => a.questionId);
    const missingRequired = requiredQuestionIds.filter((id) => !answeredIds.includes(id));
    if (missingRequired.length > 0) {
        throw new Error(`Missing required answers: ${missingRequired.join(', ')}`);
    }
    // Save response
    await prisma_1.prisma.referenceRequest.update({
        where: { id: reference.id },
        data: {
            status: 'COMPLETED',
            response: {
                ...response,
                submittedAt: new Date(),
            },
            completedAt: new Date(),
        },
    });
    // Notify candidate
    if (reference.candidate?.email) {
        // Send notification (could be email or in-app)
        logger_1.logger.info(`Notifying candidate ${reference.candidate.id} of completed reference`);
    }
    // Update application if linked
    if (reference.applicationId) {
        await updateApplicationReferenceStatus(reference.applicationId);
    }
    logger_1.logger.info(`Reference ${reference.id} completed by ${reference.refereeEmail}`);
    return true;
}
/**
 * Decline reference request
 */
async function declineReferenceRequest(token, reason) {
    const reference = await prisma_1.prisma.referenceRequest.findUnique({
        where: { token },
    });
    if (!reference) {
        throw new Error('Reference request not found');
    }
    if (reference.status === 'COMPLETED') {
        throw new Error('Reference has already been submitted');
    }
    await prisma_1.prisma.referenceRequest.update({
        where: { id: reference.id },
        data: {
            status: 'DECLINED',
            response: { declined: true, reason },
        },
    });
    logger_1.logger.info(`Reference ${reference.id} declined by ${reference.refereeEmail}`);
    return true;
}
// ==========================================
// REFERENCE ANALYTICS
// ==========================================
/**
 * Get reference summary for a candidate
 */
async function getCandidateReferenceSummary(candidateId) {
    const references = await prisma_1.prisma.referenceRequest.findMany({
        where: { candidateId },
    });
    const completed = references.filter((r) => r.status === 'COMPLETED');
    const pending = references.filter((r) => r.status === 'PENDING' || r.status === 'SENT');
    // Calculate average rating from responses
    let totalRating = 0;
    let ratingCount = 0;
    let recommendCount = 0;
    for (const ref of completed) {
        const response = ref.response;
        if (response?.overallRating) {
            totalRating += response.overallRating;
            ratingCount++;
        }
        if (response?.wouldRecommend) {
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
async function getApplicationReferences(applicationId) {
    return prisma_1.prisma.referenceRequest.findMany({
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
            response: true,
        },
        orderBy: { createdAt: 'desc' },
    });
}
/**
 * Update application reference status
 */
async function updateApplicationReferenceStatus(applicationId) {
    const references = await prisma_1.prisma.referenceRequest.findMany({
        where: { applicationId },
    });
    const allCompleted = references.every((r) => r.status === 'COMPLETED');
    const completedCount = references.filter((r) => r.status === 'COMPLETED').length;
    // Update application metadata
    await prisma_1.prisma.application.update({
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
async function sendReferenceReminders() {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const pendingReferences = await prisma_1.prisma.referenceRequest.findMany({
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
            },
        },
        include: {
            candidate: { select: { displayName: true } },
        },
    });
    let sent = 0;
    for (const reference of pendingReferences) {
        try {
            await email_service_1.emailService.sendEmail({
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
            await prisma_1.prisma.referenceRequest.update({
                where: { id: reference.id },
                data: { lastReminderAt: new Date() },
            });
            sent++;
        }
        catch (error) {
            logger_1.logger.error(`Failed to send reminder for reference ${reference.id}: ${error}`);
        }
    }
    logger_1.logger.info(`Sent ${sent} reference reminders`);
    return { sent };
}
/**
 * Mark expired reference requests
 */
async function markExpiredReferences() {
    const result = await prisma_1.prisma.referenceRequest.updateMany({
        where: {
            status: { in: ['PENDING', 'SENT'] },
            expiresAt: { lte: new Date() },
        },
        data: {
            status: 'EXPIRED',
        },
    });
    if (result.count > 0) {
        logger_1.logger.info(`Marked ${result.count} reference requests as expired`);
    }
    return { expired: result.count };
}
exports.referenceCheckService = {
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
//# sourceMappingURL=reference-check.service.js.map