import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    session: { count: jest.fn() },
    notification: { create: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}));

jest.mock('../../utils/email', () => ({
  sendEmail: jest.fn(async () => true),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { prisma as prismaTyped } from '../../utils/prisma';
import { sendEmail } from '../../utils/email';
import { describeDevice, isUnfamiliarDevice, noteSignIn } from '../login-alert.service';

const prisma: any = prismaTyped;
const CHROME_WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const SAFARI_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

const event = (overrides: Record<string, unknown> = {}) => ({
  userId: 'u1',
  sessionId: 's-new',
  userAgent: CHROME_WIN,
  ipAddress: '203.0.113.7',
  method: 'password' as const,
  ...overrides,
});

describe('describeDevice', () => {
  it('names the browser and platform a person would recognise', () => {
    expect(describeDevice(CHROME_WIN)).toBe('Chrome on Windows');
    expect(describeDevice(SAFARI_IOS)).toBe('Safari on iOS');
    expect(describeDevice('okhttp/4.9 Expo')).toBe('the ATHENA app');
    expect(describeDevice(undefined)).toBe('an unknown device');
  });
});

describe('isUnfamiliarDevice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('is undefined for the account’s very first session', async () => {
    prisma.session.count.mockResolvedValueOnce(0);
    await expect(isUnfamiliarDevice(event())).resolves.toBeUndefined();
    expect(prisma.session.count).toHaveBeenCalledTimes(1);
  });

  it('is false when an earlier session came from the same browser and address, and true otherwise', async () => {
    prisma.session.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    await expect(isUnfamiliarDevice(event())).resolves.toBe(false);

    prisma.session.count.mockResolvedValueOnce(3).mockResolvedValueOnce(0);
    await expect(isUnfamiliarDevice(event())).resolves.toBe(true);

    // The lookup excludes the session just created and matches both fields.
    const where = prisma.session.count.mock.calls[3][0].where;
    expect(where).toEqual({ userId: 'u1', id: { not: 's-new' }, userAgent: CHROME_WIN, ipAddress: '203.0.113.7' });
  });
});

describe('noteSignIn', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({ email: 'owner@athena.com', firstName: 'Sarah' });
    prisma.notification.create.mockResolvedValue({});
  });

  it('says nothing for a familiar device or a first sign-in', async () => {
    prisma.session.count.mockResolvedValueOnce(0);
    await noteSignIn(event());
    prisma.session.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
    await noteSignIn(event());
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('tells the owner in-app and by email about a new device, pointing at the security settings', async () => {
    prisma.session.count.mockResolvedValueOnce(2).mockResolvedValueOnce(0);

    await noteSignIn(event({ method: 'Google' }));

    const data = prisma.notification.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ userId: 'u1', type: 'SYSTEM', title: 'New sign-in to your account', link: '/dashboard/settings/security' });
    expect(data.message).toContain('with Google from Chrome on Windows (IP 203.0.113.7)');
    expect(data.data).toMatchObject({ kind: 'new-device-sign-in', sessionId: 's-new', method: 'Google' });

    const mail = (sendEmail as any).mock.calls[0][0];
    expect(mail.to).toBe('owner@athena.com');
    expect(mail.subject).toBe('New sign-in to your ATHENA account');
    expect(mail.text).toContain('Hi Sarah,');
    expect(mail.text).toContain('/dashboard/settings/security');
  });

  it('never lets a failure surface to the sign-in', async () => {
    prisma.session.count.mockRejectedValue(new Error('db away'));
    await expect(noteSignIn(event())).resolves.toBeUndefined();
  });
});
