/**
 * Sessions: rotation, revocation, refresh-token reuse, and the account lockout.
 *
 * `session.service.detectRefreshTokenReuse` is the platform's answer to a
 * stolen refresh token — if a token turns up that belongs to an already-revoked
 * session, every session for that account is burned. Nothing tests it. The two
 * suites that import `session.service` at all are about 2FA gating and socket
 * authentication, and neither reaches this path.
 *
 * It cannot be tested against a mock, because the whole mechanism is a question
 * about rows: is there a session row carrying this hashed token, is its
 * `revokedAt` set, and how many other rows does the `updateMany` then touch. A
 * `jest.fn()` answering `findFirst` decides all three itself.
 *
 * The account lockout is here for the reason finding 36 gives: it is covered as
 * a pure unit in `loginAttempts.test.ts` and never once through `/auth/login`,
 * so nothing proves the route consults it, or that a correct password during a
 * lockout is still refused.
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { describeIntegration, createMember, resetDatabase } from './setup/harness';

jest.mock('../../src/utils/email', () => ({
  sendEmail: jest.fn(async () => true),
  sendVerificationEmail: jest.fn(async () => true),
  sendPasswordResetEmail: jest.fn(async () => true),
  sendWelcomeEmail: jest.fn(async () => true),
}));

import { app } from '../../src/index';
import { prisma } from '../../src/utils/prisma';
import { hashPassword } from '../../src/utils/password';
import { getJwtSecretOrThrow } from '../../src/utils/jwt';
import { resetLoginAttemptMemory } from '../../src/utils/loginAttempts';

const PASSWORD = 'CorrectPassw0rd!26';

let emailCounter = 0;

/** A verified member with a password, and a unique address so one test's lockout is not another's. */
async function signedUpMember() {
  emailCounter += 1;
  const email = `session-${emailCounter}-${Date.now()}@athena.test`;
  const member = await createMember({
    email,
    emailVerified: true,
    passwordHash: await hashPassword(PASSWORD),
  });
  return { member, email };
}

async function signIn(email: string, password = PASSWORD) {
  const response = await request(app).post('/api/auth/login').send({ email, password }).expect(200);

  const cookies = response.headers['set-cookie'] as unknown as string[] | undefined;
  const refreshCookie = (cookies ?? []).find((cookie) => cookie.startsWith('refreshToken='));
  const refreshToken = refreshCookie ? decodeURIComponent(refreshCookie.split('=')[1].split(';')[0]) : '';

  return { accessToken: response.body.data.accessToken as string, refreshToken };
}

describeIntegration('session security', () => {
  beforeEach(async () => {
    await resetDatabase();
    resetLoginAttemptMemory();
  });

  describe('refresh rotation', () => {
    it('issues a new pair and revokes the old session', async () => {
      const { email } = await signedUpMember();
      const first = await signIn(email);

      const refreshed = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: first.refreshToken })
        .expect(200);

      const newAccessToken = refreshed.body.data.accessToken as string;
      expect(newAccessToken).not.toBe(first.accessToken);

      // Two rows: the rotated one revoked, the new one live. The old access
      // token goes with its session, which is what makes rotation worth doing.
      expect(await prisma.session.count()).toBe(2);
      expect(await prisma.session.count({ where: { revokedAt: null } })).toBe(1);

      await request(app).get('/api/auth/me').set('Authorization', `Bearer ${first.accessToken}`).expect(401);
      await request(app).get('/api/auth/me').set('Authorization', `Bearer ${newAccessToken}`).expect(200);
    });

    it('stores the refresh token hashed', async () => {
      const { email } = await signedUpMember();
      const { refreshToken } = await signIn(email);

      const session = await prisma.session.findFirstOrThrow();
      expect(session.refreshToken).not.toBe(refreshToken);
      expect(session.token).toBeTruthy();
    });

    it('refuses an access token presented as a refresh token', async () => {
      const { email } = await signedUpMember();
      const { accessToken } = await signIn(email);

      await request(app).post('/api/auth/refresh').send({ refreshToken: accessToken }).expect(401);
      expect(await prisma.session.count({ where: { revokedAt: null } })).toBe(1);
    });
  });

  describe('refresh-token reuse', () => {
    it('burns every session for the account when a rotated token comes back', async () => {
      const { member, email } = await signedUpMember();

      const phone = await signIn(email);
      const laptop = await signIn(email);
      expect(await prisma.session.count({ where: { userId: member.id, revokedAt: null } })).toBe(2);

      // Rotate the phone's token. The old one is now attached to a revoked
      // session, which is the only state reuse detection can recognise.
      const rotated = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: phone.refreshToken })
        .expect(200);
      expect(rotated.body.data.accessToken).toBeTruthy();

      // Somebody replays the token they copied earlier.
      await request(app).post('/api/auth/refresh').send({ refreshToken: phone.refreshToken }).expect(401);

      // Everything goes: the rotated session, the laptop, and the session the
      // rotation had just created. A refresh token in a stranger's hands means
      // the account is compromised, not that one device needs signing out.
      expect(await prisma.session.count({ where: { userId: member.id, revokedAt: null } })).toBe(0);
      await request(app).get('/api/auth/me').set('Authorization', `Bearer ${laptop.accessToken}`).expect(401);
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${rotated.body.data.accessToken}`)
        .expect(401);
    });

    it('leaves other accounts alone', async () => {
      const her = await signedUpMember();
      const someoneElse = await signedUpMember();

      const herPhone = await signIn(her.email);
      const theirLaptop = await signIn(someoneElse.email);

      await request(app).post('/api/auth/refresh').send({ refreshToken: herPhone.refreshToken }).expect(200);
      await request(app).post('/api/auth/refresh').send({ refreshToken: herPhone.refreshToken }).expect(401);

      // The `updateMany` is filtered on userId. A missing filter would sign out
      // the whole platform on one replayed token, and a mocked `updateMany`
      // would report whatever count the test asked for.
      expect(await prisma.session.count({ where: { userId: her.member.id, revokedAt: null } })).toBe(0);
      expect(await prisma.session.count({ where: { userId: someoneElse.member.id, revokedAt: null } })).toBe(1);
      await request(app).get('/api/auth/me').set('Authorization', `Bearer ${theirLaptop.accessToken}`).expect(200);
    });

    it('refuses an unknown refresh token without touching any session', async () => {
      const { member, email } = await signedUpMember();
      await signIn(email);

      const strangerToken = jwt.sign(
        { userId: member.id, email, role: 'USER', persona: 'EARLY_CAREER', typ: 'refresh' },
        getJwtSecretOrThrow(),
        { algorithm: 'HS256', expiresIn: '30d' }
      );

      await request(app).post('/api/auth/refresh').send({ refreshToken: strangerToken }).expect(401);

      // A well-formed token that never belonged to a session is a forgery or a
      // stale client, not evidence of a compromise, so her live session stays.
      expect(await prisma.session.count({ where: { userId: member.id, revokedAt: null } })).toBe(1);
    });
  });

  describe('access tokens the session table has already retired', () => {
    it('refuses one whose session was revoked by logout', async () => {
      const { email } = await signedUpMember();
      const { accessToken } = await signIn(email);

      await request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
      await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${accessToken}`).expect(200);

      // The JWT is still valid and unexpired. It is the session row that says
      // no, which is the only reason logging out means anything at all.
      await request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(401);
      expect(await prisma.session.count({ where: { revokedAt: null } })).toBe(0);
    });

    it('refuses one whose session has passed its expiry', async () => {
      const { email } = await signedUpMember();
      const { accessToken } = await signIn(email);

      await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 60_000) } });

      await request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(401);
    });

    it('refuses an expired JWT even while its session is live', async () => {
      const { member, email } = await signedUpMember();
      await signIn(email);

      const expired = jwt.sign(
        { userId: member.id, email, role: 'USER', persona: 'EARLY_CAREER', typ: 'access' },
        getJwtSecretOrThrow(),
        { algorithm: 'HS256', expiresIn: '-1s' }
      );

      await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expired}`).expect(401);
    });

    it('ends every device on logout-all', async () => {
      const { member, email } = await signedUpMember();
      const phone = await signIn(email);
      const laptop = await signIn(email);

      await request(app).post('/api/auth/logout-all').set('Authorization', `Bearer ${phone.accessToken}`).expect(200);

      expect(await prisma.session.count({ where: { userId: member.id, revokedAt: null } })).toBe(0);
      await request(app).get('/api/auth/me').set('Authorization', `Bearer ${laptop.accessToken}`).expect(401);
    });

    it('ends the session of an account suspended mid-refresh', async () => {
      const { member, email } = await signedUpMember();
      const { refreshToken } = await signIn(email);

      await prisma.user.update({ where: { id: member.id }, data: { isSuspended: true } });

      await request(app).post('/api/auth/refresh').send({ refreshToken }).expect(403);
      expect(await prisma.session.count({ where: { userId: member.id, revokedAt: null } })).toBe(0);
    });
  });

  describe('account lockout, through the login route', () => {
    it('locks after five wrong passwords and then refuses the right one', async () => {
      const { email } = await signedUpMember();

      for (let attempt = 1; attempt <= 4; attempt += 1) {
        await request(app).post('/api/auth/login').send({ email, password: 'WrongPassw0rd!26' }).expect(401);
      }

      const fifth = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'WrongPassw0rd!26' })
        .expect(429);
      expect(fifth.body.message).toMatch(/Too many failed login attempts/);

      // The part that matters and that a unit test of the counter cannot show:
      // the route consults the lockout before it looks at the password, so
      // guessing correctly on the sixth attempt still gets nowhere.
      const withTheRealPassword = await request(app)
        .post('/api/auth/login')
        .send({ email, password: PASSWORD })
        .expect(429);
      expect(withTheRealPassword.body.message).toMatch(/Too many failed login attempts/);

      expect(await prisma.session.count()).toBe(0);
    });

    it('forgets the failures once she signs in', async () => {
      const { email } = await signedUpMember();

      for (let attempt = 1; attempt <= 3; attempt += 1) {
        await request(app).post('/api/auth/login').send({ email, password: 'WrongPassw0rd!26' }).expect(401);
      }

      await signIn(email);

      // Three more failures must not tip her over, or a mistyped password today
      // and two tomorrow would lock an account nobody is attacking.
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        await request(app).post('/api/auth/login').send({ email, password: 'WrongPassw0rd!26' }).expect(401);
      }
    });

    it('answers the same way for an address with no account', async () => {
      const { email } = await signedUpMember();

      const wrongPassword = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'WrongPassw0rd!26' })
        .expect(401);

      const noSuchAccount = await request(app)
        .post('/api/auth/login')
        .send({ email: 'stranger@athena.test', password: 'WrongPassw0rd!26' })
        .expect(401);

      expect(wrongPassword.body.message).toBe(noSuchAccount.body.message);
    });
  });
});
