/**
 * Authority referrals, through the intake both report doors actually run.
 *
 * These tests used to drive submitContentReport, a legacy ticket path with no
 * production caller that wrote placeholder strings into required foreign keys.
 * The referral they described was real, but the code they exercised was not
 * the code that referred anything, so they are now written against
 * runReportIntakeConsequences, which the report routes call.
 */
jest.mock('../../utils/prisma', () => ({
  prisma: {
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
import {
  expectedResponseFor,
  openReportIntake,
  reportPriorityFor,
  reviewHoursFor,
  runReportIntakeConsequences,
} from '../content-report.service';

const prismaAny: any = prisma;
const sendEmailMock = sendEmail as jest.Mock;
const recordFailureMock = recordFailure as jest.Mock;

const report = (reason: string, overrides: Record<string, unknown> = {}) => {
  const intake = openReportIntake({ reason });
  return {
    ticketId: intake.ticketId,
    reason,
    priority: intake.priority,
    reviewHours: intake.reviewHours,
    contentType: 'POST',
    contentId: 'post-1',
    description: 'Reported content',
    ...overrides,
  };
};

const submitContentReport = (input: ReturnType<typeof report>) => runReportIntakeConsequences(input);

describe('Authority referrals', () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
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

describe('One review clock, quoted the same way everywhere', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TRUST_SAFETY_EMAIL = 'trust-safety@athena.test';
  });

  it('puts illegal content, CSAM and terrorism on the 24-hour clock', () => {
    // "Illegal content" is priority high, and the deadline used to follow the
    // priority, so it was stamped with 48 hours under a screen promising 24.
    expect(reportPriorityFor('illegal')).toBe('high');
    expect(reviewHoursFor('illegal')).toBe(24);
    expect(reviewHoursFor('CSAM')).toBe(24);
    expect(reviewHoursFor('terrorism')).toBe(24);
  });

  it('puts anything marked urgent on the 24-hour clock, and the rest on 48', () => {
    expect(reviewHoursFor('harassment', true)).toBe(24);
    expect(reviewHoursFor('harassment')).toBe(48);
    expect(reviewHoursFor('spam')).toBe(48);
  });

  it('stamps the deadline from the same clock', () => {
    const now = new Date('2026-09-26T00:00:00.000Z');
    const intake = openReportIntake({ reason: 'ILLEGAL', now });
    expect(intake.reviewHours).toBe(24);
    expect(intake.reviewDeadline.toISOString()).toBe('2026-09-27T00:00:00.000Z');
    expect(intake.ticketId).toMatch(/^RPT-[0-9A-Z]+-[0-9A-F]{8}$/);
  });

  it('acknowledges with the clock that was stamped, never a one-hour or 72-hour promise', async () => {
    await runReportIntakeConsequences(report('csam', { contactEmail: 'reporter@example.org' }));

    const acknowledgment = sendEmailMock.mock.calls
      .map((call: any[]) => call[0])
      .find((mail: any) => mail.to === 'reporter@example.org');
    expect(acknowledgment.html).toContain(expectedResponseFor(24));
    expect(acknowledgment.html).not.toContain('1 hour');

    sendEmailMock.mockClear();
    await runReportIntakeConsequences(report('spam', { contactEmail: 'reporter@example.org' }));
    const spamAck = sendEmailMock.mock.calls.map((call: any[]) => call[0]).find((mail: any) => mail.to === 'reporter@example.org');
    expect(spamAck.html).toContain('within 48 hours');
    expect(spamAck.html).not.toContain('72 hours');
  });

  it('gives the in-app dialog reasons the priority their words deserve', () => {
    // The dialog says hate, violence, sexual and impersonation; only the public
    // form's vocabulary used to be mapped, so every one of these was medium and
    // "Violence or threats" raised no alert at all.
    expect(reportPriorityFor('violence')).toBe('high');
    expect(reportPriorityFor('hate')).toBe('high');
    expect(reportPriorityFor('sexual')).toBe('high');
    expect(reportPriorityFor('impersonation')).toBe('high');
    expect(reportPriorityFor('self_harm')).toBe('critical');
  });

  it('alerts Trust & Safety for a high-priority report from the in-app vocabulary', async () => {
    await runReportIntakeConsequences(report('violence'));

    const subjects = sendEmailMock.mock.calls.map((call: any[]) => call[0].subject);
    expect(subjects.some((subject: string) => subject.startsWith('[HIGH]'))).toBe(true);
  });
});
