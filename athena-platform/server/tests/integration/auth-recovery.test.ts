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
const mockSendAccountExistsEmail = jest.fn(async (_to: string, _name: string) => true);
const mockSendAccountLockedEmail = jest.fn(async (_to: string, _name: string, _token: string) => true);

jest.mock('../../src/utils/email', () => ({
  sendEmail: jest.fn(async () => true),
  sendVerificationEmail: (...args: [string, string, string]) => mockSendVerificationEmail(...args),
  sendPasswordResetEmail: (...args: [string, string, string]) => mockSendPasswordResetEmail(...args),
  sendWelcomeEmail: (...args: []) => mockSendWelcomeEmail(...args),
  sendAccountExistsEmail: (...args: [string, string]) => mockSendAccountExistsEmail(...args),
  sendAccountLockedEmail: (...args: [string, string, string]) => mockSendAccountLockedEmail(...args),
  accountLockUrl: (token: string) => `https://app.athena.test/lock-account?token=${token}`,
}));

import { app } from '../../src/index';
import { prisma } from '../../src/utils/prisma';
import { issueLockLink } from '../../src/services/account-lock.service';

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
    mockSendAccountExistsEmail.mockClear();
    mockSendAccountLockedEmail.mockClear();
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

    it('keeps an account nobody has confirmed out of people search and off the public profile, until she confirms', async () => {
      await register();
      const before = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });

      // Anonymous: findable by the name typed into the form, which is anyone's to type.
      const anonymous = await request(app).get('/api/search/users').query({ q: 'Nadia' }).expect(200);
      expect(JSON.stringify(anonymous.body)).not.toContain(before.id);
      await request(app).get(`/api/users/${before.id}`).expect(404);

      // And to a signed-in member, who is a verified one.
      await register('other@athena.test');
      const otherToken = await verifyAndSignIn('other@athena.test');
      const asMember = await request(app)
        .get('/api/search/users')
        .set('Authorization', `Bearer ${otherToken}`)
        .query({ q: 'Okonkwo' })
        .expect(200);
      expect(JSON.stringify(asMember.body)).not.toContain(before.id);
      await request(app).get(`/api/users/${before.id}`).set('Authorization', `Bearer ${otherToken}`).expect(404);
      await request(app).post(`/api/users/${before.id}/follow`).set('Authorization', `Bearer ${otherToken}`).expect(404);

      // She appears once the address is hers. (A second query, so a cached empty answer is not read back.)
      const verification = mockSendVerificationEmail.mock.calls.find((call) => call[0] === EMAIL);
      if (!verification) throw new Error('No verification email was sent to the first member');
      await request(app).post('/api/auth/verify-email').send({ token: verification[2] }).expect(200);

      const after = await request(app).get('/api/search/users').query({ q: 'Nadia Okonkwo' }).expect(200);
      expect(JSON.stringify(after.body)).toContain(before.id);
      await request(app).get(`/api/users/${before.id}`).expect(200);
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

      // The older link is retired once the new one's mail has gone, which is
      // after the send is called, so the count is waited for rather than read.
      await waitFor(
        async () => (await prisma.verificationToken.count({ where: { type: 'PASSWORD_RESET' } })) === 1,
        'the first reset link to be retired'
      );

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
        // 403, not 401: a 401 makes both clients refresh the session and send
        // the same wrong password again, counted twice against the lockout.
        .expect(403);

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
    const otherPerson = (email: string) => ({
      email,
      password: 'AnotherPassw0rd!26',
      firstName: 'Someone',
      lastName: 'Else',
      womanSelfAttested: true,
      dateOfBirth: '1992-01-01',
    });

    it('answers a taken address exactly as it answers a new one, and tells the owner by email', async () => {
      await register();
      await verifyAndSignIn();

      const taken = await request(app).post('/api/auth/register').send(otherPerson(EMAIL));
      const fresh = await request(app).post('/api/auth/register').send(otherPerson('somebody.new@athena.test'));

      // The form cannot be used to ask whether somebody has an account.
      expect(taken.status).toBe(201);
      expect(taken.status).toBe(fresh.status);
      expect(taken.body).toEqual(fresh.body);

      // No second account, and the first is exactly as its owner left it.
      expect(await prisma.user.count({ where: { email: EMAIL } })).toBe(1);
      await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD }).expect(200);
      await request(app).post('/api/auth/login').send({ email: EMAIL, password: 'AnotherPassw0rd!26' }).expect(401);

      // The owner hears about it, in her inbox and not in the reply.
      await waitFor(
        () => mockSendAccountExistsEmail.mock.calls.length === 1,
        'the account-exists email to be handed to the provider'
      );
      expect(mockSendAccountExistsEmail.mock.calls[0][0]).toBe(EMAIL);
    });

    it('sends an unconfirmed address a fresh confirmation link and retires the old one', async () => {
      await register();
      const firstToken = lastVerificationToken();

      const again = await request(app).post('/api/auth/register').send(otherPerson(EMAIL));
      expect(again.status).toBe(201);
      expect(again.body.data).toEqual({ verificationRequired: true });

      await waitFor(
        () => mockSendVerificationEmail.mock.calls.length === 2,
        'the second confirmation email to be handed to the provider'
      );
      expect(await prisma.user.count({ where: { email: EMAIL } })).toBe(1);
      expect(mockSendAccountExistsEmail).not.toHaveBeenCalled();

      // The first link is retired once the second one's mail has gone.
      await waitFor(
        async () => (await prisma.verificationToken.count({ where: { type: 'EMAIL_VERIFICATION' } })) === 1,
        'the first confirmation link to be retired'
      );

      // One live link: the one just sent. Whoever holds the first has lost it.
      await request(app).post('/api/auth/verify-email').send({ token: firstToken }).expect(400);
      await request(app).post('/api/auth/verify-email').send({ token: lastVerificationToken() }).expect(200);

      // The password is still the first person's: a second registration
      // changed nothing about the account.
      await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD }).expect(200);
    });

    it('answers 503 with a code when the confirmation email cannot be sent, and the account it made can be finished by resending', async () => {
      mockSendVerificationEmail.mockResolvedValueOnce(false);

      const refused = await request(app).post('/api/auth/register').send(otherPerson(EMAIL));

      expect(refused.status).toBe(503);
      expect(refused.body.code).toBe('VERIFICATION_EMAIL_FAILED');
      // Saved, with the link that never arrived: resending is the way forward.
      expect(await prisma.user.count({ where: { email: EMAIL } })).toBe(1);

      await request(app).post('/api/auth/resend-verification').send({ email: EMAIL }).expect(200);
      await waitFor(
        () => mockSendVerificationEmail.mock.calls.length === 2,
        'the resent confirmation email to be handed to the provider'
      );
      await request(app).post('/api/auth/verify-email').send({ token: lastVerificationToken() }).expect(200);
    });

    it('keeps the link she already holds when a resend is refused by the email provider', async () => {
      await register();
      const firstToken = lastVerificationToken();

      mockSendVerificationEmail.mockResolvedValueOnce(false);
      await request(app).post('/api/auth/resend-verification').send({ email: EMAIL }).expect(200);
      await waitFor(
        () => mockSendVerificationEmail.mock.calls.length === 2,
        'the refused resend to be handed to the provider'
      );
      // The new link whose mail was refused is withdrawn, which follows the send.
      await waitFor(
        async () => (await prisma.verificationToken.count({ where: { type: 'EMAIL_VERIFICATION' } })) === 1,
        'the refused link to be withdrawn'
      );

      // Her first link still works: a failed resend used to delete it as well.
      await request(app).post('/api/auth/verify-email').send({ token: firstToken }).expect(200);
    });

    it('starts an unconfirmed account over when a registration for its address arrives more than an hour later, so whoever typed it first does not keep the password', async () => {
      // Somebody registers an address that is not theirs, with a password they know.
      await register();
      await prisma.user.update({
        where: { email: EMAIL },
        data: { createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
      });

      // The real owner of the address registers it two hours later.
      const owner = await request(app)
        .post('/api/auth/register')
        .send({ ...otherPerson(EMAIL), password: NEW_PASSWORD, firstName: 'Real', lastName: 'Owner' });
      expect(owner.status).toBe(201);
      await waitFor(
        () => mockSendVerificationEmail.mock.calls.length === 2,
        'the second confirmation email to be handed to the provider'
      );

      // One account, now hers: her password and her name.
      expect(await prisma.user.count({ where: { email: EMAIL } })).toBe(1);
      const row = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
      expect(row.firstName).toBe('Real');
      expect(mockSendVerificationEmail.mock.calls[1][1]).toBe('Real');

      await request(app).post('/api/auth/verify-email').send({ token: lastVerificationToken() }).expect(200);
      await request(app).post('/api/auth/login').send({ email: EMAIL, password: NEW_PASSWORD }).expect(200);
      // The password the first person chose no longer opens it.
      await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD }).expect(401);
    });
  });

  describe('locking her own account', () => {
    function lastUnlockToken(): string {
      const call = mockSendAccountLockedEmail.mock.calls.at(-1);
      if (!call) throw new Error('No unlock email was sent');
      return call[2];
    }

    it('locks from her settings, refuses her password until the emailed link is used, and the link works once', async () => {
      await register();
      const accessToken = await verifyAndSignIn();

      await request(app).post('/api/auth/lock').set('Authorization', `Bearer ${accessToken}`).expect(200);

      const locked = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
      expect(locked.lockedAt).not.toBeNull();
      expect(await prisma.session.count({ where: { userId: locked.id, revokedAt: null } })).toBe(0);
      await request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(401);
      await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD }).expect(403);

      // Stored hashed, like every emailed token, and spent once.
      const token = lastUnlockToken();
      const stored = await prisma.verificationToken.findFirstOrThrow({ where: { type: 'ACCOUNT_UNLOCK' } });
      expect(stored.token).not.toBe(token);

      await request(app).post('/api/auth/unlock').send({ token }).expect(200);
      expect((await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } })).lockedAt).toBeNull();
      await request(app).post('/api/auth/unlock').send({ token }).expect(400);
      expect(await prisma.verificationToken.count({ where: { type: 'ACCOUNT_UNLOCK' } })).toBe(0);

      await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD }).expect(200);
    });

    it('locks from the "this was not me" link with no session, and not twice', async () => {
      await register();
      const accessToken = await verifyAndSignIn();
      const member = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
      const link = await issueLockLink(member.id);

      await request(app).post('/api/auth/lock-by-token').send({ token: link }).expect(200);

      expect((await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } })).lockedAt).not.toBeNull();
      await request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(401);
      await request(app).post('/api/auth/lock-by-token').send({ token: link }).expect(400);
      // The way back was mailed to her.
      expect(mockSendAccountLockedEmail).toHaveBeenCalledTimes(1);
      expect(mockSendAccountLockedEmail.mock.calls[0][0]).toBe(EMAIL);
    });

    it('mails a new unlock link on request, and says the same thing for an address with no account', async () => {
      await register();
      const accessToken = await verifyAndSignIn();
      await request(app).post('/api/auth/lock').set('Authorization', `Bearer ${accessToken}`).expect(200);
      const first = lastUnlockToken();

      const known = await request(app).post('/api/auth/request-unlock').send({ email: EMAIL }).expect(200);
      const unknown = await request(app).post('/api/auth/request-unlock').send({ email: 'nobody@athena.test' }).expect(200);
      expect(unknown.body).toEqual(known.body);

      await waitFor(() => mockSendAccountLockedEmail.mock.calls.length === 2, 'the second unlock email to be handed to the provider');
      const second = lastUnlockToken();
      expect(second).not.toBe(first);
      // One live link: the older one went when the newer one was sent.
      await request(app).post('/api/auth/unlock').send({ token: first }).expect(400);
      await request(app).post('/api/auth/unlock').send({ token: second }).expect(200);
    });
  });
});
