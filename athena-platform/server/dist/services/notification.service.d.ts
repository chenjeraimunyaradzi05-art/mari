/**
 * Notification Service
 * Central dispatcher for In-App, Email, and Push notifications
 * Phase 2: Enhanced multi-channel routing with FCM/APNS support
 */
import { NotificationType } from '@prisma/client';
export type NotificationChannel = 'in-app' | 'email' | 'push' | 'sms';
export interface DispatchOptions {
    userId: string;
    type: NotificationType;
    title: string;
    message?: string;
    link?: string;
    data?: any;
    channels?: NotificationChannel[];
    priority?: 'low' | 'normal' | 'high' | 'critical';
    emailTemplate?: {
        subject?: string;
        html?: string;
        templateId?: string;
    };
    pushOptions?: {
        badge?: number;
        sound?: string;
        image?: string;
        actionButtons?: Array<{
            id: string;
            title: string;
            action?: string;
        }>;
        ttl?: number;
    };
    scheduledFor?: Date;
    batchKey?: string;
}
export declare class NotificationService {
    /**
     * Dispatch a notification to multiple channels
     */
    notify(options: DispatchOptions): Promise<void>;
    /**
     * Send push notification via FCM/APNS
     */
    private sendPushNotification;
    private shouldSend;
    /**
     * Safe email wrapper
     */
    private sendEmailSafely;
}
export declare const notificationService: NotificationService;
//# sourceMappingURL=notification.service.d.ts.map