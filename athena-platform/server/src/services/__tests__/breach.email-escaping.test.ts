/**
 * The breach emails: what staff wrote, and the names of the people told, are text.
 *
 * Three emails here are built from words somebody typed: the alert to the
 * incident team (the breach's title and description, which come from a report
 * form), the notice to a regulator (the notification content an administrator
 * wrote) and the notice to each affected member (her first name and the same
 * content). They went into the markup as they came, so a breach titled with an
 * angle bracket broke the layout of the one email the team reads first, and a
 * first name that is a link was a link in a message from the security team.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    dataBreach: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'breach-1', ...data })),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'breach-1', ...data })),
      findUnique: jest.fn(async () => null),
    },
    privacyAuditLog: { create: jest.fn(async () => ({})), findFirst: jest.fn(async () => null) },
    user: { findMany: jest.fn(async () => []) },
    contentReport: { findMany: jest.fn(async () => []) },
    safetyIncident: { findMany: jest.fn(async () => []) },
  },
}));
jest.mock('../email.service', () => ({ sendEmail: jest.fn(async () => true) }));
jest.mock('../socket.service', () => ({ sendNotification: jest.fn(async () => ({})) }));

import { prisma } from '../../utils/prisma';
import { sendEmail } from '../email.service';
import { breachNotificationService } from '../breach.service';

const prismaAny: any = prisma;
const sendEmailMock = sendEmail as unknown as jest.Mock;

const LINK = '<a href="https://evil.example/login">Sign in again</a>';
const IMG = '<img src=x onerror=alert(1)>';

const ukRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'breach-1',
  title: `Bucket ${IMG} left public`,
  description: `First line.\n${LINK}`,
  detectedAt: new Date('2026-09-17T00:00:00.000Z'),
  severity: 'HIGH',
  status: 'DETECTED',
  jurisdictions: ['UK'],
  jurisdiction: 'UK',
  statementRecommendedSteps: null,
  ...overrides,
});

/** No tag the hostile text could have opened. */
const expectNoInjectedMarkup = (html: string) => {
  expect(html).not.toContain('<a href="https://evil.example');
  expect(html).not.toMatch(/<img\b/i);
  expect(html).not.toMatch(/<script\b/i);
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.INCIDENT_TEAM_EMAILS = 'team@example.org';
  process.env.CLIENT_URL = 'https://app.example.org';
});

afterAll(() => {
  delete process.env.INCIDENT_TEAM_EMAILS;
});

describe('the alert to the incident team', () => {
  it('shows the title and description of the report as text', async () => {
    await breachNotificationService.reportBreach({
      title: `Bucket ${IMG} left public`,
      description: `First line.\n${LINK}<script>alert(1)</script>`,
      detectedBy: 'admin-1',
      severity: 'HIGH' as any,
      dataCategories: ['PII'],
      jurisdictions: ['UK'],
    } as any);

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const html: string = sendEmailMock.mock.calls[0][0].html;
    expectNoInjectedMarkup(html);
    expect(html).toContain('Bucket &lt;img src=x onerror=alert(1)&gt; left public');
    // A line break the reporter typed is kept.
    expect(html).toContain('First line.<br>&lt;a href=&quot;https://evil.example/login&quot;&gt;');
  });
});

describe('the notice to a regulator', () => {
  it('shows the breach title and the notification content as text, paragraph by paragraph', async () => {
    prismaAny.dataBreach.findUnique.mockResolvedValue(ukRow());

    await breachNotificationService.notifyRegulator({
      breachId: 'breach-1',
      regulatorName: 'ICO',
      regulatorEmail: 'regulator@example.org',
      jurisdiction: 'UK',
      notificationContent: `What happened: ${LINK}\n\nSecond paragraph & more.`,
    } as any);

    const html: string = sendEmailMock.mock.calls[0][0].html;
    expectNoInjectedMarkup(html);
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('<p>What happened: &lt;a href=&quot;https://evil.example/login&quot;&gt;Sign in again&lt;/a&gt;</p><p>Second paragraph &amp; more.</p>');
  });
});

describe('the notice to each affected member', () => {
  it('greets her by the name she typed, as text, and shows the content as text', async () => {
    prismaAny.dataBreach.findUnique.mockResolvedValue(ukRow({ jurisdictions: ['UK'], jurisdiction: 'UK' }));
    prismaAny.user.findMany.mockResolvedValue([
      { id: 'user-1', email: 'her@example.org', firstName: LINK, dvSafetyProfile: null },
    ]);

    await breachNotificationService.notifyAffectedUsers('breach-1', ['user-1'], `Some details were readable. ${IMG}`);

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const html: string = sendEmailMock.mock.calls[0][0].html;
    expectNoInjectedMarkup(html);
    expect(html).toContain('Dear &lt;a href=&quot;https://evil.example/login&quot;&gt;Sign in again&lt;/a&gt;,');
    expect(html).toContain('<p>Some details were readable. &lt;img src=x onerror=alert(1)&gt;</p>');
    // Its own link to the security settings is still a link.
    expect(html).toContain('<a href="https://app.example.org/dashboard/settings/security">security settings</a>');
  });
});
