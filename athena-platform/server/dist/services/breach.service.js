"use strict";
/**
 * Breach Notification Service
 * Handles data breach detection, assessment, and 72-hour notification workflow
 * Phase 4: UK/EU Market Launch - GDPR Article 33/34 Compliance
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.breachNotificationService = exports.BreachNotificationService = void 0;
const client_1 = require("@prisma/client");
const email_service_1 = require("./email.service");
const prisma = new client_1.PrismaClient();
class BreachNotificationService {
    // 72-hour deadline in milliseconds
    NOTIFICATION_DEADLINE_MS = 72 * 60 * 60 * 1000;
    /**
     * Report a new data breach
     */
    async reportBreach(report) {
        const breach = await prisma.dataBreach.create({
            data: {
                title: report.title,
                description: report.description,
                detectedAt: new Date(),
                detectedBy: report.detectedBy,
                severity: report.severity,
                status: client_1.BreachStatus.DETECTED,
                dataCategories: report.dataCategories,
                affectedRecords: report.affectedRecords,
                affectedUsers: report.affectedUsers,
                occurredAt: report.occurredAt,
                riskToIndividuals: this.assessRiskToIndividuals(report),
                notificationRequired: this.isNotificationRequired(report),
            },
        });
        // Alert incident response team immediately
        await this.alertIncidentTeam(breach);
        // Log the breach report
        await prisma.privacyAuditLog.create({
            data: {
                action: 'BREACH_REPORTED',
                resourceType: 'DataBreach',
                resourceId: breach.id,
                details: {
                    severity: report.severity,
                    dataCategories: report.dataCategories,
                    notificationRequired: breach.notificationRequired,
                },
            },
        });
        return breach;
    }
    /**
     * Assess risk to individuals based on breach characteristics
     */
    assessRiskToIndividuals(report) {
        const highRiskCategories = [
            client_1.DataCategory.SENSITIVE,
            client_1.DataCategory.FINANCIAL,
            client_1.DataCategory.BIOMETRIC,
        ];
        const hasHighRiskData = report.dataCategories.some(cat => highRiskCategories.includes(cat));
        if (report.severity === client_1.BreachSeverity.CRITICAL || hasHighRiskData) {
            return 'HIGH: Breach involves sensitive personal data that could result in significant harm including identity theft, financial loss, or discrimination.';
        }
        if (report.severity === client_1.BreachSeverity.HIGH) {
            return 'MEDIUM: Breach involves personal data that could result in harm to individuals including unwanted contact or reputational damage.';
        }
        if (report.severity === client_1.BreachSeverity.MEDIUM) {
            return 'LOW-MEDIUM: Breach involves limited personal data with moderate potential for harm.';
        }
        return 'LOW: Breach involves minimal personal data with low potential for harm to individuals.';
    }
    /**
     * Determine if regulatory notification is required
     */
    isNotificationRequired(report) {
        // Under GDPR, notification is required unless breach is unlikely to result in risk
        if (report.severity === client_1.BreachSeverity.LOW) {
            return false;
        }
        // Always notify for high/critical severity
        if (report.severity === client_1.BreachSeverity.HIGH ||
            report.severity === client_1.BreachSeverity.CRITICAL) {
            return true;
        }
        // Notify if sensitive data involved
        const sensitiveCategories = [
            client_1.DataCategory.SENSITIVE,
            client_1.DataCategory.FINANCIAL,
            client_1.DataCategory.BIOMETRIC,
        ];
        return report.dataCategories.some(cat => sensitiveCategories.includes(cat));
    }
    /**
     * Alert incident response team
     */
    async alertIncidentTeam(breach) {
        const incidentTeamEmails = process.env.INCIDENT_TEAM_EMAILS?.split(',') || [];
        for (const email of incidentTeamEmails) {
            const notificationDeadline = new Date(breach.detectedAt.getTime() + this.NOTIFICATION_DEADLINE_MS);
            await (0, email_service_1.sendEmail)({
                to: email.trim(),
                subject: `[URGENT] Data Breach Detected - ${breach.severity} Severity`,
                html: `
          <h1>Data Breach Alert</h1>
          <p><strong>Breach ID:</strong> ${breach.id}</p>
          <p><strong>Title:</strong> ${breach.title}</p>
          <p><strong>Severity:</strong> ${breach.severity}</p>
          <p><strong>Detected At:</strong> ${breach.detectedAt.toISOString()}</p>
          <p><strong>Notification Deadline:</strong> ${notificationDeadline.toISOString()}</p>
          <p><strong>Description:</strong> ${breach.description}</p>
          <p>Please take immediate action.</p>
        `,
            });
        }
    }
    /**
     * Update breach status and containment actions
     */
    async updateBreachStatus(breachId, updates) {
        const updateData = { ...updates };
        if (updates.status === client_1.BreachStatus.CONTAINED) {
            updateData.containedAt = new Date();
        }
        if (updates.status === client_1.BreachStatus.RESOLVED) {
            updateData.resolvedAt = new Date();
        }
        const breach = await prisma.dataBreach.update({
            where: { id: breachId },
            data: updateData,
        });
        await prisma.privacyAuditLog.create({
            data: {
                action: 'BREACH_STATUS_UPDATED',
                resourceType: 'DataBreach',
                resourceId: breachId,
                details: updates,
            },
        });
        return breach;
    }
    /**
     * Notify regulatory authority (ICO for UK, DPAs for EU)
     */
    async notifyRegulator(notification) {
        const breach = await prisma.dataBreach.findUnique({
            where: { id: notification.breachId },
        });
        if (!breach) {
            throw new Error('Breach not found');
        }
        // Check if within 72-hour window
        const hoursSinceDetection = (Date.now() - breach.detectedAt.getTime()) / (1000 * 60 * 60);
        // Send notification to regulator
        await (0, email_service_1.sendEmail)({
            to: notification.regulatorEmail,
            subject: `Data Breach Notification - ${breach.title}`,
            html: `
        <h1>Data Breach Notification</h1>
        <p><strong>Organization:</strong> ATHENA Platform</p>
        <p><strong>Breach Title:</strong> ${breach.title}</p>
        <p><strong>Detected At:</strong> ${breach.detectedAt.toISOString()}</p>
        <p><strong>Hours Since Detection:</strong> ${hoursSinceDetection.toFixed(1)}</p>
        <p><strong>Submitted Within 72 Hours:</strong> ${hoursSinceDetection <= 72 ? 'Yes' : 'No'}</p>
        <h2>Notification Content</h2>
        <p>${notification.notificationContent}</p>
      `,
        });
        // Update breach record
        const updatedBreach = await prisma.dataBreach.update({
            where: { id: notification.breachId },
            data: {
                status: client_1.BreachStatus.NOTIFIED,
                regulatorNotifiedAt: new Date(),
            },
        });
        await prisma.privacyAuditLog.create({
            data: {
                action: 'REGULATOR_NOTIFIED',
                resourceType: 'DataBreach',
                resourceId: notification.breachId,
                details: {
                    regulator: notification.regulatorName,
                    hoursSinceDetection,
                    within72Hours: hoursSinceDetection <= 72,
                },
            },
        });
        return updatedBreach;
    }
    /**
     * Notify affected users
     */
    async notifyAffectedUsers(breachId, userIds, notificationContent) {
        const breach = await prisma.dataBreach.findUnique({
            where: { id: breachId },
        });
        if (!breach) {
            throw new Error('Breach not found');
        }
        // Get affected users' emails
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, email: true, firstName: true },
        });
        // Send notifications in batches
        const batchSize = 100;
        for (let i = 0; i < users.length; i += batchSize) {
            const batch = users.slice(i, i + batchSize);
            await Promise.all(batch.map(user => (0, email_service_1.sendEmail)({
                to: user.email,
                subject: 'Important Security Notice from ATHENA',
                html: `
              <h1>Important Security Notice</h1>
              <p>Dear ${user.firstName},</p>
              <p>${notificationContent}</p>
              <p>For more information, please visit our <a href="${process.env.APP_URL}/help/security">security support page</a>.</p>
              <p>Best regards,<br>The ATHENA Security Team</p>
            `,
            })));
        }
        // Update breach record
        await prisma.dataBreach.update({
            where: { id: breachId },
            data: {
                usersNotifiedAt: new Date(),
                notificationMethod: 'EMAIL',
            },
        });
        await prisma.privacyAuditLog.create({
            data: {
                action: 'USERS_NOTIFIED_OF_BREACH',
                resourceType: 'DataBreach',
                resourceId: breachId,
                details: {
                    usersNotified: users.length,
                    method: 'EMAIL',
                },
            },
        });
    }
    /**
     * Get breaches requiring notification (approaching 72-hour deadline)
     */
    async getBreachesRequiringNotification() {
        const deadlineThreshold = new Date(Date.now() - this.NOTIFICATION_DEADLINE_MS);
        return prisma.dataBreach.findMany({
            where: {
                notificationRequired: true,
                regulatorNotifiedAt: null,
                status: {
                    in: [client_1.BreachStatus.DETECTED, client_1.BreachStatus.INVESTIGATING, client_1.BreachStatus.CONTAINED],
                },
            },
            orderBy: { detectedAt: 'asc' },
        });
    }
    /**
     * Get all breaches for audit dashboard
     */
    async getAllBreaches(filters) {
        const where = {};
        if (filters?.status)
            where.status = filters.status;
        if (filters?.severity)
            where.severity = filters.severity;
        if (filters?.startDate || filters?.endDate) {
            where.detectedAt = {};
            if (filters.startDate)
                where.detectedAt.gte = filters.startDate;
            if (filters.endDate)
                where.detectedAt.lte = filters.endDate;
        }
        return prisma.dataBreach.findMany({
            where,
            orderBy: { detectedAt: 'desc' },
        });
    }
    /**
     * Generate breach report for compliance
     */
    async generateBreachReport(breachId) {
        const breach = await prisma.dataBreach.findUnique({
            where: { id: breachId },
        });
        if (!breach) {
            throw new Error('Breach not found');
        }
        const auditLogs = await prisma.privacyAuditLog.findMany({
            where: {
                resourceType: 'DataBreach',
                resourceId: breachId,
            },
            orderBy: { createdAt: 'asc' },
        });
        return {
            breach,
            timeline: auditLogs.map(log => ({
                action: log.action,
                timestamp: log.createdAt,
                details: log.details,
            })),
            compliance: {
                notifiedWithin72Hours: breach.regulatorNotifiedAt
                    ? (breach.regulatorNotifiedAt.getTime() - breach.detectedAt.getTime()) /
                        (1000 * 60 * 60) <=
                        72
                    : null,
                usersNotified: !!breach.usersNotifiedAt,
                documentationComplete: !!breach.rootCause &&
                    breach.containmentActions.length > 0 &&
                    breach.remediationActions.length > 0,
            },
            generatedAt: new Date(),
        };
    }
}
exports.BreachNotificationService = BreachNotificationService;
exports.breachNotificationService = new BreachNotificationService();
//# sourceMappingURL=breach.service.js.map