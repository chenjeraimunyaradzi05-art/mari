/**
 * Outbound HTML email: what a member typed is text, never markup.
 *
 * ATHENA sends mail from its own address, so a first name that is
 * `<a href="https://elsewhere">` and arrives as a live link is a phishing mail
 * the recipient's filter has learnt to trust. Names are only stripped of control
 * characters at sign-up, so angle brackets are a legal name. Each template below
 * is rendered with hostile text in every field it has and the markup is checked
 * for what survived.
 *
 * The plain-text part is the other half of the rule: it is read as text, so it
 * keeps the name exactly as typed and must not show the reader `&lt;`.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  // The two others are read for "keep notifications vague" (no row, Safe Mode off:
  // the member has asked for nothing, so her mail goes out as written).
  prisma: {
    user: { findUnique: jest.fn() },
    dvSafetyProfile: { findUnique: jest.fn(async () => null) },
    profile: { findUnique: jest.fn(async () => null) },
  },
}));
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../socket.service', () => ({ sendNotification: jest.fn(async () => undefined) }));
jest.mock('../push.service', () => ({ pushToUser: jest.fn(async () => undefined) }));
// The sender at the bottom of every template. email.service re-exports it, so
// the notification dispatcher and the templates reach the same stand-in.
jest.mock('../../utils/email', () => ({ sendEmail: jest.fn(async () => true) }));

import { prisma } from '../../utils/prisma';
import { sendEmail } from '../../utils/email';
import emailService, { emailTemplates, forHtml, escapeHtml } from '../email.service';
import { fallbackEmailHtml, notificationService } from '../notification.service';

const prismaAny: any = prisma;
const sendEmailMock = sendEmail as unknown as jest.Mock<(message: any) => Promise<boolean>>;

const LINK = '<a href="https://evil.example/login">Sign in again</a>';
const IMG = '<img src=x onerror=alert(1)>';
const SCRIPT = '<script>alert(2)</script>';

/** The one message the last call handed to the sender. */
const sent = () => {
  expect(sendEmailMock).toHaveBeenCalledTimes(1);
  return sendEmailMock.mock.calls[0][0] as { to: string; subject: string; html: string; text?: string };
};

/**
 * The tags in some markup and the attributes on each, read the way a browser
 * reads them: a quoted value runs to its closing quote, so words that happen to
 * sit inside one (an escaped `onerror=` in an address, say) are not attributes.
 */
function tagsIn(html: string): Array<{ name: string; attributes: Array<{ name: string; value: string }> }> {
  const tags: Array<{ name: string; attributes: Array<{ name: string; value: string }> }> = [];
  const tag = /<([a-z][a-z0-9]*)((?:\s+[^\s=>"'/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>"']+))?)*)\s*\/?>/gi;
  const attribute = /([^\s=>"'/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+)))?/g;
  for (const match of html.matchAll(tag)) {
    const attributes = Array.from(match[2].matchAll(attribute)).map((a) => ({ name: a[1].toLowerCase(), value: a[2] ?? a[3] ?? a[4] ?? '' }));
    tags.push({ name: match[1].toLowerCase(), attributes });
  }
  return tags;
}

/**
 * Nothing in the markup is an element or an attribute the hostile text could
 * have opened. The words `onerror=` may well appear, as visible text or inside
 * a quoted address, between escaped brackets; what must not appear is a tag that
 * is not one of the template's own, or a handler on any tag.
 */
const expectNoInjectedMarkup = (html: string) => {
  expect(html).not.toContain('<a href="https://evil.example');
  const tags = tagsIn(html);
  expect(tags.filter((tag) => ['img', 'script', 'iframe', 'svg', 'object', 'embed', 'style'].includes(tag.name))).toEqual([]);
  expect(tags.flatMap((tag) => tag.attributes.filter((a) => a.name.startsWith('on')))).toEqual([]);
  // No link points anywhere the hostile text chose.
  expect(tags.flatMap((tag) => tag.attributes.filter((a) => a.name === 'href' && /evil\.example/.test(a.value) && !a.value.includes('&lt;')))).toEqual([]);
};

beforeEach(() => {
  jest.clearAllMocks();
  sendEmailMock.mockResolvedValue(true);
});

describe('the escaping itself', () => {
  it('escapes the five characters that open a tag or close an attribute', () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&</a>`)).toBe('&lt;a href=&quot;x&quot; onclick=&#039;y&#039;&gt;&amp;&lt;/a&gt;');
  });

  it('reaches every string in a copy of the data, however deep, and nothing else', () => {
    const data = { name: '<b>', n: 7, ok: true, none: null, list: ['<i>', 3], nested: { inner: '"x"' } };
    expect(forHtml(data)).toEqual({ name: '&lt;b&gt;', n: 7, ok: true, none: null, list: ['&lt;i&gt;', 3], nested: { inner: '&quot;x&quot;' } });
    // The original is left alone: the plain-text part is built from it.
    expect(data.name).toBe('<b>');
  });

  it('hands a date through as a date, and does not turn it into an empty object', () => {
    const when = new Date('2026-10-01T03:00:00.000Z');
    const copy = forHtml({ when, who: '<b>' });

    expect(copy.when).toBe(when);
    expect(copy.who).toBe('&lt;b&gt;');
  });
});

describe('the email a notification becomes when it has no template of its own', () => {
  beforeEach(() => {
    prismaAny.user.findUnique.mockResolvedValue({
      email: 'her@example.org',
      firstName: 'Ana',
      notificationPreferences: null,
      preferredLocale: null,
      region: null,
    });
    process.env.CLIENT_URL = 'https://app.example.org';
  });

  it('draws a hostile title and message as text', async () => {
    await notificationService.notify({
      userId: 'u1',
      type: 'MESSAGE' as any,
      title: `${LINK} sent you a message`,
      message: `${IMG}${SCRIPT}`,
      link: '/dashboard/messages',
      channels: ['email'],
    });

    const mail = sent();
    expectNoInjectedMarkup(mail.html);
    expect(mail.html).toContain('&lt;a href=&quot;https://evil.example/login&quot;&gt;Sign in again&lt;/a&gt; sent you a message');
    expect(mail.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    // The text part is the message as it was written.
    expect(mail.text).toBe(`${IMG}${SCRIPT}`);
  });

  it('keeps its own button, and escapes the address inside it', () => {
    const html = fallbackEmailHtml({ title: 'Hi', message: 'There', url: 'https://app.example.org/posts/1?a=1&b="2"' });

    expect(html.match(/<a\b/g)).toHaveLength(1);
    expect(html).toContain('href="https://app.example.org/posts/1?a=1&amp;b=&quot;2&quot;"');
  });

  it('copes with a notification that has no message', () => {
    expect(fallbackEmailHtml({ title: 'Only a title', url: '#' })).toContain('<p></p>');
  });

  it('leaves a template somebody wrote alone', async () => {
    await notificationService.notify({
      userId: 'u1',
      type: 'MESSAGE' as any,
      title: 'Title',
      message: 'Message',
      channels: ['email'],
      emailTemplate: { subject: 'Own subject', html: '<h2>Own template</h2>' },
    });

    expect(sent()).toMatchObject({ subject: 'Own subject', html: '<h2>Own template</h2>' });
  });
});

describe('the templates in the email service', () => {
  it('referral: both names are text, and the subject and plain text are as typed', async () => {
    await emailService.sendReferralNotification('her@example.org', LINK, `${IMG}${SCRIPT}`, 100);

    const mail = sent();
    expectNoInjectedMarkup(mail.html);
    expect(mail.html).toContain('Great news, &lt;a href=&quot;https://evil.example/login&quot;&gt;Sign in again&lt;/a&gt;!');
    expect(mail.html).toContain('<strong>&lt;img src=x onerror=alert(1)&gt;&lt;script&gt;alert(2)&lt;/script&gt;</strong>');
    expect(mail.html).toContain('100 Credits');
    expect(mail.text).toContain(`Great news, ${LINK}!`);
    expect(mail.subject).toContain(`${IMG}${SCRIPT}`);
  });

  it('welcome: the name and the referral code are text', async () => {
    await emailService.sendWelcomeEmail('her@example.org', `${LINK}`, `"><script>alert(3)</script>`);

    const mail = sent();
    expectNoInjectedMarkup(mail.html);
    expect(mail.html).toContain('Welcome, &lt;a href=&quot;https://evil.example/login&quot;&gt;Sign in again&lt;/a&gt;!');
    expect(mail.html).toContain('&quot;&gt;&lt;script&gt;alert(3)&lt;/script&gt;');
  });

  it('re-engagement and weekly digest: the first name is text', async () => {
    await emailService.sendReEngagementEmail('her@example.org', LINK, 30);
    expectNoInjectedMarkup(sent().html);

    sendEmailMock.mockClear();
    await emailService.sendWeeklyDigest('her@example.org', IMG, { newJobs: 3, newConnections: 2, upcomingEvents: 1 });
    const digest = sent();
    expectNoInjectedMarkup(digest.html);
    // Numbers are not touched.
    expect(digest.html).toContain('>3<');
  });

  it('address change: the new address, the name and the support contact are text, and the link is a well-formed attribute', async () => {
    await emailService.sendEmailChangeConfirmation('"><img src=x onerror=alert(1)>@example.org', LINK, 'https://app.example.org/confirm?token=abc&x=1', 24);
    const confirmation = sent();
    expectNoInjectedMarkup(confirmation.html);
    expect(confirmation.html).toContain('href="https://app.example.org/confirm?token=abc&amp;x=1"');
    // The plain text carries the link as it is, to be pasted.
    expect(confirmation.text).toContain('https://app.example.org/confirm?token=abc&x=1');

    sendEmailMock.mockClear();
    await emailService.sendEmailChangeNotice('her@example.org', LINK, IMG, `${SCRIPT}help@example.org`);
    const notice = sent();
    expectNoInjectedMarkup(notice.html);
    expect(notice.html).toContain('&lt;script&gt;alert(2)&lt;/script&gt;help@example.org');
  });

  it('the generic sender with data and no markup of its own escapes what it prints', async () => {
    await emailService.sendEmail({
      to: 'referee@example.org',
      subject: 'Reference request',
      data: { refereeName: LINK, candidateName: `${IMG}${SCRIPT}` },
    });

    const mail = sent();
    expectNoInjectedMarkup(mail.html);
    expect(mail.html).toContain('&lt;a href=');
  });

  it('the generic sender does not fall over when it has neither markup nor data', async () => {
    await emailService.sendEmail({ to: 'referee@example.org', subject: 'Nothing' });
    expect(sent().html).toBe('<p>{}</p>');
  });

  it('the generic sender sends markup the caller supplied as it is: that caller owns it', async () => {
    await emailService.sendEmail({ to: 'a@example.org', subject: 'S', html: '<p>Mine</p>' });
    expect(sent().html).toBe('<p>Mine</p>');
  });
});

describe('every template, including the ones no sender uses yet', () => {
  // A hostile value for each field of each template. A template that gains a
  // field has to be added here with it, or the count below says so.
  const HOSTILE = `${LINK}${IMG}`;
  const fixtures: Record<string, object> = {
    welcome: { firstName: HOSTILE, referralCode: HOSTILE },
    referralSignup: { referrerName: HOSTILE, referredName: HOSTILE, credits: 100 },
    reEngagement: { firstName: HOSTILE, daysInactive: 30 },
    weeklyDigest: { firstName: HOSTILE, newJobs: 1, newConnections: 2, upcomingEvents: 3 },
    passwordReset: { firstName: HOSTILE, resetLink: `https://app.example.org/reset?token=${HOSTILE}`, expiresIn: HOSTILE },
    mentorBookingConfirmed: {
      menteeName: HOSTILE,
      mentorName: HOSTILE,
      dateTime: HOSTILE,
      duration: HOSTILE,
      sessionLink: `https://app.example.org/s?x=${HOSTILE}`,
      topics: [HOSTILE, HOSTILE],
    },
    applicationUpdate: {
      firstName: HOSTILE,
      jobTitle: HOSTILE,
      companyName: HOSTILE,
      status: 'SHORTLISTED',
      message: HOSTILE,
      actionLink: `https://app.example.org/a?x=${HOSTILE}`,
    },
    paymentReceipt: {
      firstName: HOSTILE,
      amount: HOSTILE,
      currency: 'AUD',
      description: HOSTILE,
      transactionId: HOSTILE,
      date: HOSTILE,
      receiptUrl: `https://app.example.org/r?x=${HOSTILE}`,
    },
    sessionReminder: { firstName: HOSTILE, partnerName: HOSTILE, dateTime: HOSTILE, minutesUntil: 15, sessionLink: `https://app.example.org/s?x=${HOSTILE}` },
    courseCompleted: {
      firstName: HOSTILE,
      courseName: HOSTILE,
      instructorName: HOSTILE,
      certificateUrl: `https://app.example.org/c?x=${HOSTILE}`,
      completionDate: HOSTILE,
    },
    emailChangeConfirmation: { firstName: HOSTILE, newEmail: HOSTILE, confirmUrl: `https://app.example.org/c?x=${HOSTILE}`, expiresInHours: 24 },
    emailChangeNotice: { firstName: HOSTILE, newEmail: HOSTILE, supportContact: HOSTILE },
  };

  it('has a fixture for every template there is', () => {
    expect(Object.keys(fixtures).sort()).toEqual(Object.keys(emailTemplates).sort());
  });

  it.each(Object.keys(fixtures))('%s draws hostile text as text, in its body and in its links, and keeps the text part as typed', (name) => {
    const template = (emailTemplates as unknown as Record<string, (data: object) => { subject: string; html: string; text: string }>)[name](
      fixtures[name]
    );

    expectNoInjectedMarkup(template.html);
    // The attribute a link sits in is not broken out of either.
    expect(template.html).not.toMatch(/href="[^"]*"[^>]*onerror/i);
    expect(template.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    // The plain text is what was typed, and is not entity-encoded.
    expect(template.text).not.toContain('&lt;');
    expect(template.text).not.toContain('&amp;lt;');
  });
});
