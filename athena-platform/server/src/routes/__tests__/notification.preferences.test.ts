import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    consentRecord: {
      findUnique: jest.fn(),
    },
    notification: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-123', role: 'USER', email: 'user@athena.com' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    next();
  },
  requireRole: (_role: string) => (_req: any, _res: any, next: any) => {
    next();
  },
  requirePremium: (_req: any, _res: any, next: any) => {
    next();
  },
}));

jest.mock('../../services/gdpr.service', () => ({
  gdprService: { recordConsent: jest.fn(async () => ({ id: 'consent-1' })) },
}));

jest.mock('../../services/consent.service', () => ({
  consentService: { getRestrictedConsentTypes: jest.fn(async () => new Set()) },
}));

import { app } from '../../index';
import { prisma } from '../../utils/prisma';
import { gdprService } from '../../services/gdpr.service';
import { consentService } from '../../services/consent.service';

describe('Notification preferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.consentRecord.findUnique as any).mockResolvedValue(null);
    (consentService.getRestrictedConsentTypes as any).mockResolvedValue(new Set());
  });

  it('GET /api/notifications/preferences returns defaults when unset, with marketing off', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ notificationPreferences: null });

    const res = await request(app).get('/api/notifications/preferences').expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        // Marketing is opt-in: with no consent on record the newsletter is off.
        email: expect.objectContaining({ jobMatches: true, newsletter: false }),
        push: expect.objectContaining({ messages: true }),
        inApp: expect.objectContaining({ all: true }),
      }),
    );
  });

  it('PATCH /api/notifications/preferences persists merged preferences', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      notificationPreferences: {
        email: { newsletter: false },
      },
    });

    (prisma.user.update as any).mockResolvedValue({ id: 'user-123' });

    const res = await request(app)
      .patch('/api/notifications/preferences')
      .send({ preferences: { push: { messages: false } } })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.email.newsletter).toBe(false);
    expect(res.body.data.push.messages).toBe(false);

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-123' },
        data: expect.objectContaining({
          notificationPreferences: expect.objectContaining({
            email: expect.objectContaining({ newsletter: false }),
            push: expect.objectContaining({ messages: false }),
          }),
        }),
      }),
    );
  });

  it('PATCH /api/notifications/preferences returns 400 on invalid payload', async () => {
    const res = await request(app)
      .patch('/api/notifications/preferences')
      .send({ preferences: { push: { messages: 'nope' } } })
      .expect(400);

    expect(res.body.success).toBe(false);
  });
  describe('the newsletter switch and the marketing-email consent', () => {
    it('reads the ledger, not a stored yes that the old default wrote', async () => {
      (prisma.user.findUnique as any).mockResolvedValue({ notificationPreferences: { email: { newsletter: true } } });

      const res = await request(app).get('/api/notifications/preferences').expect(200);

      expect(res.body.data.email.newsletter).toBe(false);
    });

    it('shows yes when the ledger holds her consent', async () => {
      (prisma.user.findUnique as any).mockResolvedValue({ notificationPreferences: null });
      (prisma.consentRecord.findUnique as any).mockResolvedValue({ status: 'GRANTED' });

      const res = await request(app).get('/api/notifications/preferences').expect(200);

      expect(res.body.data.email.newsletter).toBe(true);
    });

    it('turning it on records the consent before the switch is saved', async () => {
      (prisma.user.findUnique as any).mockResolvedValue({ notificationPreferences: null });
      (prisma.user.update as any).mockResolvedValue({ id: 'user-123' });

      const res = await request(app)
        .patch('/api/notifications/preferences')
        .send({ preferences: { email: { newsletter: true } } })
        .expect(200);

      expect(gdprService.recordConsent).toHaveBeenCalledWith('user-123', 'MARKETING_EMAIL', true, expect.any(Object));
      expect(res.body.data.email.newsletter).toBe(true);
      const recordOrder = (gdprService.recordConsent as any).mock.invocationCallOrder[0];
      const saveOrder = (prisma.user.update as any).mock.invocationCallOrder[0];
      expect(recordOrder).toBeLessThan(saveOrder);
    });

    it('turning it off withdraws the consent', async () => {
      (prisma.user.findUnique as any).mockResolvedValue({ notificationPreferences: { email: { newsletter: true } } });
      (prisma.consentRecord.findUnique as any).mockResolvedValue({ status: 'GRANTED' });
      (prisma.user.update as any).mockResolvedValue({ id: 'user-123' });

      await request(app)
        .patch('/api/notifications/preferences')
        .send({ preferences: { email: { newsletter: false } } })
        .expect(200);

      expect(gdprService.recordConsent).toHaveBeenCalledWith('user-123', 'MARKETING_EMAIL', false, expect.any(Object));
    });

    it('re-sending the answer the ledger already holds records nothing', async () => {
      (prisma.user.findUnique as any).mockResolvedValue({ notificationPreferences: null });
      (prisma.user.update as any).mockResolvedValue({ id: 'user-123' });

      await request(app)
        .patch('/api/notifications/preferences')
        .send({ preferences: { email: { newsletter: false, messages: false } } })
        .expect(200);

      expect(gdprService.recordConsent).not.toHaveBeenCalled();
    });

    it('cannot be turned on while marketing is restricted under Article 18', async () => {
      (prisma.user.findUnique as any).mockResolvedValue({ notificationPreferences: null });
      (consentService.getRestrictedConsentTypes as any).mockResolvedValue(new Set(['MARKETING_EMAIL']));

      const res = await request(app)
        .patch('/api/notifications/preferences')
        .send({ preferences: { email: { newsletter: true } } })
        .expect(409);

      expect(res.body.message).toMatch(/Article 18/);
      expect(gdprService.recordConsent).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
