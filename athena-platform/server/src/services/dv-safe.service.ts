/**
 * DV Safe Mode.
 *
 * Settings, emergency contacts, safe chats and panic alerts for a member in a
 * dangerous situation at home. Everything here used to live in process
 * memory, so a restart or a second replica lost every setting and every safe
 * chat. It is now persisted: DvSafetyProfile, DvSafeChat, DvSafeMessage and
 * DvPanicAlert.
 *
 * Safe chat messages are encrypted at rest with AES-256-GCM under
 * DV_ENCRYPTION_KEY and decrypted only when the owner opens the chat. A chat's
 * PIN is stored as a salted scrypt hash and compared in constant time. A
 * message with an auto-delete time is removed the first time the chat is
 * opened after that time passes.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { sendEmail } from '../utils/email';
import { ApiError } from '../middleware/errorHandler';
import { blockUser as platformBlockUser } from '../utils/safety-store';

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

export interface SafeChatSummary {
  id: string;
  name: string;
  disguisedName: string;
  participants: string[];
  hasPin: boolean;
  isHidden: boolean;
  lastActivity: Date;
  messageCount: number;
  createdAt: Date;
}

export interface SafeMessage {
  id: string;
  senderId: string;
  /** Plain text: decrypted for the owner who opened the chat. */
  content: string;
  autoDeleteAt?: Date;
  createdAt: Date;
}

export interface SafeChat extends SafeChatSummary {
  messages: SafeMessage[];
}

export interface DVResource {
  name: string;
  phone: string;
  website: string;
  description: string;
  available: string;
}

const SETTING_KEYS = [
  'isSafeMode',
  'hideFromSearch',
  'allowMessages',
  'safeExitEnabled',
  'safeExitUrl',
  'panicButtonEnabled',
  'activityLogEnabled',
  'disguisedAppIcon',
  'notificationsSafe',
] as const;

type ProfileRow = {
  id: string;
  userId: string;
  isSafeMode: boolean;
  hideFromSearch: boolean;
  allowMessages: boolean;
  safeExitEnabled: boolean;
  safeExitUrl: string;
  panicButtonEnabled: boolean;
  activityLogEnabled: boolean;
  disguisedAppIcon: boolean;
  notificationsSafe: boolean;
  emergencyContacts: unknown;
  blockedUserIds: string[];
};

function contactsOf(raw: unknown): EmergencyContact[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is Record<string, unknown> => Boolean(c) && typeof c === 'object')
    .map((c) => ({
      id: String(c.id ?? ''),
      name: String(c.name ?? ''),
      phone: String(c.phone ?? ''),
      email: typeof c.email === 'string' && c.email ? c.email : undefined,
      relationship: String(c.relationship ?? ''),
      notifyOnPanic: c.notifyOnPanic !== false,
    }))
    .filter((c) => c.id && c.name);
}

async function profileFor(userId: string): Promise<ProfileRow> {
  return prisma.dvSafetyProfile.upsert({
    where: { userId },
    update: {},
    create: { userId },
  }) as Promise<ProfileRow>;
}

async function toSettings(profile: ProfileRow): Promise<SafetySettings> {
  const chats = await prisma.dvSafeChat.findMany({ where: { profileId: profile.id }, select: { id: true } });
  return {
    userId: profile.userId,
    isSafeMode: profile.isSafeMode,
    hideFromSearch: profile.hideFromSearch,
    allowMessages: profile.allowMessages,
    safeExitEnabled: profile.safeExitEnabled,
    safeExitUrl: profile.safeExitUrl,
    hiddenChats: chats.map((c) => c.id),
    blockedUsers: profile.blockedUserIds ?? [],
    emergencyContacts: contactsOf(profile.emergencyContacts),
    panicButtonEnabled: profile.panicButtonEnabled,
    activityLogEnabled: profile.activityLogEnabled,
    disguisedAppIcon: profile.disguisedAppIcon,
    notificationsSafe: profile.notificationsSafe,
  };
}

export async function getSafetySettings(userId: string): Promise<SafetySettings> {
  return toSettings(await profileFor(userId));
}

/** Only the switches and the exit URL; contacts and blocks have their own functions. */
export async function updateSafetySettings(userId: string, updates: Partial<SafetySettings>): Promise<SafetySettings> {
  const data: Record<string, unknown> = {};
  for (const key of SETTING_KEYS) {
    if (updates[key] !== undefined) data[key] = updates[key];
  }
  if (typeof data.safeExitUrl === 'string') {
    let parsed: URL;
    try {
      parsed = new URL(data.safeExitUrl);
    } catch {
      throw new ApiError(400, 'The quick exit address must be a full web address');
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new ApiError(400, 'The quick exit address must start with https://');
    }
  }
  if (Array.isArray(updates.emergencyContacts)) {
    data.emergencyContacts = updates.emergencyContacts as unknown as Prisma.InputJsonValue;
  }
  await profileFor(userId);
  const profile = (await prisma.dvSafetyProfile.update({ where: { userId }, data })) as ProfileRow;
  logger.info('DV safety settings updated', { userId, safeMode: profile.isSafeMode });
  return toSettings(profile);
}

/** One switch that turns everything protective on at once. */
export async function enableSafeMode(userId: string): Promise<SafetySettings> {
  return updateSafetySettings(userId, {
    isSafeMode: true,
    hideFromSearch: true,
    allowMessages: false,
    notificationsSafe: true,
    safeExitEnabled: true,
    panicButtonEnabled: true,
  });
}

// ---------------------------------------------------------------- PIN hashing

function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(pin, salt, 32);
  return `${salt.toString('hex')}:${key.toString('hex')}`;
}

function verifyPin(pin: string | undefined, stored: string | null): boolean {
  if (!stored) return true;
  if (!pin) return false;
  const [saltHex, keyHex] = stored.split(':');
  if (!saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = scryptSync(pin, Buffer.from(saltHex, 'hex'), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// ---------------------------------------------------------------- safe chats

type ChatRow = {
  id: string;
  profileId: string;
  name: string;
  disguisedName: string;
  participants: string[];
  accessPinHash: string | null;
  lastActivity: Date;
  createdAt: Date;
};

function summarize(chat: ChatRow, messageCount: number): SafeChatSummary {
  return {
    id: chat.id,
    name: chat.name,
    disguisedName: chat.disguisedName,
    participants: chat.participants ?? [],
    hasPin: Boolean(chat.accessPinHash),
    isHidden: true,
    lastActivity: chat.lastActivity,
    messageCount,
    createdAt: chat.createdAt,
  };
}

export async function createSafeChat(
  userId: string,
  options: { name: string; disguisedName?: string; participants?: string[]; accessPin?: string }
): Promise<SafeChatSummary> {
  const profile = await profileFor(userId);
  const chat = (await prisma.dvSafeChat.create({
    data: {
      profileId: profile.id,
      name: options.name,
      disguisedName: options.disguisedName?.trim() || 'Shopping List',
      participants: options.participants ?? [],
      accessPinHash: options.accessPin ? hashPin(options.accessPin) : null,
    },
  })) as ChatRow;
  logger.info('Safe chat created', { userId, chatId: chat.id });
  return summarize(chat, 0);
}

/** The owner's chats under their disguised names; no messages, no PIN. */
export async function getSafeChats(userId: string): Promise<SafeChatSummary[]> {
  const profile = await profileFor(userId);
  const chats = (await prisma.dvSafeChat.findMany({
    where: { profileId: profile.id },
    orderBy: { lastActivity: 'desc' },
    include: { _count: { select: { messages: true } } },
  })) as Array<ChatRow & { _count: { messages: number } }>;
  return chats.map((chat) => summarize(chat, chat._count.messages));
}

async function ownChat(userId: string, chatId: string): Promise<ChatRow> {
  const chat = (await prisma.dvSafeChat.findFirst({
    where: { id: chatId, profile: { userId } },
  })) as ChatRow | null;
  if (!chat) throw new ApiError(404, 'Chat not found');
  return chat;
}

function requirePin(chat: ChatRow, pin: string | undefined, userId: string): void {
  if (!verifyPin(pin, chat.accessPinHash)) {
    logger.warn('Wrong PIN for safe chat', { userId, chatId: chat.id });
    throw new ApiError(403, 'That PIN is not right');
  }
}

/** Opens a chat: verifies the PIN, drops messages past their auto-delete time, decrypts the rest. */
export async function accessSafeChat(userId: string, chatId: string, pin?: string): Promise<SafeChat> {
  const chat = await ownChat(userId, chatId);
  requirePin(chat, pin, userId);

  await prisma.dvSafeMessage.deleteMany({ where: { chatId: chat.id, autoDeleteAt: { lte: new Date() } } });
  const rows = await prisma.dvSafeMessage.findMany({ where: { chatId: chat.id }, orderBy: { createdAt: 'asc' }, take: 500 });
  const messages: SafeMessage[] = rows.map((row) => ({
    id: row.id,
    senderId: row.senderId,
    content: safeDecrypt(row.content),
    autoDeleteAt: row.autoDeleteAt ?? undefined,
    createdAt: row.createdAt,
  }));
  return { ...summarize(chat, messages.length), messages };
}

export async function sendSafeChatMessage(
  userId: string,
  chatId: string,
  content: string,
  autoDeleteMinutes?: number,
  pin?: string
): Promise<SafeMessage> {
  const chat = await ownChat(userId, chatId);
  requirePin(chat, pin, userId);

  const autoDeleteAt = autoDeleteMinutes && autoDeleteMinutes > 0 ? new Date(Date.now() + autoDeleteMinutes * 60 * 1000) : null;
  const row = await prisma.dvSafeMessage.create({
    data: { chatId: chat.id, senderId: userId, content: encryptMessage(content), autoDeleteAt },
  });
  await prisma.dvSafeChat.update({ where: { id: chat.id }, data: { lastActivity: new Date() } });
  return { id: row.id, senderId: row.senderId, content, autoDeleteAt: row.autoDeleteAt ?? undefined, createdAt: row.createdAt };
}

export async function deleteSafeChat(userId: string, chatId: string, pin?: string): Promise<void> {
  const chat = await ownChat(userId, chatId);
  requirePin(chat, pin, userId);
  await prisma.dvSafeChat.delete({ where: { id: chat.id } });
  logger.info('Safe chat deleted', { userId, chatId });
}

// ---------------------------------------------------------------- panic

export interface PanicResult {
  success: boolean;
  /** Contacts reached by email. */
  notifiedContacts: string[];
  /** Contacts who asked to be told but have no email on file; SMS is not available. */
  unreachableContacts: string[];
  smsAvailable: false;
  timestamp: Date;
}

/**
 * Tells the member's emergency contacts. Email is the only channel this
 * platform has; a contact with a phone number only is reported back as not
 * reached, so the member knows to call. The alert itself is recorded.
 */
export async function triggerPanicButton(userId: string): Promise<PanicResult> {
  const profile = await profileFor(userId);
  const contacts = contactsOf(profile.emergencyContacts).filter((c) => c.notifyOnPanic);
  const timestamp = new Date();

  const member = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, displayName: true } });
  const memberName = member?.displayName?.trim() || member?.firstName?.trim() || 'Someone you know';
  const when = timestamp.toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', dateStyle: 'medium', timeStyle: 'short' });

  const notified: string[] = [];
  const unreachable: string[] = [];
  for (const contact of contacts) {
    if (!contact.email) {
      unreachable.push(contact.name);
      continue;
    }
    try {
      const sent = await sendEmail({
        to: contact.email,
        subject: `Safety alert from ${memberName}`,
        text: `${contact.name},\n\n${memberName} has pressed the safety alert button in ATHENA at ${when} (Brisbane time) and asked for you to be told.\n\nPlease try to reach them now. If you believe they are in immediate danger, call 000 (Australia) or your local emergency number.\n\nATHENA`,
        html: `<p>${contact.name},</p><p><strong>${memberName}</strong> has pressed the safety alert button in ATHENA at ${when} (Brisbane time) and asked for you to be told.</p><p>Please try to reach them now. If you believe they are in immediate danger, call <strong>000</strong> (Australia) or your local emergency number.</p><p>ATHENA</p>`,
      });
      if (sent) notified.push(contact.name);
      else unreachable.push(contact.name);
    } catch (error) {
      logger.error('Panic alert email failed', { userId, contact: contact.name, error: error instanceof Error ? error.message : String(error) });
      unreachable.push(contact.name);
    }
  }

  await prisma.dvPanicAlert.create({
    data: { profileId: profile.id, triggeredAt: timestamp, notifiedContacts: notified as unknown as Prisma.InputJsonValue },
  });
  logger.warn('PANIC BUTTON TRIGGERED', { userId, timestamp, notified: notified.length, unreachable: unreachable.length });

  return { success: true, notifiedContacts: notified, unreachableContacts: unreachable, smsAvailable: false, timestamp };
}

// ---------------------------------------------------------------- contacts and blocks

export async function addEmergencyContact(userId: string, contact: Omit<EmergencyContact, 'id'>): Promise<EmergencyContact> {
  const profile = await profileFor(userId);
  const contacts = contactsOf(profile.emergencyContacts);
  if (contacts.length >= 10) throw new ApiError(400, 'You can keep up to 10 emergency contacts');
  const created: EmergencyContact = { id: randomBytes(8).toString('hex'), ...contact };
  await prisma.dvSafetyProfile.update({
    where: { id: profile.id },
    data: { emergencyContacts: [...contacts, created] as unknown as Prisma.InputJsonValue },
  });
  return created;
}

export async function removeEmergencyContact(userId: string, contactId: string): Promise<boolean> {
  const profile = await profileFor(userId);
  const contacts = contactsOf(profile.emergencyContacts);
  const remaining = contacts.filter((c) => c.id !== contactId);
  if (remaining.length === contacts.length) return false;
  await prisma.dvSafetyProfile.update({
    where: { id: profile.id },
    data: { emergencyContacts: remaining as unknown as Prisma.InputJsonValue },
  });
  return true;
}

/** A safety block: recorded here and applied platform-wide, so it also ends follows and threads. */
export async function blockUser(userId: string, blockedUserId: string): Promise<boolean> {
  if (userId === blockedUserId) throw new ApiError(400, 'You cannot block yourself');
  const profile = await profileFor(userId);
  const already = (profile.blockedUserIds ?? []).includes(blockedUserId);
  if (!already) {
    await prisma.dvSafetyProfile.update({ where: { id: profile.id }, data: { blockedUserIds: { push: blockedUserId } } });
  }
  try {
    await platformBlockUser(userId, blockedUserId);
  } catch (error) {
    logger.warn('Platform block alongside a safety block failed', { userId, error: error instanceof Error ? error.message : String(error) });
  }
  logger.info('User blocked for safety', { userId, blockedUserId });
  return !already;
}

export async function isUserVisible(targetUserId: string, searcherUserId?: string): Promise<boolean> {
  const profile = (await prisma.dvSafetyProfile.findUnique({ where: { userId: targetUserId } })) as ProfileRow | null;
  if (!profile) return true;
  if (profile.hideFromSearch) return false;
  if (searcherUserId && (profile.blockedUserIds ?? []).includes(searcherUserId)) return false;
  return true;
}

export function getSafeNotificationContent(
  settings: SafetySettings,
  originalTitle: string,
  originalMessage: string
): { title: string; message: string } {
  if (!settings.notificationsSafe) {
    return { title: originalTitle, message: originalMessage };
  }
  return { title: 'New Update', message: 'You have a new update. Open app to view.' };
}

/** The server keeps no browsing traces; the client clears its own storage. Logged so it is auditable. */
export async function clearActivityTraces(userId: string): Promise<boolean> {
  logger.info('Activity traces cleared for safety', { userId });
  return true;
}

// ---------------------------------------------------------------- resources

export function getDVResources(region: string = 'AU'): DVResource[] {
  const resources: Record<string, DVResource[]> = {
    AU: [
      { name: '1800RESPECT', phone: '1800 737 732', website: 'https://www.1800respect.org.au', description: 'National sexual assault, family and domestic violence counselling', available: '24/7' },
      { name: 'Lifeline', phone: '13 11 14', website: 'https://www.lifeline.org.au', description: 'Crisis support and suicide prevention', available: '24/7' },
      { name: 'DVConnect Womensline', phone: '1800 811 811', website: 'https://www.dvconnect.org', description: 'Queensland domestic and family violence helpline', available: '24/7' },
      { name: 'Safe Steps', phone: '1800 015 188', website: 'https://www.safesteps.org.au', description: 'Victoria family violence response centre', available: '24/7' },
      { name: 'Emergency', phone: '000', website: 'https://www.triplezero.gov.au', description: 'Police, fire and ambulance', available: '24/7' },
    ],
    NZ: [
      { name: "Women's Refuge", phone: '0800 733 843', website: 'https://womensrefuge.org.nz', description: 'National crisis line for women and children', available: '24/7' },
    ],
    UK: [
      { name: 'National Domestic Abuse Helpline', phone: '0808 2000 247', website: 'https://www.nationaldahelpline.org.uk', description: 'Run by Refuge for women experiencing domestic abuse', available: '24/7' },
    ],
    US: [
      { name: 'National Domestic Violence Hotline', phone: '1-800-799-7233', website: 'https://www.thehotline.org', description: 'National hotline for domestic violence support', available: '24/7' },
    ],
  };
  return resources[region.toUpperCase()] || resources.AU;
}

// ---------------------------------------------------------------- encryption

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16;

function getDVEncryptionKey(): Buffer {
  const keyHex = process.env.DV_ENCRYPTION_KEY;
  const isValidKey = Boolean(keyHex && /^[0-9a-fA-F]{64}$/.test(keyHex));

  if (!isValidKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DV_ENCRYPTION_KEY must be a 64-character hex key in production');
    }
    return scryptSync('dev-only-insecure-key', 'athena-dv-salt', 32);
  }

  return Buffer.from(keyHex!, 'hex');
}

export function encryptMessage(content: string): string {
  const key = getDVEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(content, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: base64(iv + authTag + ciphertext)
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decryptMessage(encrypted: string): string {
  const key = getDVEncryptionKey();
  const data = Buffer.from(encrypted, 'base64');
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}

/** A message written under a key this host no longer has is shown as unreadable, never as an error. */
function safeDecrypt(encrypted: string): string {
  try {
    return decryptMessage(encrypted);
  } catch {
    return '[This message could not be read]';
  }
}

export default {
  getSafetySettings,
  updateSafetySettings,
  enableSafeMode,
  createSafeChat,
  getSafeChats,
  accessSafeChat,
  sendSafeChatMessage,
  deleteSafeChat,
  triggerPanicButton,
  addEmergencyContact,
  removeEmergencyContact,
  blockUser,
  isUserVisible,
  getSafeNotificationContent,
  clearActivityTraces,
  getDVResources,
};
