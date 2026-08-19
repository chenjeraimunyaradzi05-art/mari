"use strict";
/**
 * Content Report Service
 * UK Online Safety Act Compliance
 * Phase 4: UK/EU Market Launch
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitContentReport = submitContentReport;
exports.getReportStatus = getReportStatus;
exports.processContentReport = processContentReport;
const prisma_1 = require("../utils/prisma");
const email_1 = require("../utils/email");
const logger_1 = require("../utils/logger");
// Priority mapping based on reason
const REASON_PRIORITY = {
    csam: 'critical',
    terrorism: 'critical',
    illegal: 'high',
    harmful: 'high',
    hate_speech: 'high',
    fraud: 'high',
    harassment: 'medium',
    misinformation: 'medium',
    spam: 'low',
    other: 'medium',
};
// Expected response times by priority
const RESPONSE_TIMES = {
    critical: 'within 1 hour',
    high: 'within 24 hours',
    medium: 'within 48 hours',
    low: 'within 72 hours',
};
/**
 * Submit a content report
 */
async function submitContentReport(report) {
    const ticketId = generateTicketId();
    const priority = report.isUrgent ? 'critical' : REASON_PRIORITY[report.reason];
    const expectedResponse = RESPONSE_TIMES[priority];
    try {
        // Get a system user ID for anonymous reports
        const systemUserId = report.reporterId || 'system-anonymous';
        const reportedUserId = report.reportedUserId || 'unknown';
        // Store report in database using existing ContentReport model
        await prisma_1.prisma.contentReport.create({
            data: {
                reporterId: systemUserId,
                contentType: report.contentType.toUpperCase(),
                contentId: report.contentId,
                reportedUserId: reportedUserId,
                reason: report.reason.toUpperCase(),
                description: report.description || '',
                evidence: {
                    urls: report.evidenceUrls || [],
                    contactEmail: report.contactEmail,
                    isUrgent: report.isUrgent || false,
                    ticketId,
                    priority,
                },
                status: 'PENDING',
            },
        });
        // Send acknowledgment email if contact provided
        if (report.contactEmail) {
            await sendReportAcknowledgment(report.contactEmail, ticketId, expectedResponse);
        }
        // Alert Trust & Safety team for critical/high priority
        if (priority === 'critical' || priority === 'high') {
            await alertTrustAndSafety(ticketId, priority, report);
        }
        // For CSAM reports, also notify authorities
        if (report.reason === 'csam') {
            await escalateToAuthorities(ticketId, report);
        }
        return {
            ticketId,
            status: 'PENDING',
            expectedResponse,
            priority,
        };
    }
    catch (error) {
        logger_1.logger.error('Failed to submit content report:', error);
        throw new Error('Failed to submit report');
    }
}
/**
 * Get report status by searching evidence JSON for ticketId
 */
async function getReportStatus(ticketId) {
    // Find report by ticketId stored in evidence JSON
    const reports = await prisma_1.prisma.contentReport.findMany({
        where: {
            evidence: {
                path: ['ticketId'],
                equals: ticketId,
            },
        },
        select: {
            status: true,
            updatedAt: true,
            reviewNotes: true,
        },
        take: 1,
    });
    const report = reports[0];
    if (!report)
        return null;
    return {
        status: report.status,
        lastUpdated: report.updatedAt,
        resolution: report.reviewNotes || undefined,
    };
}
/**
 * Process a content report (for moderators)
 */
async function processContentReport(ticketId, action, moderatorId, notes) {
    // Find report by ticketId
    const reports = await prisma_1.prisma.contentReport.findMany({
        where: {
            evidence: {
                path: ['ticketId'],
                equals: ticketId,
            },
        },
        take: 1,
    });
    const report = reports[0];
    if (!report) {
        throw new Error('Report not found');
    }
    // Update report status
    let status = 'RESOLVED';
    if (action === 'dismiss')
        status = 'DISMISSED';
    await prisma_1.prisma.contentReport.update({
        where: { id: report.id },
        data: {
            status,
            reviewerId: moderatorId,
            action: action.toUpperCase(),
            actionTakenAt: new Date(),
            reviewNotes: notes,
        },
    });
    // Take action based on decision
    switch (action) {
        case 'remove':
            await removeContent(report.contentType, report.contentId);
            break;
        case 'warn':
            await warnUser(report.contentId, report.contentType);
            break;
        case 'suspend':
            await suspendUser(report.contentId, report.contentType);
            break;
        case 'ban':
            await banUser(report.contentId, report.contentType);
            break;
        case 'escalate':
            await escalateReport(ticketId, report);
            break;
    }
    // Log moderation action
    await prisma_1.prisma.moderationLog.create({
        data: {
            ticketId,
            action,
            moderatorId,
            notes,
            timestamp: new Date(),
        },
    });
    // Notify reporter of outcome
    const evidence = report.evidence;
    if (evidence?.contactEmail) {
        await sendReportOutcome(evidence.contactEmail, ticketId, action);
    }
}
/**
 * Generate unique ticket ID
 */
function generateTicketId() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `RPT-${timestamp}-${random}`;
}
/**
 * Send acknowledgment email
 */
async function sendReportAcknowledgment(email, ticketId, expectedResponse) {
    await (0, email_1.sendEmail)({
        to: email,
        subject: `Report Received - ${ticketId}`,
        html: `
      <h2>Your Report Has Been Received</h2>
      <p>Thank you for reporting content to ATHENA. Your report helps us maintain a safe platform.</p>
      <p><strong>Reference Number:</strong> ${ticketId}</p>
      <p><strong>Expected Response:</strong> ${expectedResponse}</p>
      <p>Our Trust & Safety team will review your report and take appropriate action. You'll receive an update once we've completed our review.</p>
      <p>If you have additional information to add, please reply to this email with your reference number.</p>
      <br>
      <p>Best regards,<br>ATHENA Trust & Safety Team</p>
    `,
    });
}
/**
 * Send report outcome notification
 */
async function sendReportOutcome(email, ticketId, action) {
    const actionMessages = {
        dismiss: 'After careful review, we determined that the reported content does not violate our Community Guidelines.',
        warn: 'We have issued a warning to the user responsible for the content.',
        remove: 'We have removed the reported content as it violated our Community Guidelines.',
        suspend: 'We have temporarily suspended the account responsible for the content.',
        ban: 'We have permanently banned the account responsible for the content.',
        escalate: 'Your report has been escalated to our senior Trust & Safety team for further review.',
    };
    await (0, email_1.sendEmail)({
        to: email,
        subject: `Report Update - ${ticketId}`,
        html: `
      <h2>Update on Your Report</h2>
      <p>We have completed our review of your report (${ticketId}).</p>
      <p><strong>Outcome:</strong> ${actionMessages[action] || 'Action taken.'}</p>
      <p>If you believe this decision was made in error, you can submit an appeal at athena.com/help/appeal.</p>
      <p>Thank you for helping keep ATHENA safe.</p>
      <br>
      <p>Best regards,<br>ATHENA Trust & Safety Team</p>
    `,
    });
}
/**
 * Alert Trust & Safety team
 */
async function alertTrustAndSafety(ticketId, priority, report) {
    // Send to internal Trust & Safety channel (Slack, email, etc.)
    await (0, email_1.sendEmail)({
        to: process.env.TRUST_SAFETY_EMAIL || 'trust-safety@athena.com',
        subject: `[${priority.toUpperCase()}] New Content Report - ${ticketId}`,
        html: `
      <h2>New Content Report Requires Attention</h2>
      <p><strong>Priority:</strong> ${priority.toUpperCase()}</p>
      <p><strong>Ticket ID:</strong> ${ticketId}</p>
      <p><strong>Content Type:</strong> ${report.contentType}</p>
      <p><strong>Reason:</strong> ${report.reason}</p>
      <p><strong>Description:</strong> ${report.description || 'N/A'}</p>
      <p><strong>Urgent Flag:</strong> ${report.isUrgent ? 'Yes' : 'No'}</p>
      <br>
      <p>Please review this report in the moderation dashboard.</p>
    `,
    });
}
/**
 * Escalate to authorities (for CSAM, terrorism)
 */
async function escalateToAuthorities(ticketId, report) {
    // Log for audit purposes
    await prisma_1.prisma.authorityEscalation.create({
        data: {
            ticketId,
            reason: report.reason,
            contentType: report.contentType,
            contentId: report.contentId,
            escalatedAt: new Date(),
            // In production, this would include the actual reporting to NCMEC, IWF, etc.
            reportedTo: report.reason === 'csam' ? 'IWF' : 'Counter Terrorism Internet Referral Unit',
        },
    });
    logger_1.logger.info(`[CRITICAL] Report ${ticketId} escalated to authorities for ${report.reason}`);
}
// Content moderation action functions
async function removeContent(contentType, contentId) {
    logger_1.logger.info(`Removing ${contentType} with ID ${contentId}`);
    // Remove content based on type - use isHidden flag for soft delete
    switch (contentType.toLowerCase()) {
        case 'post':
            await prisma_1.prisma.post.update({
                where: { id: contentId },
                data: { isHidden: true },
            });
            break;
        case 'comment':
            await prisma_1.prisma.comment.update({
                where: { id: contentId },
                data: { isHidden: true },
            });
            break;
        case 'message':
            // Messages use soft delete via the conversation
            await prisma_1.prisma.message.delete({ where: { id: contentId } });
            break;
        case 'job':
            await prisma_1.prisma.job.update({
                where: { id: contentId },
                data: { status: 'CLOSED' },
            });
            break;
        default:
            logger_1.logger.warn(`Unknown content type for removal: ${contentType}`);
    }
}
async function warnUser(contentId, contentType) {
    logger_1.logger.info(`Warning user for ${contentType} ${contentId}`);
    // Get user ID from content
    const userId = await getUserIdFromContent(contentType, contentId);
    if (!userId)
        return;
    // Create a warning notification
    await prisma_1.prisma.notification.create({
        data: {
            userId,
            type: 'SYSTEM',
            title: 'Content Policy Warning',
            message: 'Your content has been flagged for violating our community guidelines. Repeated violations may result in account restrictions.',
            data: { contentType, contentId },
        },
    });
}
async function suspendUser(contentId, contentType) {
    const userId = await getUserIdFromContent(contentType, contentId);
    if (!userId)
        return;
    logger_1.logger.info(`Suspending user ${userId} for ${contentType} ${contentId}`);
    // Apply suspension using isSuspended boolean
    await prisma_1.prisma.user.update({
        where: { id: userId },
        data: { isSuspended: true },
    });
}
async function banUser(contentId, contentType) {
    const userId = await getUserIdFromContent(contentType, contentId);
    if (!userId)
        return;
    logger_1.logger.info(`Banning user ${userId} for ${contentType} ${contentId}`);
    // Apply permanent ban using isSuspended (permanent)
    await prisma_1.prisma.user.update({
        where: { id: userId },
        data: { isSuspended: true },
    });
}
async function escalateReport(ticketId, report) {
    logger_1.logger.info(`Escalating report ${ticketId} to senior moderation`);
    // Update report status to REVIEWING (escalated)
    await prisma_1.prisma.contentReport.updateMany({
        where: { evidence: { path: ['ticketId'], equals: ticketId } },
        data: { status: 'REVIEWING' },
    });
    // Notify senior moderators (would integrate with internal ticketing system)
    await alertTrustAndSafety(ticketId, 'critical', report);
}
// Helper: Get user ID from content
async function getUserIdFromContent(contentType, contentId) {
    switch (contentType.toLowerCase()) {
        case 'post': {
            const post = await prisma_1.prisma.post.findUnique({ where: { id: contentId }, select: { authorId: true } });
            return post?.authorId || null;
        }
        case 'comment': {
            const comment = await prisma_1.prisma.comment.findUnique({ where: { id: contentId }, select: { authorId: true } });
            return comment?.authorId || null;
        }
        case 'message': {
            const message = await prisma_1.prisma.message.findUnique({ where: { id: contentId }, select: { senderId: true } });
            return message?.senderId || null;
        }
        case 'job': {
            const job = await prisma_1.prisma.job.findUnique({ where: { id: contentId }, select: { postedById: true } });
            return job?.postedById || null;
        }
        default:
            return null;
    }
}
exports.default = {
    submitContentReport,
    getReportStatus,
    processContentReport,
};
//# sourceMappingURL=content-report.service.js.map