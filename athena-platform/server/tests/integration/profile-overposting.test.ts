/**
 * What a signed-in member's profile request can and cannot reach, against a
 * real database.
 *
 * `PATCH /api/users/me/profile` used to hand the request body to
 * `prisma.profile.upsert` as it arrived. Prisma reads a nested `user` object as
 * a write on the account row the profile belongs to, so a body of
 * `{ "user": { "update": { "role": "SUPER_ADMIN", "twoFactorEnabled": true } } }`
 * made the sender an administrator and switched off the check that would have
 * asked an administrator for a second factor. The unit suite proves the route
 * refuses that body; this one proves the consequence that matters, which is a
 * question about a row: after the request, is her account still her account?
 * A mocked `upsert` cannot answer it, because the nested write is something
 * the real client does with the object it is given.
 *
 * `POST /api/users/me/experience` and `/me/education` spread the body after the
 * owner, so a body `userId` planted an entry on somebody else's public profile.
 */

import request from 'supertest';
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

let counter = 0;

async function signedInMember() {
  counter += 1;
  const email = `overpost-${counter}-${Date.now()}@athena.test`;
  const member = await createMember({
    email,
    emailVerified: true,
    passwordHash: await hashPassword(PASSWORD),
  });
  const response = await request(app).post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);
  return { member, token: response.body.data.accessToken as string };
}

/** The columns an overposted body was aiming at, as the database holds them. */
async function accountOf(userId: string) {
  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      role: true,
      twoFactorEnabled: true,
      womanVerificationStatus: true,
      isSuspended: true,
      emailVerified: true,
      email: true,
    },
  });
}

describeIntegration('profile requests that name more than the form does', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('PATCH /api/users/me/profile', () => {
    it('leaves her role, second factor and verification alone when the body reaches for them', async () => {
      const { member, token } = await signedInMember();
      const before = await accountOf(member.id);
      expect(before.role).toBe('USER');

      const attempts = [
        { user: { update: { role: 'SUPER_ADMIN', twoFactorEnabled: true } } },
        { user: { update: { womanVerificationStatus: 'VERIFIED', emailVerified: false, isSuspended: false } } },
        { user: { connect: { id: 'someone-else' } } },
        { userId: 'someone-else', aboutMe: 'x' },
      ];

      for (const body of attempts) {
        await request(app).patch('/api/users/me/profile').set('Authorization', `Bearer ${token}`).send(body).expect(400);
      }

      expect(await accountOf(member.id)).toEqual(before);
      expect(await prisma.profile.count()).toBe(0);
    });

    it('still saves what the form sends, on her own profile and nobody else’s', async () => {
      const { member, token } = await signedInMember();
      const bystander = await createMember();
      const before = await accountOf(member.id);

      await request(app)
        .patch('/api/users/me/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          aboutMe: 'Builder of small things',
          openToWork: true,
          salaryMin: 90000,
          salaryMax: 120000,
          remotePreference: 'hybrid',
          preferredJobTypes: ['FULL_TIME'],
        })
        .expect(200);

      const profile = await prisma.profile.findUniqueOrThrow({ where: { userId: member.id } });
      expect(profile.aboutMe).toBe('Builder of small things');
      expect(profile.salaryMax).toBe(120000);
      expect(await prisma.profile.count({ where: { userId: bystander.id } })).toBe(0);
      expect(await accountOf(member.id)).toEqual(before);
    });
  });

  describe('POST /api/users/me/experience and /me/education', () => {
    it('will not plant an entry on another member’s profile', async () => {
      const { token } = await signedInMember();
      const victim = await createMember();

      await request(app)
        .post('/api/users/me/experience')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: victim.id, company: 'Acme', title: 'Engineer', startDate: '2024-01-01' })
        .expect(400);
      await request(app)
        .post('/api/users/me/education')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: victim.id, institution: 'QUT' })
        .expect(400);

      expect(await prisma.workExperience.count({ where: { userId: victim.id } })).toBe(0);
      expect(await prisma.education.count({ where: { userId: victim.id } })).toBe(0);
    });

    it('files an honest entry under the caller', async () => {
      const { member, token } = await signedInMember();

      await request(app)
        .post('/api/users/me/experience')
        .set('Authorization', `Bearer ${token}`)
        .send({ company: 'Acme', title: 'Engineer', startDate: '2024-01-01', endDate: '2025-06-30' })
        .expect(201);
      await request(app)
        .post('/api/users/me/education')
        .set('Authorization', `Bearer ${token}`)
        .send({ institution: 'QUT', degree: 'BIT' })
        .expect(201);

      const experience = await prisma.workExperience.findMany();
      const education = await prisma.education.findMany();
      expect(experience.map((row) => row.userId)).toEqual([member.id]);
      expect(education.map((row) => row.userId)).toEqual([member.id]);
      expect(experience[0].startDate.toISOString().slice(0, 10)).toBe('2024-01-01');
    });
  });
});
