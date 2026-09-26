/**
 * The record of consent, which is what APP 7 and the Spam Act make ATHENA
 * accountable for and which had no test file at all.
 *
 * Two things are checked here. hasConsent is the single reader every processing
 * path goes through, so an expired record and an Article 18 restriction both
 * have to stop it there rather than at each call site. And countLiveConsents is
 * the figure the admin compliance screen now reads: that screen used to count
 * four legacy boolean columns on User, which the Privacy Centre does not write,
 * so a member could withdraw consent and leave the privacy officer's number
 * untouched.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    consentRecord: { findUnique: jest.fn(), groupBy: jest.fn(), updateMany: jest.fn() },
    dSARRequest: { findMany: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn() },
    privacyAuditLog: { create: jest.fn() },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { ConsentStatus, ConsentType } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { consentService } from '../consent.service';

const prismaAny: any = prisma;

const HOUR = 60 * 60 * 1000;

describe('The record of consent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaAny.dSARRequest.findMany.mockResolvedValue([]);
  });

  it('treats a granted, unexpired record as consent', async () => {
    prismaAny.consentRecord.findUnique.mockResolvedValue({
      status: ConsentStatus.GRANTED,
      expiresAt: new Date(Date.now() + HOUR),
    });

    await expect(consentService.hasConsent('member-1', ConsentType.MARKETING_EMAIL)).resolves.toBe(true);
  });

  it('does not treat a consent that has run out as consent', async () => {
    prismaAny.consentRecord.findUnique.mockResolvedValue({
      status: ConsentStatus.GRANTED,
      expiresAt: new Date(Date.now() - HOUR),
    });

    await expect(consentService.hasConsent('member-1', ConsentType.MARKETING_EMAIL)).resolves.toBe(false);
  });

  it('does not treat a withdrawn consent as consent', async () => {
    prismaAny.consentRecord.findUnique.mockResolvedValue({
      status: ConsentStatus.WITHDRAWN,
      expiresAt: null,
    });

    await expect(consentService.hasConsent('member-1', ConsentType.MARKETING_EMAIL)).resolves.toBe(false);
  });

  it('honours an Article 18 restriction over a consent the member has not withdrawn', async () => {
    prismaAny.consentRecord.findUnique.mockResolvedValue({
      status: ConsentStatus.GRANTED,
      expiresAt: null,
    });
    prismaAny.dSARRequest.findMany.mockResolvedValue([
      { requestDetails: JSON.stringify({ processingTypes: ['MARKETING'] }) },
    ]);

    await expect(consentService.hasConsent('member-1', ConsentType.MARKETING_EMAIL)).resolves.toBe(false);
  });

  describe('countLiveConsents', () => {
    it('reports every consent type, including the ones nobody holds', async () => {
      prismaAny.consentRecord.groupBy.mockResolvedValue([
        { consentType: ConsentType.MARKETING_EMAIL, _count: { _all: 42 } },
      ]);

      const counts = await consentService.countLiveConsents();

      expect(counts[ConsentType.MARKETING_EMAIL]).toBe(42);
      // A type with no rows is a zero, not a missing key: a gap in the object
      // would read on the compliance screen as "no data" rather than "nobody".
      expect(counts[ConsentType.THIRD_PARTY_SHARING]).toBe(0);
      expect(Object.keys(counts)).toHaveLength(Object.values(ConsentType).length);
    });

    it('counts only records that are granted and not expired', async () => {
      prismaAny.consentRecord.groupBy.mockResolvedValue([]);

      await consentService.countLiveConsents();

      const where = prismaAny.consentRecord.groupBy.mock.calls[0][0].where;
      expect(where.status).toBe(ConsentStatus.GRANTED);
      expect(where.OR).toEqual([{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }]);
    });
  });

  // The Privacy Centre writes the ledger; every sender reads the newsletter
  // switch in notification settings, which defaults on. A withdrawal in the
  // one used to leave the other saying yes.
  describe('syncMarketingEmailPreference', () => {
    it('turns the newsletter switch off when marketing consent is withdrawn, keeping her other settings', async () => {
      prismaAny.user.findUnique.mockResolvedValue({
        notificationPreferences: { email: { newsletter: true, messages: false }, push: { messages: true } },
      });

      await consentService.syncMarketingEmailPreference('member-1', false);

      expect(prismaAny.user.update).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        data: {
          notificationPreferences: { email: { newsletter: false, messages: false }, push: { messages: true } },
        },
      });
    });

    it('writes nothing when the switch already agrees', async () => {
      prismaAny.user.findUnique.mockResolvedValue({ notificationPreferences: { email: { newsletter: false } } });

      await consentService.syncMarketingEmailPreference('member-1', false);

      expect(prismaAny.user.update).not.toHaveBeenCalled();
    });

    it('treats a member with no saved settings as opted in by default, and turns that off', async () => {
      prismaAny.user.findUnique.mockResolvedValue({ notificationPreferences: null });

      await consentService.syncMarketingEmailPreference('member-1', false);

      expect(prismaAny.user.update.mock.calls[0][0].data.notificationPreferences).toEqual({ email: { newsletter: false } });
    });

    it('turns the switch off first when every optional consent is withdrawn', async () => {
      prismaAny.user.findUnique.mockResolvedValue({ notificationPreferences: { email: { newsletter: true } } });
      const order: string[] = [];
      prismaAny.user.update.mockImplementation(async () => order.push('switch'));
      prismaAny.consentRecord.updateMany.mockImplementation(async () => order.push('ledger'));
      prismaAny.privacyAuditLog.create.mockResolvedValue({});

      await consentService.withdrawAllOptionalConsents('member-1', {});

      expect(order).toEqual(['switch', 'ledger']);
    });
  });
});
