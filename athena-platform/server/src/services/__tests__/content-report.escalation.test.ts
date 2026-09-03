jest.mock('../../utils/prisma', () => ({
  prisma: {
    contentReport: {
      create: jest.fn(),
    },
    authorityEscalation: {
      create: jest.fn(),
    },
  },
}));

jest.mock('../../utils/email', () => ({
  sendEmail: jest.fn(async () => true),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { prisma } from '../../utils/prisma';
import { sendEmail } from '../../utils/email';
import { submitContentReport } from '../content-report.service';

const prismaAny: any = prisma;
const sendEmailMock = sendEmail as jest.Mock;

const report = (reason: 'csam' | 'terrorism' | 'spam') => ({
  contentType: 'post' as const,
  contentId: 'post-1',
  reason,
  description: 'Reported content',
});

describe('Authority referrals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaAny.contentReport.create.mockResolvedValue({ id: 'report-1' });
    prismaAny.authorityEscalation.create.mockResolvedValue({ id: 'esc-1' });
  });

  it('queues a CSAM report for referral to the IWF', async () => {
    await submitContentReport(report('csam'));

    expect(prisma.authorityEscalation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reportedTo: 'IWF', status: 'reported' }),
      })
    );
  });

  it('queues a terrorism report too, which previously fell through unreferred', async () => {
    await submitContentReport(report('terrorism'));

    expect(prisma.authorityEscalation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reportedTo: 'Counter Terrorism Internet Referral Unit',
          reason: 'terrorism',
        }),
      })
    );
  });

  it('alerts someone that a referral is waiting to be filed', async () => {
    await submitContentReport(report('csam'));

    const subjects = sendEmailMock.mock.calls.map((call: any[]) => call[0].subject);
    expect(subjects.some((subject: string) => subject.includes('AUTHORITY REFERRAL REQUIRED'))).toBe(
      true
    );
  });

  it('does not refer a report that is only a moderation matter', async () => {
    await submitContentReport(report('spam'));

    expect(prisma.authorityEscalation.create).not.toHaveBeenCalled();
  });
});
