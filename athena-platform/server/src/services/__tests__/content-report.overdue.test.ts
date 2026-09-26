/**
 * The overdue sweep: telling Trust & Safety when reports pass the deadline the
 * reporter was given, whether or not anyone has the queue open.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    contentReport: { findMany: jest.fn() },
    safetyIncident: { findMany: jest.fn() },
  },
}));

jest.mock('../../utils/email', () => ({ sendEmail: jest.fn(async () => true) }));
jest.mock('../../utils/ops-metrics', () => ({ recordFailure: jest.fn() }));
jest.mock('../admin-notify.service', () => ({ notifyAdmins: jest.fn(async () => 1) }));
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { prisma as prismaTyped } from '../../utils/prisma';
import { sendEmail } from '../../utils/email';
import { recordFailure } from '../../utils/ops-metrics';
import { notifyAdmins } from '../admin-notify.service';
import { alertOverdueReports } from '../content-report.service';

const prisma: any = prismaTyped;
const HOUR = 60 * 60 * 1000;
const NOW = new Date('2026-09-26T12:00:00.000Z');
const ago = (hours: number) => new Date(NOW.getTime() - hours * HOUR);

describe('alertOverdueReports', () => {
  const saved = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...saved, TRUST_SAFETY_EMAIL: 'trust-safety@athena.test' };
    prisma.contentReport.findMany.mockResolvedValue([]);
    prisma.safetyIncident.findMany.mockResolvedValue([]);
  });

  it('stays quiet when everything is inside its deadline', async () => {
    prisma.contentReport.findMany.mockResolvedValue([{ id: 'r1', createdAt: ago(10), reason: 'HARASSMENT', evidence: null }]);

    await expect(alertOverdueReports(NOW)).resolves.toEqual({ overdue: 0, alerted: false });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(notifyAdmins).not.toHaveBeenCalled();
  });

  it('counts both doors against their own clocks and sends one alert naming the oldest', async () => {
    prisma.contentReport.findMany.mockResolvedValue([
      // Illegal content, 30 hours old: past its 24-hour clock.
      { id: 'r1', createdAt: ago(30), reason: 'ILLEGAL', evidence: { ticketId: 'RPT-ILLEGAL' } },
      // Harassment, 30 hours old: inside its 48.
      { id: 'r2', createdAt: ago(30), reason: 'HARASSMENT', evidence: null },
    ]);
    prisma.safetyIncident.findMany.mockResolvedValue([
      {
        id: 'inc-1',
        createdAt: ago(60),
        reason: 'SPAM',
        metadata: { anonymous: true, ticketId: 'RPT-ANON' },
        resolvedAt: null,
      },
    ]);

    const result = await alertOverdueReports(NOW);

    expect(result).toEqual({ overdue: 2, alerted: true });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const mail = (sendEmail as jest.Mock).mock.calls[0][0] as any;
    expect(mail.to).toBe('trust-safety@athena.test');
    expect(mail.subject).toContain('2 reports');
    expect(mail.html).toContain('RPT-ANON');
    expect(mail.html).toContain('RPT-ILLEGAL');
    // Oldest deadline first: the anonymous spam report was due 12 hours ago,
    // the illegal-content one 6 hours ago.
    expect(mail.html.indexOf('RPT-ANON')).toBeLessThan(mail.html.indexOf('RPT-ILLEGAL'));
    expect(notifyAdmins).toHaveBeenCalledWith(expect.objectContaining({ link: '/admin/moderation' }));
  });

  it('never sends the alert off-domain, and puts the missing mailbox on the ops screen', async () => {
    delete process.env.TRUST_SAFETY_EMAIL;
    delete process.env.CONTACT_DOMAIN;
    delete process.env.NEXT_PUBLIC_CONTACT_DOMAIN;
    prisma.contentReport.findMany.mockResolvedValue([{ id: 'r1', createdAt: ago(100), reason: 'SPAM', evidence: null }]);

    const result = await alertOverdueReports(NOW);

    expect(result).toEqual({ overdue: 1, alerted: false });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(recordFailure).toHaveBeenCalledWith('content-report.overdue-reports', expect.any(Error));
    // The admins still hear about it in the app.
    expect(notifyAdmins).toHaveBeenCalled();
  });
});
