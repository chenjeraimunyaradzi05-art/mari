/**
 * Getting back into an account: verification, password reset, password change.
 *
 * Nothing in the repository tests these. One file matches a grep for the route
 * names — `src/__tests__/auth-session-gate.test.ts` — and it does not call
 * them. It calls `validateAuthSessionRoutes()`, which reads
 * `src/routes/auth.routes.ts` as a *string* and asserts the text contains
 * `'Current password is incorrect'`. That check passes with the password
 * comparison inverted, with the `update` removed, with the whole handler
 * replaced by the message in a comment. The first test below is the same
 * question asked of the running server, and it is the one a source grep can
 * never answer.
 *
 * These need a database because the flows are almost entirely database
 * behaviour: a single-use token row, a unique constraint, sessions deleted by
 * cascade, and a password hash that has to actually change.
 *
 * Only the email provider is mocked, and only to catch the token — the token is
 * stored hashed, so there is no way to read it back out of the row.
 */

import request from 'supertest';
import { describeIntegration, resetDatabase, waitFor } from './setup/harness';

const mockSendVerificationEmail = jest.fn(async (_to: string, _name: string, _token: string) => true);
const mockSendPasswordResetEmail = jest.fn(async (_to: string, _name: string, _token: string) => true);
const mockSendWelcomeEmail = jest.fn(async () => true);

jest.mock('../../src/utils/email', () => ({
  sendEmail: jest.fn(async () => true),
  sendVerificationEmail: (...args: [string, string, string]) => mockSendVerificationEmail(...args),
  sendPasswordResetEmail: (...args: [string, string, string]) => mockSendPasswordResetEmail(...args),
  sendWelcomeEmail: (...args: []) => mockSendWelcomeEmail(...args),
}));

import { app } from '../../src/index';
import { prisma } from '../../src/utils/prisma';

const EMAIL = 'nadia@athena.test';
const PASSWORD = 'FirstPassw0rd!2026';
const NEW_PASSWORD = 'SecondPassw0rd!2026';

async function register(email = EMAIL, password = PASSWORD) {
  const response = await request(app).post('/api/auth/register').send({
    email,
    password,
    firstName: 'Nadia',
    lastName: 'Okonkwo',
    womanSelfAttested: true,
    dateOfBirth: '1990-05-04',
  });

  expect(response.status).toBe(201);
  return response;
}

/** The raw verification token, which exists only in the argument handed to the email layer. */
function lastVerificationToken(): string {
  const call = mockSendVerificationEmail.mock.calls.at(-1);
  if (!call) throw new Error('No verification email was sent');
  return call[2];
}

function lastResetToken(): string {
  const call = mockSendPasswordResetEmail.mock.calls.at(-1);
  if (!call) throw new Error('No password reset email was sent');
  return call[2];
}

async function verifyAndSignIn(email = EMAIL, password = PASSWORD) {
  await request(app).post('/api/auth/verify-email').send({ token: lastVerificationToken() }).expect(200);

  const login = await request(app).post('/api/auth/login').send({ email, password }).expect(200);
  return login.body.data.accessToken as string;
}

describeIntegration('account recovery', () => {
  beforeEach(async () => {
    await resetDatabase();
    mockSendVerificationEmail.mockClear();
    mockSendPasswordResetEmail.mockClear();
    mockSendWelcomeEmail.mockClear();
  });

  describe('email verification', () => {
    it('refuses sign-in until the address is verified, then allows it', async () => {
      await register();

      const before = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
      expect(before.emailVerified).toBe(false);

      await request(app)
        .post('/api/auth/login')
        .send({ email: EMAIL, password: PASSWORD })
        .expect(403, {
          success: false,
          message: 'Please verify your email before signing in.',
        });

      await request(app).post('/api/auth/verify-email').send({ token: lastVerificationToken() }).expect(200);

      const after = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
      expect(after.emailVerified).toBe(true);
      expect(after.emailVerifiedAt).not.toBeNull();

      await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD }).expect(200);
    });

    it('stores the token hashed and spends it exactly once', async () => {
      await register();
      const token = lastVerificationToken();

      const stored = await prisma.verificationToken.findFirstOrThrow({ where: { type: 'EMAIL_VERIFICATION' } });
      // A leaked database backup must not be a set of working verification
      // links. The row holds a hash; the raw token exists only in the email.
      expect(stored.token).not.toBe(token);

      await request(app).post('/api/auth/verify-email').send({ token }).expect(200);
      expect(await prisma.verificationToken.count()).toBe(0);

      await request(app).post('/api/auth/verify-email').send({ token }).expect(400);
    });

    it('refuses a token that has expired', async () => {
      await register();
      const token = lastVerificationToken();

      await prisma.verificationToken.updateMany({
        where: { type: 'EMAIL_VERIFICATION' },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      await request(app).post('/api/auth/verify-email').send({ token }).expect(400);
      expect((await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } })).emailVerified).toBe(false);
    });
  });

  describe('password reset', () => {
    it('answers the same way for an address with an account and one without', async () => {
      await register();

      const known = await request(app).post('/api/auth/forgot-password').send({ email: EMAIL }).expect(200);
      const unknown = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nobody@athena.test' })
        .expect(200);

      expect(known.body.message).toBe(unknown.body.message);

      await waitFor(
        () => mockSendPasswordResetEmail.mock.calls.length === 1,
        'the deferred password reset email to be handed to the provider'
      );

      // One token, for the address that exists. The reply said nothing either
      // way, which is the point.
      expect(await prisma.verificationToken.count({ where: { type: 'PASSWORD_RESET' } })).toBe(1);
      expect(mockSendPasswordResetEmail.mock.calls[0][0]).toBe(EMAIL);
    });

    it('replaces the password, ends every session and burns the token', async () => {
      await register();
      const accessToken = await verifyAndSignIn();

      expect(await prisma.session.count()).toBe(1);

      await request(app).post('/api/auth/forgot-password').send({ email: EMAIL }).expect(200);
      await waitFor(
        () => mockSendPasswordResetEmail.mock.calls.length === 1,
        'the deferred password reset email to be handed to the provider'
      );

      const before = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });

      await request(app)
        .post('/api/auth/reset-password')
        .send({ token: lastResetToken(), password: NEW_PASSWORD })
        .expect(200);

      const after = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
      expect(after.passwordHash).not.toBe(before.passwordHash);

      // Whoever forced the reset should not still be holding a live session.
      expect(await prisma.session.count()).toBe(0);
      await request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(401);

      await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD }).expect(401);
      await request(app).post('/api/auth/login').send({ email: EMAIL, password: NEW_PASSWORD }).expect(200);
    });

    it('spends the reset token once', async () => {
      await register();
      await verifyAndSignIn();

      await request(app).post('/api/auth/forgot-password').send({ email: EMAIL }).expect(200);
      await waitFor(
        () => mockSendPasswordResetEmail.mock.calls.length === 1,
        'the deferred password reset email to be handed to the provider'
      );
      const token = lastResetToken();

      await request(app).post('/api/auth/reset-password').send({ token, password: NEW_PASSWORD }).expect(200);
      expect(await prisma.verificationToken.count({ where: { type: 'PASSWORD_RESET' } })).toBe(0);

      await request(app)
        .post('/api/auth/reset-password')
        .send({ token, password: 'ThirdPassw0rd!2026' })
        .expect(400);

      // The refused replay must not have changed anything.
      await request(app).post('/api/auth/login').send({ email: EMAIL, password: NEW_PASSWORD }).expect(200);
    });

    it('issues one live reset token, not one per request', async () => {
      await register();

      await request(app).post('/api/auth/forgot-password').send({ email: EMAIL }).expect(200);
      await waitFor(() => mockSendPasswordResetEmail.mock.calls.length === 1, 'the first reset email');
      const first = lastResetToken();

      await request(app).post('/api/auth/forgot-password').send({ email: EMAIL }).expect(200);
      await waitFor(() => mockSendPasswordResetEmail.mock.calls.length === 2, 'the second reset email');

      expect(await prisma.verificationToken.count({ where: { type: 'PASSWORD_RESET' } })).toBe(1);

      // A reset link she asked for and then replaced must stop working, or a
      // link read over her shoulder last week still opens the account.
      await request(app)
        .post('/api/auth/reset-password')
        .send({ token: first, password: NEW_PASSWORD })
        .expect(400);
    });
  });

  describe('changing a known password', () => {
    it('refuses the wrong current password and leaves the hash alone', async () => {
      await register();
      const accessToken = await verifyAndSignIn();
      const before = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ currentPassword: 'NotHerPassw0rd!26', newPassword: NEW_PASSWORD })
        .expect(401);

      expect(response.body.message).toBe('Current password is incorrect');

      // The assertion the source-text gate cannot make. With the comparison
      // inverted the message string is still in the file and that gate still
      // passes; here the password would have changed and this fails.
      const after = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
      expect(after.passwordHash).toBe(before.passwordHash);
      await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD }).expect(200);
      await request(app).post('/api/auth/login').send({ email: EMAIL, password: NEW_PASSWORD }).expect(401);
    });

    it('changes the password and signs out the other devices but not this one', async () => {
      await register();
      const phone = await verifyAndSignIn();
      const laptop = (
        await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD }).expect(200)
      ).body.data.accessToken as string;

      expect(await prisma.session.count({ where: { revokedAt: null } })).toBe(2);

      await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${laptop}`)
        .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })
        .expect(200);

      // A password changed because somebody else knows it has to end that
      // person's session, and leaving her own would be a second sign-in she
      // did not ask for.
      expect(await prisma.session.count({ where: { revokedAt: null } })).toBe(1);
      await request(app).get('/api/auth/me').set('Authorization', `Bearer ${laptop}`).expect(200);
      await request(app).get('/api/auth/me').set('Authorization', `Bearer ${phone}`).expect(401);

      await request(app).post('/api/auth/login').send({ email: EMAIL, password: NEW_PASSWORD }).expect(200);
    });
  });

  describe('registration', () => {
    it('refuses a second account on one address, and the unique constraint agrees', async () => {
      await register();

      await request(app)
        .post('/api/auth/register')
        .send({
          email: EMAIL,
          password: 'AnotherPassw0rd!26',
          firstName: 'Someone',
          lastName: 'Else',
          womanSelfAttested: true,
          dateOfBirth: '1992-01-01',
        })
        .expect(409);

      expect(await prisma.user.count({ where: { email: EMAIL } })).toBe(1);
    });
  });
});
