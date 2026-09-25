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

jest.mock('../../utils/ops-metrics', () => ({
  recordFailure: jest.fn(),
}));

import { prisma } from '../../utils/prisma';
import { sendEmail } from '../../utils/email';
import { recordFailure } from '../../utils/ops-metrics';
import { submitContentReport } from '../content-report.service';

const prismaAny: any = prisma;
const sendEmailMock = sendEmail as jest.Mock;
const recordFailureMock = recordFailure as jest.Mock;

const report = (reason: 'csam' | 'terrorism' | 'spam') => ({
  contentType: 'post' as const,
  contentId: 'post-1',
  reason,
  description: 'Reported content',
});

describe('Authority referrals', () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    prismaAny.contentReport.create.mockResolvedValue({ id: 'report-1' });
    prismaAny.authorityEscalation.create.mockResolvedValue({ id: 'esc-1' });
    // Both alert paths used to fall back to a literal address at athena.com, a
    // domain this venture does not own. They now resolve to a mailbox ATHENA
    // controls or to nothing at all, so the tests have to say which.
    process.env.TRUST_SAFETY_EMAIL = 'trust-safety@athena.test';
  });

  afterEach(() => {
    process.env = { ...savedEnv };
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

  it('never sends the contents of a CSAM report to a domain ATHENA does not own', async () => {
    delete process.env.TRUST_SAFETY_EMAIL;
    delete process.env.AUTHORITY_ESCALATION_EMAIL;
    delete process.env.CONTACT_DOMAIN;
    delete process.env.NEXT_PUBLIC_CONTACT_DOMAIN;

    await submitContentReport(report('csam'));

    // The referral is still queued — the row is the work item, and losing it
    // would be the worse failure — but nothing is emailed anywhere, and the
    // missing alert is on the operations screen rather than in a warn line.
    expect(prisma.authorityEscalation.create).toHaveBeenCalled();
    const recipients = sendEmailMock.mock.calls.map((call: any[]) => call[0].to);
    expect(recipients.some((to: string) => String(to).includes('athena.com'))).toBe(false);
    expect(recipients).toHaveLength(0);
    expect(recordFailureMock).toHaveBeenCalledWith(
      'content-report.authority-referral',
      expect.any(Error)
    );
  });
});
