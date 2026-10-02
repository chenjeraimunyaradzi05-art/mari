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
  sendAccountLockedEmail: jest.fn(async () => true),
  accountLockUrl: (token: string) => `https://app.athena.test/lock-account?token=${token}`,
}));

import { app } from '../../src/index';
import { prisma } from '../../src/utils/prisma';
import { hashPassword } from '../../src/utils/password';
import { getJwtSecretOrThrow } from '../../src/utils/jwt';
import { resetLoginAttemptMemory } from '../../src/utils/loginAttempts';
import { hashOpaqueToken } from '../../src/utils/opaqueToken';

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

/**
 * A rotated refresh token replayed straight away is a second tab or a retry, and
 * is answered 409; replayed later it is theft. A test that wants the theft path
 * says the rotation happened a minute ago rather than waiting for it.
 */
async function retiredAMinuteAgo(refreshToken: string) {
  await prisma.session.updateMany({
    where: { refreshToken: hashOpaqueToken(refreshToken) },
    data: { revokedAt: new Date(Date.now() - 60_000) },
  });
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

      // Somebody replays the token they copied earlier, well after the rotation.
      await retiredAMinuteAgo(phone.refreshToken);
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

    it('reads a replay moments after the rotation as a second tab: asked again, nobody signed out', async () => {
      const { member, email } = await signedUpMember();
      const phone = await signIn(email);
      const laptop = await signIn(email);

      await request(app).post('/api/auth/refresh').send({ refreshToken: phone.refreshToken }).expect(200);
      const straggler = await request(app).post('/api/auth/refresh').send({ refreshToken: phone.refreshToken }).expect(409);

      expect(straggler.body.code).toBe('REFRESH_IN_PROGRESS');
      // The laptop and the session the rotation created are both still live.
      expect(await prisma.session.count({ where: { userId: member.id, revokedAt: null } })).toBe(2);
      await request(app).get('/api/auth/me').set('Authorization', `Bearer ${laptop.accessToken}`).expect(200);
    });

    it('lets one of two simultaneous refreshes with the same token win, and leaves one live session for it', async () => {
      const { member, email } = await signedUpMember();
      const { refreshToken } = await signIn(email);

      const answers = await Promise.all([
        request(app).post('/api/auth/refresh').send({ refreshToken }),
        request(app).post('/api/auth/refresh').send({ refreshToken }),
      ]);

      expect(answers.map((answer) => answer.status).sort()).toEqual([200, 409]);
      // One token produced one new pair, not two.
      expect(await prisma.session.count({ where: { userId: member.id, revokedAt: null } })).toBe(1);
    });

    it('hands a native client the refresh token in the body and takes it back there', async () => {
      const { member, email } = await signedUpMember();

      const login = await request(app)
        .post('/api/auth/login')
        .set('X-Athena-Client', 'mobile')
        .send({ email, password: PASSWORD })
        .expect(200);
      expect(login.body.data.refreshToken).toEqual(expect.any(String));
      expect(login.headers['set-cookie']).toBeUndefined();

      const refreshed = await request(app)
        .post('/api/auth/refresh')
        .set('X-Athena-Client', 'mobile')
        .send({ refreshToken: login.body.data.refreshToken })
        .expect(200);
      expect(refreshed.body.data.refreshToken).toEqual(expect.any(String));
      expect(refreshed.body.data.refreshToken).not.toBe(login.body.data.refreshToken);
      expect(await prisma.session.count({ where: { userId: member.id, revokedAt: null } })).toBe(1);
    });

    it('does not read a device the member signed out as a thief when it comes back and refreshes', async () => {
      const { member, email } = await signedUpMember();
      const phone = await signIn(email);
      const laptop = await signIn(email);

      // The laptop's session is ended from the phone, and the laptop asks for a
      // refresh a quarter of an hour later. The session was ended, not rotated,
      // so the token is simply unknown and nothing else is touched.
      const sessionsList = await request(app).get('/api/auth/sessions').set('Authorization', `Bearer ${phone.accessToken}`).expect(200);
      const laptopSession = (sessionsList.body.data as Array<{ id: string; isCurrent: boolean }>).find((entry) => !entry.isCurrent)!;
      await request(app)
        .delete(`/api/auth/sessions/${laptopSession.id}`)
        .set('Authorization', `Bearer ${phone.accessToken}`)
        .expect(200);
      await prisma.session.update({ where: { id: laptopSession.id }, data: { revokedAt: new Date(Date.now() - 15 * 60_000) } });

      await request(app).post('/api/auth/refresh').send({ refreshToken: laptop.refreshToken }).expect(401);

      expect(await prisma.session.count({ where: { userId: member.id, revokedAt: null } })).toBe(1);
      await request(app).get('/api/auth/me').set('Authorization', `Bearer ${phone.accessToken}`).expect(200);
    });

    it('leaves other accounts alone', async () => {
      const her = await signedUpMember();
      const someoneElse = await signedUpMember();

      const herPhone = await signIn(her.email);
      const theirLaptop = await signIn(someoneElse.email);

      await request(app).post('/api/auth/refresh').send({ refreshToken: herPhone.refreshToken }).expect(200);
      await retiredAMinuteAgo(herPhone.refreshToken);
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

    it('stops a live access token at once when the member locks her account, and refuses her password and her refresh token until it is unlocked', async () => {
      const { member, email } = await signedUpMember();
      const phone = await signIn(email);
      const laptop = await signIn(email);

      await request(app).post('/api/auth/lock').set('Authorization', `Bearer ${phone.accessToken}`).expect(200);

      // Every device, the one she pressed the button on included.
      expect(await prisma.session.count({ where: { userId: member.id, revokedAt: null } })).toBe(0);
      await request(app).get('/api/auth/me').set('Authorization', `Bearer ${phone.accessToken}`).expect(401);
      await request(app).get('/api/auth/me').set('Authorization', `Bearer ${laptop.accessToken}`).expect(401);

      // The right password does not get back in, and says why.
      const refused = await request(app).post('/api/auth/login').send({ email, password: PASSWORD }).expect(403);
      expect(refused.body.message).toMatch(/locked/i);
      await request(app).post('/api/auth/refresh').send({ refreshToken: laptop.refreshToken }).expect(401);
      expect(await prisma.session.count({ where: { userId: member.id, revokedAt: null } })).toBe(0);

      // Clearing the column is what unlocks it: she signs in as before.
      await prisma.user.update({ where: { id: member.id }, data: { lockedAt: null } });
      await signIn(email);
    });

    it('refuses a token minted while the lock was being made, because authenticate reads the account', async () => {
      const { member, email } = await signedUpMember();
      const early = await signIn(email);
      await request(app).post('/api/auth/lock').set('Authorization', `Bearer ${early.accessToken}`).expect(200);

      // A sign-in that had passed its checks before the lock landed.
      await prisma.user.update({ where: { id: member.id }, data: { lockedAt: null } });
      const late = await signIn(email);
      await prisma.user.update({ where: { id: member.id }, data: { lockedAt: new Date() } });

      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${late.accessToken}`).expect(403);
      expect(res.body.message).toMatch(/locked/i);
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

  // Whoever holds an access token can try the current password as often as they
  // like unless the check counts its failures. They are counted per member, in
  // a bucket of their own, so failing here never locks her out of signing in.
  describe('the credential checks behind a session', () => {
    it('locks change-password after five wrong current passwords, and refuses the right one', async () => {
      const { email } = await signedUpMember();
      const { accessToken } = await signIn(email);
      const change = (currentPassword: string) =>
        request(app)
          .post('/api/auth/change-password')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ currentPassword, newPassword: 'BrandNewPassw0rd!27' });

      for (let attempt = 1; attempt <= 4; attempt += 1) {
        await change('WrongPassw0rd!26').expect(401);
      }
      const fifth = await change('WrongPassw0rd!26').expect(429);
      expect(fifth.body.message).toMatch(/Too many incorrect attempts/);

      // The route looks at the lockout before it compares anything, so the
      // right password on the sixth try gets nowhere either.
      await change(PASSWORD).expect(429);

      // Her password is unchanged, and signing in is a different bucket.
      await request(app).post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);
    });
  });
});
