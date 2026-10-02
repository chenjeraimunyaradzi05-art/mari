/**
 * No invented figures in what ATHENA emails.
 *
 * The welcome message told every new member "Connect with 500+ expert mentors"
 * and "Join a community of 50,000+ ambitious women". Neither number was counted
 * from anything, and the register of claims the platform may make
 * (docs/security/trust-claims-register.md) forbids stating one. The wording was
 * fixed and a test pinned that one email; this is the guard for the class: every
 * email the platform can send, rendered, and the source of the two files that
 * write them, are checked for a marketing count of the shape "500+" or
 * "50,000+".
 *
 * A number that is true because it was computed (the three counts in the weekly
 * digest, a credit total) is not a claim of this kind and has no plus sign.
 */

import * as fs from 'fs';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const fetchMock = jest.fn() as jest.Mock<(url: string, init: RequestInit) => Promise<Response>>;
const realFetch = global.fetch;

jest.mock('../prisma', () => ({ prisma: { emailSuppression: { findUnique: jest.fn(async () => null) } } }));
jest.mock('../logger', () => ({ logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import {
  sendAccountExistsEmail,
  sendAccountLockedEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
} from '../email';
import emailService from '../../services/email.service';

/** "500+", "50,000+", "1,000+": a count with a plus sign after it. */
const COUNT_CLAIM = /\d[\d,]*\+/;

type Sent = { subject: string; html: string; text: string };
const bodies: Sent[] = [];

beforeEach(() => {
  bodies.length = 0;
  process.env.NODE_ENV = 'production';
  process.env.SENDGRID_API_KEY = 'SG.not-a-real-key';
  process.env.SENDGRID_FROM_EMAIL = 'noreply@mail.ourdomain.org';
  process.env.CLIENT_URL = 'https://app.ourdomain.org';
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (_url, init) => {
    const message = JSON.parse(String(init.body)) as {
      subject: string;
      content: Array<{ type: string; value: string }>;
    };
    bodies.push({
      subject: message.subject,
      html: message.content.find((part) => part.type === 'text/html')?.value ?? '',
      text: message.content.find((part) => part.type === 'text/plain')?.value ?? '',
    });
    return new Response(null, { status: 202 });
  });
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  global.fetch = realFetch;
});

describe('every email the platform can send', () => {
  it('states no count of members, mentors or anything else with a plus sign', async () => {
    await sendVerificationEmail('her@example.org', 'Ana', 'tok-1');
    await sendPasswordResetEmail('her@example.org', 'Ana', 'tok-2');
    await sendAccountExistsEmail('her@example.org', 'Ana');
    await sendAccountLockedEmail('her@example.org', 'Ana', 'tok-3');
    await sendWelcomeEmail('her@example.org', 'Ana');
    await emailService.sendWelcomeEmail('her@example.org', 'Ana', 'ANA100');
    await emailService.sendReferralNotification('her@example.org', 'Ana', 'Bea', 100);
    await emailService.sendReEngagementEmail('her@example.org', 'Ana', 30);
    await emailService.sendWeeklyDigest('her@example.org', 'Ana', { newJobs: 12, newConnections: 3, upcomingEvents: 4 });
    await emailService.sendEmailChangeConfirmation('new@example.org', 'Ana', 'https://app.ourdomain.org/c?t=1', 24);
    await emailService.sendEmailChangeNotice('her@example.org', 'Ana', 'new@example.org', 'privacy@ourdomain.org');

    // Eleven rendered, or the loop below would be checking an empty list.
    expect(bodies).toHaveLength(11);
    for (const { subject, html, text } of bodies) {
      for (const part of [subject, html, text]) {
        expect(part).not.toMatch(COUNT_CLAIM);
      }
    }
  });

  it('says what a new member can do without saying how many of anything there are', async () => {
    await sendWelcomeEmail('her@example.org', 'Ana');

    expect(bodies[0].html).toMatch(/Find a mentor/);
    expect(bodies[0].html).toMatch(/Join the community/);
    // Nor in words: no "thousands of" or "hundreds of" either.
    expect(bodies[0].html).not.toMatch(/\b(thousands|hundreds|millions)\s+of\b/i);
  });
});

describe('the source of the two files that write them', () => {
  // Comments are dropped first: a comment may well quote the figure it is
  // explaining was removed.
  const code = (file: string) =>
    fs
      .readFileSync(path.resolve(__dirname, file), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
      .replace(/<!--[\s\S]*?-->/g, '');

  it.each([['../email.ts'], ['../../services/email.service.ts']])('%s contains no count with a plus sign', (file) => {
    const lines = code(file)
      .split('\n')
      .filter((line) => COUNT_CLAIM.test(line));
    expect(lines).toEqual([]);
  });
});
