/**
 * Content Report Service
 * UK Online Safety Act Compliance
 * Phase 4: UK/EU Market Launch
 */
export type ContentType = 'post' | 'message' | 'profile' | 'comment' | 'job' | 'other';
export type ReportReason = 'illegal' | 'harmful' | 'harassment' | 'hate_speech' | 'spam' | 'misinformation' | 'csam' | 'terrorism' | 'fraud' | 'other';
export type ReportPriority = 'low' | 'medium' | 'high' | 'critical';
export type ReportStatus = 'PENDING' | 'REVIEWING' | 'RESOLVED' | 'DISMISSED';
interface ContentReportInput {
    contentType: ContentType;
    contentId: string;
    reason: ReportReason;
    description?: string;
    evidenceUrls?: string[];
    contactEmail?: string;
    isUrgent?: boolean;
    reporterId?: string;
    reportedUserId?: string;
}
interface ReportResult {
    ticketId: string;
    status: ReportStatus;
    expectedResponse: string;
    priority: ReportPriority;
}
/**
 * Submit a content report
 */
export declare function submitContentReport(report: ContentReportInput): Promise<ReportResult>;
/**
 * Get report status by searching evidence JSON for ticketId
 */
export declare function getReportStatus(ticketId: string): Promise<{
    status: ReportStatus;
    lastUpdated: Date;
    resolution?: string;
} | null>;
/**
 * Process a content report (for moderators)
 */
export declare function processContentReport(ticketId: string, action: 'dismiss' | 'warn' | 'remove' | 'suspend' | 'ban' | 'escalate', moderatorId: string, notes?: string): Promise<void>;
declare const _default: {
    submitContentReport: typeof submitContentReport;
    getReportStatus: typeof getReportStatus;
    processContentReport: typeof processContentReport;
};
export default _default;
//# sourceMappingURL=content-report.service.d.ts.map