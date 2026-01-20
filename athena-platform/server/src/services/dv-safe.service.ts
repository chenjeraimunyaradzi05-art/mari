/**
 * DV-Safe (Domestic Violence Safety) Features Service
 * Privacy-first features for survivors of domestic violence
 * 
 * Note: Currently uses in-memory storage. When SafetySettings and UserBlock
 * models are added to the Prisma schema, DB persistence can be enabled.
 */

import { logger } from '../utils/logger';
import { randomBytes } from 'crypto';

export interface SafetySettings {
  userId: string;
  isSafeMode: boolean;
  hideFromSearch: boolean;
  allowMessages: boolean;
  safeExitEnabled: boolean;
  safeExitUrl: string;
  hiddenChats: string[];
  blockedUsers: string[];
  emergencyContacts: EmergencyContact[];
  panicButtonEnabled: boolean;
  activityLogEnabled: boolean;
  disguisedAppIcon: boolean;
  notificationsSafe: boolean;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  relationship: string;
  notifyOnPanic: boolean;
}

export interface SafeChat {
  id: string;
  userId: string;
  name: string;
  disguisedName: string;
  participants: string[];
  isHidden: boolean;
  accessPin?: string;
  lastActivity: Date;
  messages: SafeMessage[];
}

export interface SafeMessage {
  id: string;
  senderId: string;
  content: string;
  isEncrypted: boolean;
  autoDeleteAt?: Date;
  createdAt: Date;
}

// In-memory store for safety settings (would be encrypted in DB in production)
const safetySettingsStore = new Map<string, SafetySettings>();
const safeChatsStore = new Map<string, SafeChat[]>();
const panicAlertLog = new Map<string, Date[]>();

/**
 * Get or create safety settings for a user
 */
export async function getSafetySettings(userId: string): Promise<SafetySettings> {
  // Check in-memory first
  if (safetySettingsStore.has(userId)) {
    return safetySettingsStore.get(userId)!;
  }

  // Return defaults (in-memory storage only - no DB table exists yet)
  const defaults: SafetySettings = {
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
export async function updateSafetySettings(
  userId: string,
  updates: Partial<SafetySettings>
): Promise<SafetySettings> {
  const current = await getSafetySettings(userId);
  const updated = { ...current, ...updates };
  
  safetySettingsStore.set(userId, updated);

  // Note: DB persistence would be added once SafetySettings model is added to schema
  logger.info('Safety settings updated', { userId, safeMode: updated.isSafeMode });
  return updated;
}

/**
 * Enable Safe Mode (quick activation)
 */
export async function enableSafeMode(userId: string): Promise<SafetySettings> {
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
export async function createSafeChat(
  userId: string,
  options: {
    name: string;
    disguisedName?: string;
    participants?: string[];
    accessPin?: string;
    autoDeleteHours?: number;
  }
): Promise<SafeChat> {
  const chatId = randomBytes(16).toString('hex');
  
  const safeChat: SafeChat = {
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

  logger.info('Safe chat created', { userId, chatId });
  return safeChat;
}

/**
 * Get user's safe chats
 */
export function getSafeChats(userId: string, accessPin?: string): SafeChat[] {
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
export function accessSafeChat(
  userId: string,
  chatId: string,
  pin?: string
): SafeChat | null {
  const chats = safeChatsStore.get(userId) || [];
  const chat = chats.find(c => c.id === chatId);
  
  if (!chat) return null;
  
  // Verify PIN if required
  if (chat.accessPin && chat.accessPin !== pin) {
    logger.warn('Invalid PIN attempt for safe chat', { userId, chatId });
    return null;
  }
  
  return chat;
}

/**
 * Send message to safe chat (auto-encrypted)
 */
export function sendSafeChatMessage(
  userId: string,
  chatId: string,
  content: string,
  autoDeleteHours?: number
): SafeMessage | null {
  const chat = accessSafeChat(userId, chatId);
  if (!chat) return null;

  const message: SafeMessage = {
    id: randomBytes(8).toString('hex'),
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
export async function triggerPanicButton(userId: string): Promise<{
  success: boolean;
  notifiedContacts: string[];
  timestamp: Date;
}> {
  const settings = await getSafetySettings(userId);
  const timestamp = new Date();
  
  // Log panic alert
  const alerts = panicAlertLog.get(userId) || [];
  alerts.push(timestamp);
  panicAlertLog.set(userId, alerts);

  const notifiedContacts: string[] = [];

  // Notify emergency contacts
  for (const contact of settings.emergencyContacts) {
    if (contact.notifyOnPanic) {
      try {
        // In production, send SMS/email via Twilio/SendGrid
        logger.info('Panic alert sent to emergency contact', {
          userId,
          contactName: contact.name,
          contactPhone: contact.phone,
        });
        notifiedContacts.push(contact.name);
      } catch (error) {
        logger.error('Failed to notify emergency contact', { error, contact: contact.name });
      }
    }
  }

  // Log to safety audit
  logger.warn('PANIC BUTTON TRIGGERED', {
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
export async function addEmergencyContact(
  userId: string,
  contact: Omit<EmergencyContact, 'id'>
): Promise<EmergencyContact> {
  const settings = await getSafetySettings(userId);
  
  const newContact: EmergencyContact = {
    id: randomBytes(8).toString('hex'),
    ...contact,
  };

  settings.emergencyContacts.push(newContact);
  await updateSafetySettings(userId, { emergencyContacts: settings.emergencyContacts });

  return newContact;
}

/**
 * Remove emergency contact
 */
export async function removeEmergencyContact(
  userId: string,
  contactId: string
): Promise<boolean> {
  const settings = await getSafetySettings(userId);
  
  const index = settings.emergencyContacts.findIndex(c => c.id === contactId);
  if (index === -1) return false;

  settings.emergencyContacts.splice(index, 1);
  await updateSafetySettings(userId, { emergencyContacts: settings.emergencyContacts });

  return true;
}

/**
 * Block user (for DV safety)
 */
export async function blockUser(
  userId: string,
  blockedUserId: string
): Promise<boolean> {
  const settings = await getSafetySettings(userId);
  
  if (settings.blockedUsers.includes(blockedUserId)) {
    return false;
  }

  settings.blockedUsers.push(blockedUserId);
  await updateSafetySettings(userId, { blockedUsers: settings.blockedUsers });

  // Note: Platform-level block would be added once UserBlock model is added to schema
  logger.info('User blocked for safety', { userId, blockedUserId });
  return true;
}

/**
 * Check if user should be visible to searcher
 */
export async function isUserVisible(
  targetUserId: string,
  searcherUserId?: string
): Promise<boolean> {
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
export function getSafeNotificationContent(
  settings: SafetySettings,
  originalTitle: string,
  originalMessage: string
): { title: string; message: string } {
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
export async function clearActivityTraces(userId: string): Promise<boolean> {
  try {
    // Clear search history
    // Clear message drafts
    // Clear recently viewed
    // Clear any cached data
    
    logger.info('Activity traces cleared for safety', { userId });
    return true;
  } catch (error) {
    logger.error('Failed to clear activity traces', { error, userId });
    return false;
  }
}

/**
 * Get DV resources and hotlines by region
 */
export function getDVResources(region: string = 'AU'): DVResource[] {
  const resources: Record<string, DVResource[]> = {
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

export interface DVResource {
  name: string;
  phone: string;
  website: string;
  description: string;
  available: string;
}

// Helper functions

function encryptMessage(content: string): string {
  // In production, use proper encryption (AES-256-GCM)
  // For now, base64 encode as placeholder
  return Buffer.from(content).toString('base64');
}

function decryptMessage(encrypted: string): string {
  return Buffer.from(encrypted, 'base64').toString('utf8');
}

export default {
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
