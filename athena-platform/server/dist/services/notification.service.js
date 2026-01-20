"use strict";
/**
 * Notification Service
 * Central dispatcher for In-App, Email, and Push notifications
 * Phase 2: Enhanced multi-channel routing with FCM/APNS support
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = exports.NotificationService = void 0;
const socket_service_1 = require("./socket.service");
const email_service_1 = require("./email.service");
const logger_1 = require("../utils/logger");
const prisma_1 = require("../utils/prisma");
// Map NotificationType to preference keys in User.notificationPreferences.email/push
const PREFERENCE_MAPPING = {
    JOB_MATCH: 'jobMatches',
    APPLICATION_UPDATE: 'applications',
    MESSAGE: 'messages',
    MENTION: 'mentions',
    LIKE: 'mentions',
    COMMENT: 'mentions',
    FOLLOW: 'mentions',
};
class NotificationService {
    /**
     * Dispatch a notification to multiple channels
     */
    async notify(options) {
        const { userId, type, title, message, link, data, channels = ['in-app'] } = options;
        logger_1.logger.info(`Dispatching notification [${type}] to user ${userId} via ${channels.join(', ')}`);
        // Fetch user preferences early
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, firstName: true, notificationPreferences: true }
        });
        if (!user) {
            logger_1.logger.warn(`Notification failed: User ${userId} not found`);
            return;
        }
        const promises = [];
        // 1. In-App Notification (Socket + DB)
        if (channels.includes('in-app')) {
            const prefs = user.notificationPreferences;
            // Default to true if prefs not set, or if inApp.all is true/undefined
            const shouldSendInApp = !prefs?.inApp || prefs.inApp.all !== false;
            if (shouldSendInApp) {
                promises.push((0, socket_service_1.sendNotification)({
                    userId,
                    type,
                    title,
                    message,
                    link,
                }).catch(err => logger_1.logger.error('In-app notification failed', { error: err })));
            }
        }
        // 2. Email Notification
        if (channels.includes('email') && user.email) {
            if (this.shouldSend(user.notificationPreferences, 'email', type)) {
                promises.push(this.sendEmailSafely(user.email, options));
            }
        }
        // 3. Push Notification (FCM/APNS via Firebase Admin SDK)
        if (channels.includes('push')) {
            if (this.shouldSend(user.notificationPreferences, 'push', type)) {
                promises.push(this.sendPushNotification(userId, options)
                    .catch(err => logger_1.logger.error('Push notification failed', { error: err })));
            }
        }
        await Promise.all(promises);
    }
    /**
     * Send push notification via FCM/APNS
     */
    async sendPushNotification(userId, options) {
        // Get user's push tokens
        const tokens = await prisma_1.prisma.pushToken.findMany({
            where: { userId, isActive: true },
        });
        if (tokens.length === 0) {
            logger_1.logger.debug('No push tokens for user', { userId });
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
                const admin = await Promise.resolve().then(() => __importStar(require('firebase-admin')));
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
                const tokenStrings = tokens.map(t => t.token);
                // Send to all user's devices
                const response = await admin.messaging().sendEachForMulticast({
                    tokens: tokenStrings,
                    ...payload,
                });
                // Handle failed tokens (remove invalid ones)
                response.responses.forEach((resp, idx) => {
                    if (!resp.success && resp.error) {
                        const errorCode = resp.error.code;
                        if (errorCode === 'messaging/invalid-registration-token' ||
                            errorCode === 'messaging/registration-token-not-registered') {
                            // Deactivate invalid token
                            prisma_1.prisma.pushToken.update({
                                where: { id: tokens[idx].id },
                                data: { isActive: false },
                            }).catch(e => logger_1.logger.warn('Failed to deactivate push token', { error: e }));
                        }
                    }
                });
                logger_1.logger.info('Push notifications sent', {
                    userId,
                    successCount: response.successCount,
                    failureCount: response.failureCount,
                });
            }
            catch (error) {
                logger_1.logger.error('Firebase push notification failed', { error, userId });
            }
        }
        else {
            // Log for development
            logger_1.logger.debug('Push notification (Firebase not configured)', { userId, title, tokens: tokens.length });
        }
    }
    shouldSend(prefs, channel, type) {
        if (!prefs)
            return true; // Default to opted-in
        const channelPrefs = prefs[channel];
        if (!channelPrefs)
            return true;
        const key = PREFERENCE_MAPPING[type];
        if (!key)
            return true; // Default to true if no specific mapping found (e.g. system types)
        return channelPrefs[key] !== false;
    }
    /**
     * Safe email wrapper
     */
    async sendEmailSafely(email, options) {
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
            await (0, email_service_1.sendEmail)({
                to: email,
                subject,
                html,
                text: message
            });
        }
        catch (error) {
            logger_1.logger.error('Email notification failed', { error, userId: options.userId });
        }
    }
}
exports.NotificationService = NotificationService;
exports.notificationService = new NotificationService();
//# sourceMappingURL=notification.service.js.map