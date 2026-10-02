/**
 * Notification Service
 * Central dispatcher for In-App, Email, and Push notifications
 * Phase 2: Enhanced multi-channel routing with FCM/APNS support
 */

import { sendNotification as sendSocketNotification } from './socket.service';
import { sendEmail } from './email.service';
import { escapeHtml } from '../utils/escape-html';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';
import { NotificationType } from '@prisma/client';
import { i18nService, SupportedLocale } from './i18n.service';
import { getLocaleForUser } from '../utils/region';
import { pushToUser } from './push.service';
import { wantsVagueNotifications } from './dv-safe.service';

export type NotificationChannel = 'in-app' | 'email' | 'push' | 'sms';

export interface DispatchOptions {
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  link?: string;
  data?: any;
  i18nKey?: string;
  i18nParams?: Record<string, string | number>;
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

/**
 * The email a notification becomes when nobody wrote it a template of its own.
 *
 * Every notification that has no `emailTemplate` goes out as this, and its
 * title and message are most often a sentence with another member's name in it
 * ("Ana liked your post", "a new message from ..."). They were interpolated as
 * they came, so a first name that was `<a href="https://elsewhere">` arrived
 * as a live link in a message sent from ATHENA's own address, the version of a
 * phishing mail that a spam filter has learnt to trust. Everything that varies
 * is escaped here, in the one place the markup is built, so a caller cannot
 * forget to.
 */
export function fallbackEmailHtml(input: { title: string; message?: string; url: string }): string {
  return `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>${escapeHtml(input.title)}</h2>
          <p>${escapeHtml(input.message || '')}</p>
          <a href="${escapeHtml(input.url)}" style="display:inline-block; padding: 10px 20px; background: #7c3aed; color: white; text-decoration: none; border-radius: 5px;">View details</a>
        </div>
      `;
}

/**
 * What an email says when its reader has asked for vague notifications.
 *
 * The subject is the part shown on a lock screen, in a notification shade and
 * in an inbox preview, and the body is what a person sees who opens the message
 * on a shared computer, so neither carries any of the notification's words and
 * neither names its topic.
 */
export const VAGUE_EMAIL = {
  subject: 'New update on ATHENA',
  message: 'You have a new update. Open ATHENA to view it.',
  link: '/dashboard/notifications',
} as const;

export class NotificationService {
  /**
   * Dispatch a notification to multiple channels
   */
  async notify(options: DispatchOptions) {
    const { userId, type, title, message, link, data, channels = ['in-app'], i18nKey, i18nParams } = options;

    logger.info(`Dispatching notification [${type}] to user ${userId} via ${channels.join(', ')}`);

    // Fetch user preferences early
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, notificationPreferences: true, preferredLocale: true, region: true }
    });

    if (!user) {
        logger.warn(`Notification failed: User ${userId} not found`);
        return;
    }

    const locale = getLocaleForUser(user) as SupportedLocale;
    const resolvedMessage = message || (i18nKey ? i18nService.tSync(i18nKey, i18nParams, locale) : undefined);
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
              message: resolvedMessage,
              data: {
                ...(data || {}),
                ...(i18nKey ? { i18nKey, i18nParams } : {}),
              },
              link,
            }).catch(err => logger.error('In-app notification failed', { error: err }))
          );
      }
    }

    // 2. Email Notification
     if (channels.includes('email') && user.email) {
       if (this.shouldSend(user.notificationPreferences, 'email', type)) {
           promises.push(
           this.sendEmailSafely(user.email, {
            ...options,
            message: resolvedMessage,
           })
          );
       }
    }

    // 3. Push Notification (FCM/APNS via Firebase Admin SDK)
    if (channels.includes('push')) {
        if (this.shouldSend(user.notificationPreferences, 'push', type)) {
            promises.push(
              this.sendPushNotification(userId, {
                ...options,
                message: resolvedMessage,
              })
                .catch(err => logger.error('Push notification failed', { error: err }))
            );
        }
    }

    await Promise.all(promises);
  }

  /**
   * Push, through push.service: Expo tokens over Expo's API, FCM tokens
   * through firebase-admin when configured. Preferences were already checked
   * by the caller for this channel.
   */
  private async sendPushNotification(userId: string, options: DispatchOptions): Promise<void> {
    const { title, message, link, data, pushOptions, priority } = options;
    await pushToUser(userId, options.type, {
      title,
      body: message || '',
      link,
      data: { type: options.type, ...(data || {}) },
      badge: pushOptions?.badge,
      priority: priority === 'critical' || priority === 'high' ? 'high' : 'default',
    });
  }

  // The Firebase-only sender this replaced is kept below for reference of the
  // payload shape it built; it is no longer called.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async legacyFirebasePush(userId: string, options: DispatchOptions): Promise<void> {
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
          // @ts-expect-error - firebase-admin may not be installed
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

      // A member who has asked for vague notifications gets the same swap here
      // that her phone gets in push.service: a woman whose partner reads her
      // lock screen is read at the inbox too. Nothing of the original goes
      // out — not the subject, not the template, and not the deep link, which
      // would name the topic by its address.
      if (await wantsVagueNotifications(options.userId)) {
        await sendEmail({
          to: email,
          subject: VAGUE_EMAIL.subject,
          html: fallbackEmailHtml({
            title: VAGUE_EMAIL.subject,
            message: VAGUE_EMAIL.message,
            url: `${process.env.CLIENT_URL || ''}${VAGUE_EMAIL.link}`,
          }),
          text: VAGUE_EMAIL.message,
        });
        return;
      }

      // Use provided template or generic fallback
      const subject = emailTemplate?.subject || title;
      const html =
        emailTemplate?.html ||
        fallbackEmailHtml({ title, message, url: `${process.env.CLIENT_URL || ''}${options.link || '#'}` });

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
