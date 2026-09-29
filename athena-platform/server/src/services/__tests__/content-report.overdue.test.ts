/**
 * The overdue sweep: telling Trust & Safety when reports pass the deadline the
 * reporter was given, whether or not anyone has the queue open.
 *
 * The deadline is a column now. The sweep used to read up to two thousand open
 * reports and work each one's deadline out of its evidence JSON; it now asks
 * the database which open reports are past reviewDeadline, and gives any report
 * another door filed without a deadline its one first.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    contentReport: { findMany: jest.fn(), count: jest.fn(), update: jest.fn() },
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

/** What each of the sweep's reads returns, told apart by what it asks for. */
let unstampedForStamping: any[] = [];
let lateByColumn: any[] = [];
let lateCount = 0;

describe('alertOverdueReports', () => {
  const saved = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...saved, TRUST_SAFETY_EMAIL: 'trust-safety@athena.test' };
    unstampedForStamping = [];
    lateByColumn = [];
    lateCount = 0;
    prisma.contentReport.findMany.mockImplementation(async (args: any) => {
      if (args.where?.OR) return unstampedForStamping;
      if (args.where?.reviewDeadline?.lt) return lateByColumn;
      return [];
    });
    prisma.contentReport.count.mockImplementation(async () => lateCount);
    prisma.contentReport.update.mockResolvedValue({});
    prisma.safetyIncident.findMany.mockResolvedValue([]);
  });

  it('stays quiet when nothing is past its deadline', async () => {
    await expect(alertOverdueReports(NOW)).resolves.toEqual({ overdue: 0, alerted: false });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(notifyAdmins).not.toHaveBeenCalled();
  });

  it('asks the database for open reports past the deadline column', async () => {
    await alertOverdueReports(NOW);

    const late = prisma.contentReport.findMany.mock.calls.find(([args]: any[]) => args.where?.reviewDeadline?.lt)[0];
    expect(late.where).toEqual({ status: { in: ['PENDING', 'REVIEWING'] }, reviewDeadline: { lt: NOW } });
    expect(late.orderBy).toEqual({ reviewDeadline: 'asc' });
  });

  it('counts both doors against their own clocks and sends one alert naming the oldest', async () => {
    // Illegal content filed 30 hours ago on the 24-hour clock: due 6 hours ago.
    lateByColumn = [{ id: 'r1', createdAt: ago(30), reason: 'ILLEGAL', reviewDeadline: ago(6), evidence: { ticketId: 'RPT-ILLEGAL' } }];
    lateCount = 1;
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
    // Oldest deadline first: the anonymous spam report was due 12 hours ago,
    // the illegal-content one 6 hours ago.
    expect(mail.html.indexOf('RPT-ANON')).toBeLessThan(mail.html.indexOf('RPT-ILLEGAL'));
    expect(notifyAdmins).toHaveBeenCalledWith(expect.objectContaining({ link: '/admin/moderation' }));
  });

  it('counts every overdue report even when only the oldest are read', async () => {
    lateByColumn = [{ id: 'r1', createdAt: ago(200), reason: 'SPAM', reviewDeadline: ago(152), evidence: null }];
    lateCount = 2500;

    const result = await alertOverdueReports(NOW);

    expect(result.overdue).toBe(2500);
    expect(((sendEmail as jest.Mock).mock.calls[0][0] as any).subject).toContain('2500 reports');
  });

  it('gives a report filed without a deadline the one its reason runs on before sweeping', async () => {
    unstampedForStamping = [
      { id: 'dialog', createdAt: ago(60), reason: 'HARASSMENT', reviewDeadline: null, priority: null, evidence: null },
    ];

    await alertOverdueReports(NOW);

    expect(prisma.contentReport.update).toHaveBeenCalledWith({
      where: { id: 'dialog' },
      data: { reviewDeadline: new Date(ago(60).getTime() + 48 * HOUR), priority: 'NORMAL' },
    });
  });

  it('never sends the alert off-domain, and puts the missing mailbox on the ops screen', async () => {
    delete process.env.TRUST_SAFETY_EMAIL;
    delete process.env.CONTACT_DOMAIN;
    delete process.env.NEXT_PUBLIC_CONTACT_DOMAIN;
    lateByColumn = [{ id: 'r1', createdAt: ago(100), reason: 'SPAM', reviewDeadline: ago(52), evidence: null }];
    lateCount = 1;

    const result = await alertOverdueReports(NOW);

    expect(result).toEqual({ overdue: 1, alerted: false });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(recordFailure).toHaveBeenCalledWith('content-report.overdue-reports', expect.any(Error));
    // The admins still hear about it in the app.
    expect(notifyAdmins).toHaveBeenCalled();
  });
});
