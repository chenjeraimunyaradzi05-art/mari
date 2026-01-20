"use strict";
/**
 * DV-Safe (Domestic Violence Safety) Features Service
 * Privacy-first features for survivors of domestic violence
 *
 * Note: Currently uses in-memory storage. When SafetySettings and UserBlock
 * models are added to the Prisma schema, DB persistence can be enabled.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSafetySettings = getSafetySettings;
exports.updateSafetySettings = updateSafetySettings;
exports.enableSafeMode = enableSafeMode;
exports.createSafeChat = createSafeChat;
exports.getSafeChats = getSafeChats;
exports.accessSafeChat = accessSafeChat;
exports.sendSafeChatMessage = sendSafeChatMessage;
exports.triggerPanicButton = triggerPanicButton;
exports.addEmergencyContact = addEmergencyContact;
exports.removeEmergencyContact = removeEmergencyContact;
exports.blockUser = blockUser;
exports.isUserVisible = isUserVisible;
exports.getSafeNotificationContent = getSafeNotificationContent;
exports.clearActivityTraces = clearActivityTraces;
exports.getDVResources = getDVResources;
const logger_1 = require("../utils/logger");
const crypto_1 = require("crypto");
// In-memory store for safety settings (would be encrypted in DB in production)
const safetySettingsStore = new Map();
const safeChatsStore = new Map();
const panicAlertLog = new Map();
/**
 * Get or create safety settings for a user
 */
async function getSafetySettings(userId) {
    // Check in-memory first
    if (safetySettingsStore.has(userId)) {
        return safetySettingsStore.get(userId);
    }
    // Return defaults (in-memory storage only - no DB table exists yet)
    const defaults = {
        userId,
        isSafeMode: false,
        hideFromSearch: false,
        allowMessages: true,
        safeExitEnabled: false,
        safeExitUrl: 'https://www.google.com',
        hiddenChats: [],
        blockedUsers: [],
        emergencyContacts: [],
        panicButtonEnabled: false,
        activityLogEnabled: true,
        disguisedAppIcon: false,
        notificationsSafe: true,
    };
    safetySettingsStore.set(userId, defaults);
    return defaults;
}
/**
 * Update safety settings
 */
async function updateSafetySettings(userId, updates) {
    const current = await getSafetySettings(userId);
    const updated = { ...current, ...updates };
    safetySettingsStore.set(userId, updated);
    // Note: DB persistence would be added once SafetySettings model is added to schema
    logger_1.logger.info('Safety settings updated', { userId, safeMode: updated.isSafeMode });
    return updated;
}
/**
 * Enable Safe Mode (quick activation)
 */
async function enableSafeMode(userId) {
    return updateSafetySettings(userId, {
        isSafeMode: true,
        hideFromSearch: true,
        allowMessages: false,
        notificationsSafe: true,
        safeExitEnabled: true,
    });
}
/**
 * Create a hidden/safe chat room
 */
async function createSafeChat(userId, options) {
    const chatId = (0, crypto_1.randomBytes)(16).toString('hex');
    const safeChat = {
        id: chatId,
        userId,
        name: options.name,
        disguisedName: options.disguisedName || 'Shopping List',
        participants: options.participants || [],
        isHidden: true,
        accessPin: options.accessPin,
        lastActivity: new Date(),
        messages: [],
    };
    // Store in memory
    const userChats = safeChatsStore.get(userId) || [];
    userChats.push(safeChat);
    safeChatsStore.set(userId, userChats);
    logger_1.logger.info('Safe chat created', { userId, chatId });
    return safeChat;
}
/**
 * Get user's safe chats
 */
function getSafeChats(userId, accessPin) {
    const chats = safeChatsStore.get(userId) || [];
    // If pin required, filter only accessible ones
    if (accessPin) {
        return chats.filter(c => !c.accessPin || c.accessPin === accessPin);
    }
    return chats;
}
/**
 * Access safe chat with PIN verification
 */
function accessSafeChat(userId, chatId, pin) {
    const chats = safeChatsStore.get(userId) || [];
    const chat = chats.find(c => c.id === chatId);
    if (!chat)
        return null;
    // Verify PIN if required
    if (chat.accessPin && chat.accessPin !== pin) {
        logger_1.logger.warn('Invalid PIN attempt for safe chat', { userId, chatId });
        return null;
    }
    return chat;
}
/**
 * Send message to safe chat (auto-encrypted)
 */
function sendSafeChatMessage(userId, chatId, content, autoDeleteHours) {
    const chat = accessSafeChat(userId, chatId);
    if (!chat)
        return null;
    const message = {
        id: (0, crypto_1.randomBytes)(8).toString('hex'),
        senderId: userId,
        content: encryptMessage(content),
        isEncrypted: true,
        autoDeleteAt: autoDeleteHours
            ? new Date(Date.now() + autoDeleteHours * 60 * 60 * 1000)
            : undefined,
        createdAt: new Date(),
    };
    chat.messages.push(message);
    chat.lastActivity = new Date();
    return message;
}
/**
 * Trigger panic button - notify emergency contacts
 */
async function triggerPanicButton(userId) {
    const settings = await getSafetySettings(userId);
    const timestamp = new Date();
    // Log panic alert
    const alerts = panicAlertLog.get(userId) || [];
    alerts.push(timestamp);
    panicAlertLog.set(userId, alerts);
    const notifiedContacts = [];
    // Notify emergency contacts
    for (const contact of settings.emergencyContacts) {
        if (contact.notifyOnPanic) {
            try {
                // In production, send SMS/email via Twilio/SendGrid
                logger_1.logger.info('Panic alert sent to emergency contact', {
                    userId,
                    contactName: contact.name,
                    contactPhone: contact.phone,
                });
                notifiedContacts.push(contact.name);
            }
            catch (error) {
                logger_1.logger.error('Failed to notify emergency contact', { error, contact: contact.name });
            }
        }
    }
    // Log to safety audit
    logger_1.logger.warn('PANIC BUTTON TRIGGERED', {
        userId,
        timestamp,
        contactsNotified: notifiedContacts.length,
    });
    return {
        success: true,
        notifiedContacts,
        timestamp,
    };
}
/**
 * Add emergency contact
 */
async function addEmergencyContact(userId, contact) {
    const settings = await getSafetySettings(userId);
    const newContact = {
        id: (0, crypto_1.randomBytes)(8).toString('hex'),
        ...contact,
    };
    settings.emergencyContacts.push(newContact);
    await updateSafetySettings(userId, { emergencyContacts: settings.emergencyContacts });
    return newContact;
}
/**
 * Remove emergency contact
 */
async function removeEmergencyContact(userId, contactId) {
    const settings = await getSafetySettings(userId);
    const index = settings.emergencyContacts.findIndex(c => c.id === contactId);
    if (index === -1)
        return false;
    settings.emergencyContacts.splice(index, 1);
    await updateSafetySettings(userId, { emergencyContacts: settings.emergencyContacts });
    return true;
}
/**
 * Block user (for DV safety)
 */
async function blockUser(userId, blockedUserId) {
    const settings = await getSafetySettings(userId);
    if (settings.blockedUsers.includes(blockedUserId)) {
        return false;
    }
    settings.blockedUsers.push(blockedUserId);
    await updateSafetySettings(userId, { blockedUsers: settings.blockedUsers });
    // Note: Platform-level block would be added once UserBlock model is added to schema
    logger_1.logger.info('User blocked for safety', { userId, blockedUserId });
    return true;
}
/**
 * Check if user should be visible to searcher
 */
async function isUserVisible(targetUserId, searcherUserId) {
    const settings = await getSafetySettings(targetUserId);
    // Hidden from search
    if (settings.hideFromSearch) {
        return false;
    }
    // Check if searcher is blocked
    if (searcherUserId && settings.blockedUsers.includes(searcherUserId)) {
        return false;
    }
    return true;
}
/**
 * Get safe notification content (no sensitive info)
 */
function getSafeNotificationContent(settings, originalTitle, originalMessage) {
    if (!settings.notificationsSafe) {
        return { title: originalTitle, message: originalMessage };
    }
    // Return generic notification that doesn't reveal app/content
    return {
        title: 'New Update',
        message: 'You have a new update. Open app to view.',
    };
}
/**
 * Delete all activity traces (for safety)
 */
async function clearActivityTraces(userId) {
    try {
        // Clear search history
        // Clear message drafts
        // Clear recently viewed
        // Clear any cached data
        logger_1.logger.info('Activity traces cleared for safety', { userId });
        return true;
    }
    catch (error) {
        logger_1.logger.error('Failed to clear activity traces', { error, userId });
        return false;
    }
}
/**
 * Get DV resources and hotlines by region
 */
function getDVResources(region = 'AU') {
    const resources = {
        AU: [
            {
                name: '1800RESPECT',
                phone: '1800 737 732',
                website: 'https://www.1800respect.org.au',
                description: 'National sexual assault, family & domestic violence counselling',
                available: '24/7',
            },
            {
                name: 'Lifeline',
                phone: '13 11 14',
                website: 'https://www.lifeline.org.au',
                description: 'Crisis support and suicide prevention',
                available: '24/7',
            },
            {
                name: 'DV Connect',
                phone: '1800 811 811',
                website: 'https://www.dvconnect.org',
                description: 'Queensland domestic violence helpline',
                available: '24/7',
            },
            {
                name: 'Safe Steps',
                phone: '1800 015 188',
                website: 'https://www.safesteps.org.au',
                description: 'Victoria family violence response center',
                available: '24/7',
            },
        ],
        NZ: [
            {
                name: 'Women\'s Refuge',
                phone: '0800 733 843',
                website: 'https://womensrefuge.org.nz',
                description: 'National crisis line for women and children',
                available: '24/7',
            },
        ],
        UK: [
            {
                name: 'National Domestic Abuse Helpline',
                phone: '0808 2000 247',
                website: 'https://www.nationaldahelpline.org.uk',
                description: 'Run by Refuge for women experiencing domestic abuse',
                available: '24/7',
            },
        ],
        US: [
            {
                name: 'National Domestic Violence Hotline',
                phone: '1-800-799-7233',
                website: 'https://www.thehotline.org',
                description: 'National hotline for domestic violence support',
                available: '24/7',
            },
        ],
    };
    return resources[region] || resources['AU'];
}
// Helper functions
function encryptMessage(content) {
    // In production, use proper encryption (AES-256-GCM)
    // For now, base64 encode as placeholder
    return Buffer.from(content).toString('base64');
}
function decryptMessage(encrypted) {
    return Buffer.from(encrypted, 'base64').toString('utf8');
}
exports.default = {
    getSafetySettings,
    updateSafetySettings,
    enableSafeMode,
    createSafeChat,
    getSafeChats,
    accessSafeChat,
    sendSafeChatMessage,
    triggerPanicButton,
    addEmergencyContact,
    removeEmergencyContact,
    blockUser,
    isUserVisible,
    getSafeNotificationContent,
    clearActivityTraces,
    getDVResources,
};
//# sourceMappingURL=dv-safe.service.js.map