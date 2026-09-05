import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    dvSafetyProfile: { upsert: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    dvSafeChat: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn(), delete: jest.fn() },
    dvSafeMessage: { create: jest.fn(), findMany: jest.fn(), deleteMany: jest.fn() },
    dvPanicAlert: { create: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}));

jest.mock('../../utils/email', () => ({ sendEmail: jest.fn(async () => true) }));
jest.mock('../../utils/safety-store', () => ({ blockUser: jest.fn(async () => ({ created: true })) }));
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { prisma as prismaTyped } from '../../utils/prisma';
import { sendEmail } from '../../utils/email';
import { blockUser as platformBlock } from '../../utils/safety-store';
import dvSafe, { decryptMessage } from '../dv-safe.service';

const prisma: any = prismaTyped;

const profile = (overrides: Record<string, unknown> = {}) => ({
  id: 'prof-1',
  userId: 'u1',
  isSafeMode: false,
  hideFromSearch: false,
  allowMessages: true,
  safeExitEnabled: false,
  safeExitUrl: 'https://www.google.com',
  panicButtonEnabled: false,
  activityLogEnabled: true,
  disguisedAppIcon: false,
  notificationsSafe: true,
  emergencyContacts: [],
  blockedUserIds: [],
  ...overrides,
});

describe('DV safety settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.dvSafetyProfile.upsert.mockResolvedValue(profile());
    prisma.dvSafeChat.findMany.mockResolvedValue([]);
  });

  it('creates the profile with defaults on first read and reports it in the settings shape', async () => {
    const settings = await dvSafe.getSafetySettings('u1');
    expect(prisma.dvSafetyProfile.upsert).toHaveBeenCalledWith({ where: { userId: 'u1' }, update: {}, create: { userId: 'u1' } });
    expect(settings).toMatchObject({ userId: 'u1', isSafeMode: false, safeExitUrl: 'https://www.google.com', emergencyContacts: [], hiddenChats: [] });
  });

  it('safe mode turns every protective switch on at once', async () => {
    prisma.dvSafetyProfile.update.mockResolvedValue(profile({ isSafeMode: true, hideFromSearch: true, allowMessages: false }));
    await dvSafe.enableSafeMode('u1');
    expect(prisma.dvSafetyProfile.update.mock.calls[0][0].data).toEqual({
      isSafeMode: true,
      hideFromSearch: true,
      allowMessages: false,
      notificationsSafe: true,
      safeExitEnabled: true,
      panicButtonEnabled: true,
    });
  });

  it('refuses a quick-exit address that is not a web address', async () => {
    await expect(dvSafe.updateSafetySettings('u1', { safeExitUrl: 'javascript:alert(1)' })).rejects.toMatchObject({ statusCode: 400 });
    await expect(dvSafe.updateSafetySettings('u1', { safeExitUrl: 'not a url' })).rejects.toMatchObject({ statusCode: 400 });
    expect(prisma.dvSafetyProfile.update).not.toHaveBeenCalled();
  });
});

describe('Safe chats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.dvSafetyProfile.upsert.mockResolvedValue(profile());
    prisma.dvSafeMessage.deleteMany.mockResolvedValue({ count: 0 });
    prisma.dvSafeMessage.findMany.mockResolvedValue([]);
    prisma.dvSafeChat.update.mockResolvedValue({});
  });

  it('stores the PIN as a salted hash, never the PIN, and lists chats without it', async () => {
    prisma.dvSafeChat.create.mockImplementation(async (args: any) => ({ id: 'c1', createdAt: new Date(), lastActivity: new Date(), participants: [], ...args.data }));
    const created = await dvSafe.createSafeChat('u1', { name: 'Plan', accessPin: '2468' });

    const stored = prisma.dvSafeChat.create.mock.calls[0][0].data;
    expect(stored.accessPinHash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{64}$/);
    expect(stored.accessPinHash).not.toContain('2468');
    expect(stored.disguisedName).toBe('Shopping List');
    expect(created).toMatchObject({ id: 'c1', hasPin: true, messageCount: 0 });
    expect(JSON.stringify(created)).not.toContain('accessPin');
  });

  it('opens with the right PIN, refuses the wrong one, and never leaks whether a chat exists', async () => {
    const chat = { id: 'c1', profileId: 'prof-1', name: 'Plan', disguisedName: 'Recipes', participants: [], createdAt: new Date(), lastActivity: new Date(), accessPinHash: '' };
    prisma.dvSafeChat.create.mockImplementation(async (args: any) => ({ ...chat, ...args.data }));
    const created = await dvSafe.createSafeChat('u1', { name: 'Plan', accessPin: '1357' });
    chat.accessPinHash = prisma.dvSafeChat.create.mock.calls[0][0].data.accessPinHash;
    prisma.dvSafeChat.findFirst.mockResolvedValue(chat);

    await expect(dvSafe.accessSafeChat('u1', created.id, '0000')).rejects.toMatchObject({ statusCode: 403 });
    await expect(dvSafe.accessSafeChat('u1', created.id)).rejects.toMatchObject({ statusCode: 403 });
    const opened = await dvSafe.accessSafeChat('u1', created.id, '1357');
    expect(opened.messages).toEqual([]);

    prisma.dvSafeChat.findFirst.mockResolvedValue(null);
    await expect(dvSafe.accessSafeChat('u1', 'someone-elses', '1357')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('encrypts a message at rest and hands it back readable on open, dropping expired ones first', async () => {
    const chat = { id: 'c1', profileId: 'prof-1', name: 'Plan', disguisedName: 'Recipes', participants: [], createdAt: new Date(), lastActivity: new Date(), accessPinHash: null };
    prisma.dvSafeChat.findFirst.mockResolvedValue(chat);
    prisma.dvSafeMessage.create.mockImplementation(async (args: any) => ({ id: 'm1', createdAt: new Date(), ...args.data }));

    const sent = await dvSafe.sendSafeChatMessage('u1', 'c1', 'Leave Tuesday, keys with Mum', 60);
    const stored = prisma.dvSafeMessage.create.mock.calls[0][0].data;
    expect(stored.content).not.toContain('Tuesday');
    expect(decryptMessage(stored.content)).toBe('Leave Tuesday, keys with Mum');
    expect(stored.autoDeleteAt).toBeInstanceOf(Date);
    expect(sent.content).toBe('Leave Tuesday, keys with Mum');

    prisma.dvSafeMessage.findMany.mockResolvedValue([{ id: 'm1', senderId: 'u1', content: stored.content, autoDeleteAt: stored.autoDeleteAt, createdAt: new Date() }]);
    const opened = await dvSafe.accessSafeChat('u1', 'c1');
    expect(prisma.dvSafeMessage.deleteMany.mock.calls[0][0].where).toMatchObject({ chatId: 'c1', autoDeleteAt: { lte: expect.any(Date) } });
    expect(opened.messages[0].content).toBe('Leave Tuesday, keys with Mum');
  });
});

describe('Panic button', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({ firstName: 'Sarah', displayName: null });
    prisma.dvPanicAlert.create.mockResolvedValue({});
  });

  it('emails the contacts who asked to be told and have an email, reports the rest as unreachable, and records the alert', async () => {
    prisma.dvSafetyProfile.upsert.mockResolvedValue(
      profile({
        emergencyContacts: [
          { id: 'a', name: 'Mum', phone: '0400 000 000', email: 'mum@example.com', relationship: 'Mother', notifyOnPanic: true },
          { id: 'b', name: 'Jo', phone: '0400 000 001', relationship: 'Friend', notifyOnPanic: true },
          { id: 'c', name: 'Old boss', phone: '0400 000 002', email: 'boss@example.com', relationship: 'Ex-manager', notifyOnPanic: false },
        ],
      })
    );

    const result = await dvSafe.triggerPanicButton('u1');

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const mail = (sendEmail as any).mock.calls[0][0];
    expect(mail.to).toBe('mum@example.com');
    expect(mail.subject).toBe('Safety alert from Sarah');
    expect(mail.text).toContain('000');
    expect(result).toMatchObject({ success: true, notifiedContacts: ['Mum'], unreachableContacts: ['Jo'], smsAvailable: false });
    expect(prisma.dvPanicAlert.create.mock.calls[0][0].data).toMatchObject({ profileId: 'prof-1', notifiedContacts: ['Mum'] });
  });
});

describe('Safety blocks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.dvSafetyProfile.upsert.mockResolvedValue(profile());
    prisma.dvSafetyProfile.update.mockResolvedValue({});
  });

  it('records the block and applies it platform-wide', async () => {
    await dvSafe.blockUser('u1', 'abuser');
    expect(prisma.dvSafetyProfile.update.mock.calls[0][0].data).toEqual({ blockedUserIds: { push: 'abuser' } });
    expect(platformBlock).toHaveBeenCalledWith('u1', 'abuser');
    await expect(dvSafe.blockUser('u1', 'u1')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('hides a member who asked to be hidden from search, and from anyone they blocked', async () => {
    prisma.dvSafetyProfile.findUnique.mockResolvedValue(profile({ hideFromSearch: false, blockedUserIds: ['abuser'] }));
    expect(await dvSafe.isUserVisible('u1', 'abuser')).toBe(false);
    expect(await dvSafe.isUserVisible('u1', 'friend')).toBe(true);
    prisma.dvSafetyProfile.findUnique.mockResolvedValue(null);
    expect(await dvSafe.isUserVisible('u1', 'anyone')).toBe(true);
  });
});
