/**
 * Two-factor sign-in, from turning it on to losing the phone, against a real
 * database.
 *
 * The mocked suites (routes/__tests__/auth.two-factor-enrolment.test.ts,
 * auth.two-factor-login.test.ts, auth.social-two-factor.test.ts) hold each route
 * with the database stood in for. What they cannot show is the chain a member
 * actually walks, where each step depends on a row the one before it wrote: the
 * seed that setup stores has to be the one the next code is checked against, the
 * recovery codes enable hands back have to be the ones the login challenge
 * accepts, a code spent at the door has to stay spent, and a regenerated set has
 * to retire the old one. A staff reset has to leave the member able to sign in
 * with her password and nothing else, with every session she had gone.
 *
 * TOTP is real: the member's authenticator is played by the same RFC 6238
 * arithmetic the server uses. Only the email provider is mocked.
 */

import request from 'supertest';
import crypto from 'crypto';
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

const PASSWORD = 'CorrectPassw0rd!26';

function base32Decode(secret: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of secret.replace(/=|\s|-/g, '').toUpperCase()) {
    value = (value << 5) | alphabet.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** The code the authenticator shows `stepsAhead` thirty-second steps from now. */
function codeFor(secret: string, stepsAhead = 0): string {
  const counter = Math.floor(Date.now() / 1000 / 30) + stepsAhead;
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buffer.writeUInt32BE(counter % 0x100000000, 4);
  const hmac = crypto.createHmac('sha1', base32Decode(secret)).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(binary % 1_000_000).padStart(6, '0');
}

let counter = 0;

async function newMember(extra: { role?: 'ADMIN' } = {}) {
  counter += 1;
  const email = `two-factor-${counter}-${Date.now()}@athena.test`;
  const member = await createMember({ email, emailVerified: true, passwordHash: await hashPassword(PASSWORD) });
  if (extra.role) await prisma.user.update({ where: { id: member.id }, data: { role: extra.role } });
  return { member, email };
}

const signIn = (email: string, extra: Record<string, unknown> = {}) =>
  request(app).post('/api/auth/login').send({ email, password: PASSWORD, ...extra });

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Enrols a fresh member and returns what she was shown. The enrolling code is the next step's, so it is free to use again. */
async function enrol() {
  const { member, email } = await newMember();
  const first = await signIn(email).expect(200);
  const token = first.body.data.accessToken as string;

  const setup = await request(app).post('/api/auth/2fa/setup').set(bearer(token)).expect(200);
  const secret = setup.body.data.secret as string;
  const enabled = await request(app)
    .post('/api/auth/2fa/enable')
    .set(bearer(token))
    .send({ code: codeFor(secret), currentPassword: PASSWORD })
    .expect(200);

  return { member, email, token, secret, recoveryCodes: enabled.body.data.recoveryCodes as string[] };
}

describeIntegration('two-factor sign-in', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('turning it on', () => {
    it('stores the seed sealed, hands back ten recovery codes once, and keeps only hashes of them', async () => {
      const { member, secret, recoveryCodes, token } = await enrol();

      expect(recoveryCodes).toHaveLength(10);
      expect(new Set(recoveryCodes).size).toBe(10);

      const row = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
      expect(row.twoFactorEnabled).toBe(true);
      expect(row.twoFactorEnabledAt).not.toBeNull();
      // Sealed at rest: the seed is not the plaintext the member scanned.
      expect(row.twoFactorSecret).not.toBeNull();
      expect(row.twoFactorSecret).not.toBe(secret);
      expect(row.twoFactorRecoveryCodes).toHaveLength(10);
      for (const printed of recoveryCodes) {
        expect(row.twoFactorRecoveryCodes).not.toContain(printed);
        expect(row.twoFactorRecoveryCodes).not.toContain(printed.replace(/-/g, ''));
      }

      const status = await request(app).get('/api/auth/2fa/status').set(bearer(token)).expect(200);
      expect(status.body.data).toMatchObject({ enabled: true, setupPending: false, recoveryCodesRemaining: 10 });
      // And never the codes again.
      expect(JSON.stringify(status.body)).not.toContain(recoveryCodes[0]);
    });

    it('refuses a wrong code and leaves it off', async () => {
      const { member, email } = await newMember();
      const token = (await signIn(email).expect(200)).body.data.accessToken as string;
      await request(app).post('/api/auth/2fa/setup').set(bearer(token)).expect(200);

      await request(app)
        .post('/api/auth/2fa/enable')
        .set(bearer(token))
        .send({ code: '000000', currentPassword: PASSWORD })
        .expect(400);

      const row = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
      expect(row.twoFactorEnabled).toBe(false);
      expect(row.twoFactorRecoveryCodes).toHaveLength(0);
    });

    it('wants the password as well as the code: a session alone cannot put an authenticator on her account', async () => {
      const { member, email } = await newMember();
      const token = (await signIn(email).expect(200)).body.data.accessToken as string;
      const setup = await request(app).post('/api/auth/2fa/setup').set(bearer(token)).expect(200);
      const code = codeFor(setup.body.data.secret as string);

      await request(app).post('/api/auth/2fa/enable').set(bearer(token)).send({ code }).expect(400);
      await request(app)
        .post('/api/auth/2fa/enable')
        .set(bearer(token))
        .send({ code, currentPassword: 'not-the-password' })
        .expect(403);

      const row = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
      expect(row.twoFactorEnabled).toBe(false);
      expect(row.twoFactorRecoveryCodes).toHaveLength(0);
    });
  });

  describe('the sign-in challenge', () => {
    it('asks for a code after the password, and refuses a wrong one', async () => {
      const { email } = await enrol();

      const asked = await signIn(email).expect(401);
      expect(asked.body.message).toBe('Two-factor code required');

      await signIn(email, { twoFactorCode: '000000' }).expect(401);
    });

    it('opens for a live authenticator code, once: the same code a second time is a replay', async () => {
      const { email, secret } = await enrol();
      // A step ahead: still inside the window, and not the one that enabled it.
      const code = codeFor(secret, 1);

      await signIn(email, { twoFactorCode: code }).expect(200);
      const replay = await signIn(email, { twoFactorCode: code }).expect(401);
      expect(replay.body.message).toBe('Invalid two-factor code');
    });

    it('opens for a recovery code, exactly once, and the account is left holding nine', async () => {
      const { member, email, recoveryCodes } = await enrol();

      await signIn(email, { twoFactorCode: recoveryCodes[0] }).expect(200);
      const again = await signIn(email, { twoFactorCode: recoveryCodes[0] }).expect(401);
      expect(again.body.message).toBe('Invalid two-factor code');

      const row = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
      expect(row.twoFactorRecoveryCodes).toHaveLength(9);

      // The others are untouched, and she can type one the way it was printed or loosely.
      await signIn(email, { twoFactorCode: recoveryCodes[1].toLowerCase().replace(/-/g, ' ') }).expect(200);
    });

    it('is not opened by a recovery code that belongs to somebody else', async () => {
      const one = await enrol();
      const two = await enrol();

      await signIn(two.email, { twoFactorCode: one.recoveryCodes[0] }).expect(401);
    });
  });

  describe('a new set of recovery codes', () => {
    it('retires the old set the moment it is issued, and the new ones work', async () => {
      const { email, token, recoveryCodes } = await enrol();

      const reissued = await request(app)
        .post('/api/auth/2fa/recovery-codes')
        .set(bearer(token))
        .send({ currentPassword: PASSWORD, code: recoveryCodes[0] })
        .expect(200);
      const fresh = reissued.body.data.recoveryCodes as string[];
      expect(fresh).toHaveLength(10);

      // Every one of the old set is dead, including the one that authorised the change.
      for (const old of recoveryCodes) {
        await signIn(email, { twoFactorCode: old }).expect(401);
      }
      await signIn(email, { twoFactorCode: fresh[0] }).expect(200);
    });

    it('wants the password and a live second factor, not just a session', async () => {
      const { token } = await enrol();

      await request(app).post('/api/auth/2fa/recovery-codes').set(bearer(token)).send({ code: '000000' }).expect(400);
      await request(app)
        .post('/api/auth/2fa/recovery-codes')
        .set(bearer(token))
        .send({ currentPassword: 'not-the-password', code: '000000' })
        .expect(403);
    });
  });

  describe('turning it off', () => {
    it('with the password and a recovery code, which is the lost-phone path, clears the seed and the codes', async () => {
      const { member, email, token, recoveryCodes } = await enrol();

      await request(app)
        .post('/api/auth/2fa/disable')
        .set(bearer(token))
        .send({ currentPassword: PASSWORD, code: recoveryCodes[2] })
        .expect(200);

      const row = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
      expect(row).toMatchObject({ twoFactorEnabled: false, twoFactorSecret: null, twoFactorEnabledAt: null });
      expect(row.twoFactorRecoveryCodes).toHaveLength(0);
      // The password alone opens it again.
      await signIn(email).expect(200);
    });

    it('is refused for a wrong code, and it stays on', async () => {
      const { member, token } = await enrol();

      await request(app)
        .post('/api/auth/2fa/disable')
        .set(bearer(token))
        .send({ currentPassword: PASSWORD, code: '000000' })
        .expect(400);

      const row = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
      expect(row.twoFactorEnabled).toBe(true);
    });
  });

  describe('a staff reset, for a member who has lost the phone and the codes', () => {
    it('removes the factor and ends every session, leaves the password alone, and is on the audit log', async () => {
      const { member, email, token } = await enrol();
      const admin = await newMember({ role: 'ADMIN' });
      const adminToken = (await signIn(admin.email).expect(200)).body.data.accessToken as string;

      await request(app)
        .post(`/api/admin/users/${member.id}/two-factor/reset`)
        .set(bearer(adminToken))
        .send({ reason: 'Phoned from the number on file and read back her last invoice.', identityChecked: true })
        .expect(200);

      const row = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
      expect(row).toMatchObject({ twoFactorEnabled: false, twoFactorSecret: null });
      expect(row.twoFactorRecoveryCodes).toHaveLength(0);
      expect(row.passwordHash).not.toBeNull();

      // The session she had on the lost device is gone.
      await request(app).get('/api/auth/2fa/status').set(bearer(token)).expect(401);
      // And she is back in with her password.
      await signIn(email).expect(200);

      const audit = await prisma.auditLog.findFirst({ where: { targetUserId: member.id, action: 'ADMIN_USER_UPDATE' } });
      expect(audit).not.toBeNull();
      expect(audit?.actorUserId).toBe(admin.member.id);
      expect(audit?.metadata).toMatchObject({ adminAction: 'USER_TWO_FACTOR_RESET', identityChecked: true });

      const told = await prisma.notification.findFirst({ where: { userId: member.id } });
      expect(told?.title).toMatch(/two-factor/i);
    });

    it('is refused for an administrator on her own account, and for an ordinary member on anybody', async () => {
      const admin = await newMember({ role: 'ADMIN' });
      const adminToken = (await signIn(admin.email).expect(200)).body.data.accessToken as string;
      const body = { reason: 'Testing that this is refused for the same account.', identityChecked: true };

      await request(app).post(`/api/admin/users/${admin.member.id}/two-factor/reset`).set(bearer(adminToken)).send(body).expect(409);

      const { member: victim } = await enrol();
      const { email } = await newMember();
      const memberToken = (await signIn(email).expect(200)).body.data.accessToken as string;
      await request(app).post(`/api/admin/users/${victim.id}/two-factor/reset`).set(bearer(memberToken)).send(body).expect(403);

      const row = await prisma.user.findUniqueOrThrow({ where: { id: victim.id } });
      expect(row.twoFactorEnabled).toBe(true);
    });
  });
});
