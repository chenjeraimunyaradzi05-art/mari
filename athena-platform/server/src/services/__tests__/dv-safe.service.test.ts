import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    dvSafetyProfile: { upsert: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    dvSafeChat: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn(), delete: jest.fn() },
    dvSafeMessage: { create: jest.fn(), findMany: jest.fn(), deleteMany: jest.fn() },
    dvPanicAlert: { create: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn() },
    profile: { upsert: jest.fn() },
  },
}));

jest.mock('../../utils/email', () => ({ sendEmail: jest.fn(async () => true) }));
jest.mock('../dv-sms.service', () => ({
  isSmsConfigured: jest.fn(() => false),
  sendSms: jest.fn(async () => ({ sent: false, reason: 'not-configured' })),
}));
jest.mock('../../utils/safety-store', () => ({ blockUser: jest.fn(async () => ({ created: true })) }));
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { prisma as prismaTyped } from '../../utils/prisma';
import { sendEmail } from '../../utils/email';
import { isSmsConfigured, sendSms } from '../dv-sms.service';
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

  it('writes safe mode through to the columns the rest of the platform reads', async () => {
    prisma.dvSafetyProfile.update.mockResolvedValue(profile({ isSafeMode: true, hideFromSearch: true, allowMessages: false }));
    await dvSafe.enableSafeMode('u1');

    // Profile.isSafeMode is what the Safety Centre page shows and
    // Profile.hideFromSearch is what the privacy page writes; both are honoured
    // by the search query, so both have to move when Safe Mode goes on.
    expect(prisma.profile.upsert.mock.calls[0][0]).toMatchObject({
      where: { userId: 'u1' },
      update: { isSafeMode: true, hideFromSearch: true },
    });
    // User.allowMessages is the flag direct-message.service checks before it
    // will let anyone send to her, so closing her messages has to reach it.
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { allowMessages: false } });
  });

  it('leaves the twin columns alone for a switch that does not have one', async () => {
    prisma.dvSafetyProfile.update.mockResolvedValue(profile({ panicButtonEnabled: true }));
    await dvSafe.updateSafetySettings('u1', { panicButtonEnabled: true });
    expect(prisma.profile.upsert).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
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
    (sendEmail as any).mockResolvedValue(true);
    (isSmsConfigured as any).mockReturnValue(false);
    (sendSms as any).mockResolvedValue({ sent: false, reason: 'not-configured' });
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
    expect(result).toMatchObject({
      success: true,
      outcome: 'PARTIALLY_ALERTED',
      reachedCount: 1,
      unreachableCount: 1,
      contactCount: 2,
      notifiedContacts: ['Mum'],
      unreachableContacts: ['Jo'],
      smsAvailable: false,
    });
    expect(result.message).toContain('Jo');
    expect(prisma.dvPanicAlert.create.mock.calls[0][0].data).toMatchObject({ profileId: 'prof-1', notifiedContacts: ['Mum'] });
  });

  // The whole of this used to be `return { success: true, ... }`, sent even
  // when the loop above had reached nobody. The phone app drew "Your contacts
  // were told" over it. Nothing may say success when nothing was delivered.
  it('an alert that reached nobody is a failure, and says who to ring instead', async () => {
    (sendEmail as any).mockResolvedValue(false);
    prisma.dvSafetyProfile.upsert.mockResolvedValue(
      profile({
        emergencyContacts: [
          { id: 'a', name: 'Mum', phone: '0400 000 000', email: 'mum@example.com', relationship: 'Mother', notifyOnPanic: true },
          { id: 'b', name: 'Jo', phone: '0400 000 001', relationship: 'Friend', notifyOnPanic: true },
        ],
      })
    );

    const result = await dvSafe.triggerPanicButton('u1');

    expect(result.success).toBe(false);
    expect(result).toMatchObject({ outcome: 'NOBODY_REACHED', reachedCount: 0, unreachableCount: 2, notifiedContacts: [] });
    expect(result.message).toContain('Mum');
    expect(result.message).toContain('Jo');
    expect(result.message).toContain('000');
    // Still recorded: the alert that reached nobody is the one most worth
    // having on the record.
    expect(prisma.dvPanicAlert.create).toHaveBeenCalledTimes(1);
  });

  it('having nobody set to be told is its own outcome, not a success', async () => {
    prisma.dvSafetyProfile.upsert.mockResolvedValue(profile({ emergencyContacts: [] }));

    const result = await dvSafe.triggerPanicButton('u1');

    expect(result.success).toBe(false);
    expect(result).toMatchObject({ outcome: 'NO_CONTACTS', contactCount: 0, reachedCount: 0 });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  // The emergency-contact form on the phone asks for a name, a number and a
  // relationship, and never for an email. Without a text channel every
  // contact added there is permanently unreachable.
  it('reaches a contact who only ever gave a phone number, once SMS is configured', async () => {
    (isSmsConfigured as any).mockReturnValue(true);
    (sendSms as any).mockResolvedValue({ sent: true });
    prisma.dvSafetyProfile.upsert.mockResolvedValue(
      profile({
        emergencyContacts: [{ id: 'b', name: 'Jo', phone: '0400 000 001', relationship: 'Friend', notifyOnPanic: true }],
      })
    );

    const result = await dvSafe.triggerPanicButton('u1');

    expect(sendSms).toHaveBeenCalledTimes(1);
    expect((sendSms as any).mock.calls[0][0]).toBe('0400 000 001');
    expect((sendSms as any).mock.calls[0][1]).toContain('000');
    expect(result).toMatchObject({ success: true, outcome: 'ALERTED', reachedCount: 1, notifiedContacts: ['Jo'], smsAvailable: true });
  });

  it('does not claim a text channel this deployment has not got', async () => {
    prisma.dvSafetyProfile.upsert.mockResolvedValue(
      profile({
        emergencyContacts: [{ id: 'b', name: 'Jo', phone: '0400 000 001', relationship: 'Friend', notifyOnPanic: true }],
      })
    );

    const result = await dvSafe.triggerPanicButton('u1');

    expect(sendSms).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: false, outcome: 'NOBODY_REACHED', smsAvailable: false, unreachableContacts: ['Jo'] });
  });
});

describe('The built-in DV numbers', () => {
  it('carries the national lines so the support page can never be empty', () => {
    const numbers = dvSafe.BUILT_IN_DV_SERVICES.map((service) => service.phone);
    expect(numbers).toEqual(['000', '1800 737 732', '1800 811 811']);
    // Every one is marked as built in, so no page can present one as a local
    // service ATHENA staff have checked.
    expect(dvSafe.BUILT_IN_DV_SERVICES.every((service) => service.source === 'built-in')).toBe(true);
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
