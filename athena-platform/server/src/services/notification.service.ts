/**
 * Notification Service
 * Central dispatcher for In-App, Email, and Push notifications
 * Phase 2: Enhanced multi-channel routing with FCM/APNS support
 */

import { sendNotification as sendSocketNotification } from './socket.service';
import { sendEmail } from './email.service';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';
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
    html?: string; // If not provided, fallback to generic
    templateId?: string; // SendGrid dynamic template
  };
  pushOptions?: {
    badge?: number;
    sound?: string;
    image?: string;
    actionButtons?: Array<{ id: string; title: string; action?: string }>;
    ttl?: number; // Time to live in seconds
  };
  scheduledFor?: Date; // For scheduled notifications
  batchKey?: string; // Group related notifications
}

// Map NotificationType to preference keys in User.notificationPreferences.email/push
const PREFERENCE_MAPPING: Partial<Record<NotificationType, string>> = {
  JOB_MATCH: 'jobMatches',
  APPLICATION_UPDATE: 'applications',
  MESSAGE: 'messages',
  MENTION: 'mentions',
  LIKE: 'mentions', 
  COMMENT: 'mentions',
  FOLLOW: 'mentions',
};

export class NotificationService {
  /**
   * Dispatch a notification to multiple channels
   */
  async notify(options: DispatchOptions) {
    const { userId, type, title, message, link, data, channels = ['in-app'] } = options;

    logger.info(`Dispatching notification [${type}] to user ${userId} via ${channels.join(', ')}`);

    // Fetch user preferences early
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, notificationPreferences: true }
    });

    if (!user) {
        logger.warn(`Notification failed: User ${userId} not found`);
        return;
    }

    const promises = [];

    // 1. In-App Notification (Socket + DB)
    if (channels.includes('in-app')) {
      const prefs = user.notificationPreferences as any;
      // Default to true if prefs not set, or if inApp.all is true/undefined
      const shouldSendInApp = !prefs?.inApp || prefs.inApp.all !== false;
      
      if (shouldSendInApp) {
          promises.push(
            sendSocketNotification({
              userId,
              type,
              title,
              message,
              link,
            }).catch(err => logger.error('In-app notification failed', { error: err }))
          );
      }
    }

    // 2. Email Notification
    if (channels.includes('email') && user.email) {
       if (this.shouldSend(user.notificationPreferences, 'email', type)) {
           promises.push(
             this.sendEmailSafely(user.email, options)
          );
       }
    }

    // 3. Push Notification (FCM/APNS via Firebase Admin SDK)
    if (channels.includes('push')) {
        if (this.shouldSend(user.notificationPreferences, 'push', type)) {
            promises.push(
              this.sendPushNotification(userId, options)
                .catch(err => logger.error('Push notification failed', { error: err }))
            );
        }
    }

    await Promise.all(promises);
  }

  /**
   * Send push notification via FCM/APNS
   */
  private async sendPushNotification(userId: string, options: DispatchOptions): Promise<void> {
    // Get user's push tokens
    const tokens = await prisma.pushToken.findMany({
      where: { userId, isActive: true },
    });

    if (tokens.length === 0) {
      logger.debug('No push tokens for user', { userId });
      return;
    }

    const { title, message, link, data, pushOptions, priority } = options;

    // Build FCM payload
    const payload = {
      notification: {
        title,
        body: message || '',
        ...(pushOptions?.image && { image: pushOptions.image }),
      },
      data: {
        type: options.type,
        link: link || '',
        ...data,
      },
      android: {
        priority: priority === 'critical' ? 'high' : 'normal',
        notification: {
          sound: pushOptions?.sound || 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        },
        ...(pushOptions?.ttl && { ttl: `${pushOptions.ttl}s` }),
      },
      apns: {
        payload: {
          aps: {
            sound: pushOptions?.sound || 'default',
            badge: pushOptions?.badge,
            'content-available': 1,
          },
        },
      },
    };

    // If Firebase Admin SDK is configured
    if (process.env.FIREBASE_PROJECT_ID) {
      try {
        // Dynamic import to handle missing firebase-admin package gracefully
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let admin: any;
        try {
          // @ts-ignore - firebase-admin may not be installed
          admin = await import('firebase-admin');
        } catch {
          logger.warn('firebase-admin package not installed; push notifications disabled');
          return;
        }
        
        // Initialize Firebase if not already done
        if (!admin.apps.length) {
          admin.initializeApp({
            credential: admin.credential.cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            }),
          });
        }

        const tokenStrings = tokens.map((t: { token: string }) => t.token);
        
        // Send to all user's devices
        const response = await admin.messaging().sendEachForMulticast({
          tokens: tokenStrings,
          ...payload,
        });

        // Handle failed tokens (remove invalid ones)
        response.responses.forEach((resp: { success: boolean; error?: { code: string } }, idx: number) => {
          if (!resp.success && resp.error) {
            const errorCode = resp.error.code;
            if (
              errorCode === 'messaging/invalid-registration-token' ||
              errorCode === 'messaging/registration-token-not-registered'
            ) {
              // Deactivate invalid token
              prisma.pushToken.update({
                where: { id: tokens[idx].id },
                data: { isActive: false },
              }).catch((e: unknown) => logger.warn('Failed to deactivate push token', { error: e }));
            }
          }
        });

        logger.info('Push notifications sent', { 
          userId, 
          successCount: response.successCount,
          failureCount: response.failureCount,
        });
      } catch (error) {
        logger.error('Firebase push notification failed', { error, userId });
      }
    } else {
      // Log for development
      logger.debug('Push notification (Firebase not configured)', { userId, title, tokens: tokens.length });
    }
  }

  private shouldSend(prefs: any, channel: 'email' | 'push', type: NotificationType): boolean {
      if (!prefs) return true; // Default to opted-in
      const channelPrefs = prefs[channel];
      if (!channelPrefs) return true;

      const key = PREFERENCE_MAPPING[type];
      if (!key) return true; // Default to true if no specific mapping found (e.g. system types)

      return channelPrefs[key] !== false;
  }

  /**
   * Safe email wrapper
   */
  private async sendEmailSafely(email: string, options: DispatchOptions) {
    try {
      const { title, message, emailTemplate } = options;
      
      // Use provided template or generic fallback
      const subject = emailTemplate?.subject || title;
      const html = emailTemplate?.html || `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>${title}</h2>
          <p>${message || ''}</p>
          <a href="${process.env.CLIENT_URL || ''}${options.link || '#'}" style="display:inline-block; padding: 10px 20px; background: #7c3aed; color: white; text-decoration: none; border-radius: 5px;">View details</a>
        </div>
      `;

      await sendEmail({
        to: email,
        subject,
        html,
        text: message
      });
      
    } catch (error) {
       logger.error('Email notification failed', { error, userId: options.userId });
    }
  }
}

export const notificationService = new NotificationService();
