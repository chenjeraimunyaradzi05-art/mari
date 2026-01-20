/**
 * Breach Notification Service
 * Handles data breach detection, assessment, and 72-hour notification workflow
 * Phase 4: UK/EU Market Launch - GDPR Article 33/34 Compliance
 */

import { PrismaClient, BreachSeverity, BreachStatus, DataCategory } from '@prisma/client';
import { sendEmail } from './email.service';

const prisma = new PrismaClient();

interface BreachReport {
  title: string;
  description: string;
  detectedBy: string;
  severity: BreachSeverity;
  dataCategories: DataCategory[];
  affectedRecords?: number;
  affectedUsers?: number;
  occurredAt?: Date;
}

interface RegulatoryNotification {
  breachId: string;
  regulatorName: string;
  regulatorEmail: string;
  notificationContent: string;
}

export class BreachNotificationService {
  // 72-hour deadline in milliseconds
  private readonly NOTIFICATION_DEADLINE_MS = 72 * 60 * 60 * 1000;

  /**
   * Report a new data breach
   */
  async reportBreach(report: BreachReport): Promise<any> {
    const breach = await prisma.dataBreach.create({
      data: {
        title: report.title,
        description: report.description,
        detectedAt: new Date(),
        detectedBy: report.detectedBy,
        severity: report.severity,
        status: BreachStatus.DETECTED,
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
  private assessRiskToIndividuals(report: BreachReport): string {
    const highRiskCategories: DataCategory[] = [
      DataCategory.SENSITIVE,
      DataCategory.FINANCIAL,
      DataCategory.BIOMETRIC,
    ];

    const hasHighRiskData = report.dataCategories.some(cat =>
      highRiskCategories.includes(cat)
    );

    if (report.severity === BreachSeverity.CRITICAL || hasHighRiskData) {
      return 'HIGH: Breach involves sensitive personal data that could result in significant harm including identity theft, financial loss, or discrimination.';
    }

    if (report.severity === BreachSeverity.HIGH) {
      return 'MEDIUM: Breach involves personal data that could result in harm to individuals including unwanted contact or reputational damage.';
    }

    if (report.severity === BreachSeverity.MEDIUM) {
      return 'LOW-MEDIUM: Breach involves limited personal data with moderate potential for harm.';
    }

    return 'LOW: Breach involves minimal personal data with low potential for harm to individuals.';
  }

  /**
   * Determine if regulatory notification is required
   */
  private isNotificationRequired(report: BreachReport): boolean {
    // Under GDPR, notification is required unless breach is unlikely to result in risk
    if (report.severity === BreachSeverity.LOW) {
      return false;
    }

    // Always notify for high/critical severity
    if (
      report.severity === BreachSeverity.HIGH ||
      report.severity === BreachSeverity.CRITICAL
    ) {
      return true;
    }

    // Notify if sensitive data involved
    const sensitiveCategories: DataCategory[] = [
      DataCategory.SENSITIVE,
      DataCategory.FINANCIAL,
      DataCategory.BIOMETRIC,
    ];

    return report.dataCategories.some(cat => sensitiveCategories.includes(cat));
  }

  /**
   * Alert incident response team
   */
  private async alertIncidentTeam(breach: any): Promise<void> {
    const incidentTeamEmails = process.env.INCIDENT_TEAM_EMAILS?.split(',') || [];

    for (const email of incidentTeamEmails) {
      const notificationDeadline = new Date(
        breach.detectedAt.getTime() + this.NOTIFICATION_DEADLINE_MS
      );
      
      await sendEmail({
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
  async updateBreachStatus(
    breachId: string,
    updates: {
      status?: BreachStatus;
      containmentActions?: string[];
      remediationActions?: string[];
      rootCause?: string;
    }
  ): Promise<any> {
    const updateData: any = { ...updates };

    if (updates.status === BreachStatus.CONTAINED) {
      updateData.containedAt = new Date();
    }

    if (updates.status === BreachStatus.RESOLVED) {
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
  async notifyRegulator(notification: RegulatoryNotification): Promise<any> {
    const breach = await prisma.dataBreach.findUnique({
      where: { id: notification.breachId },
    });

    if (!breach) {
      throw new Error('Breach not found');
    }

    // Check if within 72-hour window
    const hoursSinceDetection =
      (Date.now() - breach.detectedAt.getTime()) / (1000 * 60 * 60);

    // Send notification to regulator
    await sendEmail({
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
        status: BreachStatus.NOTIFIED,
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
  async notifyAffectedUsers(
    breachId: string,
    userIds: string[],
    notificationContent: string
  ): Promise<void> {
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
      await Promise.all(
        batch.map(user =>
          sendEmail({
            to: user.email,
            subject: 'Important Security Notice from ATHENA',
            html: `
              <h1>Important Security Notice</h1>
              <p>Dear ${user.firstName},</p>
              <p>${notificationContent}</p>
              <p>For more information, please visit our <a href="${process.env.APP_URL}/help/security">security support page</a>.</p>
              <p>Best regards,<br>The ATHENA Security Team</p>
            `,
          })
        )
      );
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
  async getBreachesRequiringNotification(): Promise<any[]> {
    const deadlineThreshold = new Date(
      Date.now() - this.NOTIFICATION_DEADLINE_MS
    );

    return prisma.dataBreach.findMany({
      where: {
        notificationRequired: true,
        regulatorNotifiedAt: null,
        status: {
          in: [BreachStatus.DETECTED, BreachStatus.INVESTIGATING, BreachStatus.CONTAINED],
        },
      },
      orderBy: { detectedAt: 'asc' },
    });
  }

  /**
   * Get all breaches for audit dashboard
   */
  async getAllBreaches(filters?: {
    status?: BreachStatus;
    severity?: BreachSeverity;
    startDate?: Date;
    endDate?: Date;
  }): Promise<any[]> {
    const where: any = {};

    if (filters?.status) where.status = filters.status;
    if (filters?.severity) where.severity = filters.severity;
    if (filters?.startDate || filters?.endDate) {
      where.detectedAt = {};
      if (filters.startDate) where.detectedAt.gte = filters.startDate;
      if (filters.endDate) where.detectedAt.lte = filters.endDate;
    }

    return prisma.dataBreach.findMany({
      where,
      orderBy: { detectedAt: 'desc' },
    });
  }

  /**
   * Generate breach report for compliance
   */
  async generateBreachReport(breachId: string): Promise<object> {
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
        documentationComplete:
          !!breach.rootCause &&
          breach.containmentActions.length > 0 &&
          breach.remediationActions.length > 0,
      },
      generatedAt: new Date(),
    };
  }
}

export const breachNotificationService = new BreachNotificationService();
