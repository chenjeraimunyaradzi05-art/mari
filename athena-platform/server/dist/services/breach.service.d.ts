/**
 * Breach Notification Service
 * Handles data breach detection, assessment, and 72-hour notification workflow
 * Phase 4: UK/EU Market Launch - GDPR Article 33/34 Compliance
 */
import { BreachSeverity, BreachStatus, DataCategory } from '@prisma/client';
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
export declare class BreachNotificationService {
    private readonly NOTIFICATION_DEADLINE_MS;
    /**
     * Report a new data breach
     */
    reportBreach(report: BreachReport): Promise<any>;
    /**
     * Assess risk to individuals based on breach characteristics
     */
    private assessRiskToIndividuals;
    /**
     * Determine if regulatory notification is required
     */
    private isNotificationRequired;
    /**
     * Alert incident response team
     */
    private alertIncidentTeam;
    /**
     * Update breach status and containment actions
     */
    updateBreachStatus(breachId: string, updates: {
        status?: BreachStatus;
        containmentActions?: string[];
        remediationActions?: string[];
        rootCause?: string;
    }): Promise<any>;
    /**
     * Notify regulatory authority (ICO for UK, DPAs for EU)
     */
    notifyRegulator(notification: RegulatoryNotification): Promise<any>;
    /**
     * Notify affected users
     */
    notifyAffectedUsers(breachId: string, userIds: string[], notificationContent: string): Promise<void>;
    /**
     * Get breaches requiring notification (approaching 72-hour deadline)
     */
    getBreachesRequiringNotification(): Promise<any[]>;
    /**
     * Get all breaches for audit dashboard
     */
    getAllBreaches(filters?: {
        status?: BreachStatus;
        severity?: BreachSeverity;
        startDate?: Date;
        endDate?: Date;
    }): Promise<any[]>;
    /**
     * Generate breach report for compliance
     */
    generateBreachReport(breachId: string): Promise<object>;
}
export declare const breachNotificationService: BreachNotificationService;
export {};
//# sourceMappingURL=breach.service.d.ts.map