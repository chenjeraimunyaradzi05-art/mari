import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    dvSafetyProfile: { findUnique: jest.fn() },
    profile: { findUnique: jest.fn() },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// The channels this test is not about.
jest.mock('../socket.service', () => ({ sendNotification: jest.fn(async () => undefined) }));
jest.mock('../push.service', () => ({ pushToUser: jest.fn(async () => ({})) }));
jest.mock('../email.service', () => ({
  sendEmail: jest.fn(async () => true),
  escapeHtml: (value: string) => value,
}));

import { prisma as prismaTyped } from '../../utils/prisma';
import { sendEmail } from '../email.service';
import { VAGUE_EMAIL, notificationService } from '../notification.service';

const prisma: any = prismaTyped;
const sendEmailMock = sendEmail as unknown as jest.Mock<(...args: any[]) => Promise<boolean>>;

const real = {
  userId: 'u1',
  type: 'MESSAGE' as const,
  title: 'Message from Rachel',
  message: 'Are you safe tonight? He is home.',
  link: '/dashboard/messages?user=rachel',
  channels: ['email' as const],
  emailTemplate: { subject: 'Rachel wrote to you', html: '<p>Rachel: are you safe tonight?</p>' },
};

describe('notifications by email for a member who asked for vague ones', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CLIENT_URL = 'https://app.example.test';
    prisma.user.findUnique.mockResolvedValue({
      email: 'her@example.com',
      firstName: 'Sam',
      notificationPreferences: null,
      preferredLocale: 'en',
      region: 'AU',
    });
    prisma.dvSafetyProfile.findUnique.mockResolvedValue(null);
    prisma.profile.findUnique.mockResolvedValue({ isSafeMode: false });
  });

  it('sends the original subject, text and link to a member who has not asked for anything', async () => {
    await notificationService.notify(real);

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const sent = sendEmailMock.mock.calls[0][0];
    expect(sent.to).toBe('her@example.com');
    expect(sent.subject).toBe('Rachel wrote to you');
    expect(sent.html).toContain('Rachel: are you safe tonight?');
    expect(sent.text).toBe('Are you safe tonight? He is home.');
  });

  it('sends nothing of the original to a member with the switch on: not the subject, the text, the template or the link', async () => {
    prisma.dvSafetyProfile.findUnique.mockResolvedValue({ notificationsSafe: true, isSafeMode: false });

    await notificationService.notify(real);

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const sent = sendEmailMock.mock.calls[0][0];
    expect(sent.subject).toBe(VAGUE_EMAIL.subject);
    expect(sent.text).toBe(VAGUE_EMAIL.message);
    const everything = JSON.stringify(sent);
    for (const leaked of ['Rachel', 'safe tonight', 'He is home', 'messages?user']) {
      expect(everything).not.toContain(leaked);
    }
    // The button goes to the notification list, which names nothing.
    expect(sent.html).toContain('https://app.example.test/dashboard/notifications');
  });

  it('treats Safe Mode from the Safety Centre as the same request', async () => {
    prisma.profile.findUnique.mockResolvedValue({ isSafeMode: true });

    await notificationService.notify(real);

    expect(sendEmailMock.mock.calls[0][0].subject).toBe(VAGUE_EMAIL.subject);
  });

  it('treats Safe Mode from the DV page as the same request even if its switch row says off', async () => {
    prisma.dvSafetyProfile.findUnique.mockResolvedValue({ notificationsSafe: false, isSafeMode: true });

    await notificationService.notify(real);

    expect(sendEmailMock.mock.calls[0][0].subject).toBe(VAGUE_EMAIL.subject);
  });

  it('reads as vague when the setting cannot be looked up, never as the real words', async () => {
    prisma.dvSafetyProfile.findUnique.mockRejectedValue(new Error('connection lost'));

    await notificationService.notify(real);

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock.mock.calls[0][0].subject).toBe(VAGUE_EMAIL.subject);
    expect(JSON.stringify(sendEmailMock.mock.calls[0][0])).not.toContain('Rachel');
  });

  it('still honours a member who switched email off: vague is not a way to send her more mail', async () => {
    prisma.dvSafetyProfile.findUnique.mockResolvedValue({ notificationsSafe: true, isSafeMode: false });
    prisma.user.findUnique.mockResolvedValue({
      email: 'her@example.com',
      firstName: 'Sam',
      notificationPreferences: { email: { messages: false } },
      preferredLocale: 'en',
      region: 'AU',
    });

    await notificationService.notify(real);

    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
