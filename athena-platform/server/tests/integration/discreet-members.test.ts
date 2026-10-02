/**
 * A member in Safe Mode, walked as a stranger, against a real database.
 *
 * The mocked suites (tests/discreet-members.test.ts, tests/search.routes.test.ts,
 * tests/engagement.routes.test.ts) run the clauses the routes send over a small
 * set of rows with a reader written for the purpose. That proves the clauses
 * mean what they are meant to; it cannot prove Postgres agrees. The rule is
 * built from nested relation filters — `NOT: { OR: [...] }` across two
 * one-to-one relations, and `followers: { some: { follower: { ... } } }` — and
 * Prisma turns them into SQL joins that a reader of the clause does not run. So
 * this suite creates one member in Safe Mode, one who only hid herself from
 * search, and an ordinary one, and asks every public surface the blueprint's
 * promise covers whether it names her: search, people you may know, her profile
 * by its id, the post search her words would come back in, and the leaderboard.
 *
 * Who counts as a verified connection is the owner's decision. For now it is a
 * member she has approved as a follower who has passed the women-only check.
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
/** In every display name, so a search for it finds the whole cast. */
const TAG = 'Quokkaleaf';

let counter = 0;

async function signedIn(name: string, extra: { verified?: boolean } = {}) {
  counter += 1;
  const email = `discreet-${counter}-${Date.now()}@athena.test`;
  const member = await createMember({ email, emailVerified: true, passwordHash: await hashPassword(PASSWORD), firstName: name });
  await prisma.user.update({
    where: { id: member.id },
    data: {
      displayName: `${TAG} ${name}`,
      headline: `Headline of ${name}`,
      city: 'Brisbane',
      state: 'QLD',
      // Well ahead of everyone, so a leaderboard that did not filter would put her first.
      xp: name === 'Her' || name === 'Hider' ? 9000 : 100,
      ...(extra.verified === false ? {} : { womanVerificationStatus: 'VERIFIED' }),
    },
  });
  const response = await request(app).post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);
  return { member, token: response.body.data.accessToken as string };
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const idsOf = (rows: Array<{ id: string }>) => rows.map((r) => r.id);

describeIntegration('a member in Safe Mode, seen as a stranger', () => {
  let her: Awaited<ReturnType<typeof signedIn>>;
  let hider: Awaited<ReturnType<typeof signedIn>>;
  let plain: Awaited<ReturnType<typeof signedIn>>;
  let stranger: Awaited<ReturnType<typeof signedIn>>;
  let friend: Awaited<ReturnType<typeof signedIn>>;
  let unchecked: Awaited<ReturnType<typeof signedIn>>;

  beforeEach(async () => {
    await resetDatabase();
    her = await signedIn('Her');
    hider = await signedIn('Hider');
    plain = await signedIn('Plain');
    stranger = await signedIn('Stranger');
    friend = await signedIn('Friend');
    unchecked = await signedIn('Unchecked', { verified: false });

    // Safe Mode, as the DV safety page writes it; and hide-from-search alone, as the privacy page does.
    await prisma.dvSafetyProfile.create({ data: { userId: her.member.id, isSafeMode: true } });
    await prisma.profile.create({ data: { userId: hider.member.id, hideFromSearch: true } });

    // Two followers of hers she has approved: one who has passed the women-only check, and one who has not.
    await prisma.follow.createMany({
      data: [
        { followerId: friend.member.id, followingId: her.member.id },
        { followerId: unchecked.member.id, followingId: her.member.id },
      ],
    });

    for (const m of [her, hider, plain]) {
      await prisma.post.create({ data: { authorId: m.member.id, content: `${TAG} notes from ${m.member.firstName}` } });
    }
  });

  it('is not found by name in search', async () => {
    const res = await request(app).get('/api/search/users').query({ q: TAG }).set(bearer(stranger.token)).expect(200);

    const found = idsOf(res.body.results);
    expect(found).toContain(plain.member.id);
    expect(found).not.toContain(her.member.id);
    // Hiding from search is its own switch and has always worked.
    expect(found).not.toContain(hider.member.id);
  });

  it('is found by a follower of hers who has passed the women-only check, and by nobody else', async () => {
    const forFriend = await request(app).get('/api/search/users').query({ q: TAG }).set(bearer(friend.token)).expect(200);
    expect(idsOf(forFriend.body.results)).toContain(her.member.id);

    const forUnchecked = await request(app).get('/api/search/users').query({ q: TAG }).set(bearer(unchecked.token)).expect(200);
    expect(idsOf(forUnchecked.body.results)).not.toContain(her.member.id);

    const signedOut = await request(app).get('/api/search/users').query({ q: TAG }).expect(200);
    expect(idsOf(signedOut.body.results)).not.toContain(her.member.id);
  });

  it('is not offered in people you may know', async () => {
    const res = await request(app).get('/api/users/suggested').query({ limit: '20' }).set(bearer(stranger.token)).expect(200);

    const offered = idsOf(res.body.data);
    expect(offered).toContain(plain.member.id);
    expect(offered).not.toContain(her.member.id);
    expect(offered).not.toContain(hider.member.id);
    expect(JSON.stringify(res.body)).not.toContain('Headline of Her');
  });

  it('has a profile closed to a stranger holding her id, and open to herself and her verified follower', async () => {
    await request(app).get(`/api/users/${her.member.id}`).set(bearer(stranger.token)).expect(403);
    await request(app).get(`/api/users/${her.member.id}`).expect(403);
    await request(app).get(`/api/users/${her.member.id}`).set(bearer(unchecked.token)).expect(403);

    await request(app).get(`/api/users/${her.member.id}`).set(bearer(her.token)).expect(200);
    await request(app).get(`/api/users/${her.member.id}`).set(bearer(friend.token)).expect(200);
    // A member who only hid herself from search is reachable by link, as before.
    await request(app).get(`/api/users/${hider.member.id}`).set(bearer(stranger.token)).expect(200);
  });

  it('keeps her posts out of post search for a stranger, and in for her verified follower', async () => {
    const forStranger = await request(app).get('/api/search/posts').query({ q: TAG }).set(bearer(stranger.token)).expect(200);
    const authors = (forStranger.body.results as Array<{ metadata: { author: { id: string } } }>).map((r) => r.metadata.author.id);
    expect(authors).toContain(plain.member.id);
    expect(authors).not.toContain(her.member.id);

    const forFriend = await request(app).get('/api/search/posts').query({ q: TAG }).set(bearer(friend.token)).expect(200);
    const seenByFriend = (forFriend.body.results as Array<{ metadata: { author: { id: string } } }>).map((r) => r.metadata.author.id);
    expect(seenByFriend).toContain(her.member.id);
  });

  it('is not on the leaderboard, though she has the most XP', async () => {
    const res = await request(app).get('/api/engagement/leaderboard').query({ type: 'xp', period: 'alltime' }).expect(200);

    const named = idsOf(res.body.leaderboard);
    expect(named).toContain(plain.member.id);
    expect(named).not.toContain(her.member.id);
    expect(named).not.toContain(hider.member.id);
  });

  it('is on nobody’s list once she turns Safe Mode off, which is the same switch', async () => {
    await prisma.dvSafetyProfile.update({ where: { userId: her.member.id }, data: { isSafeMode: false } });

    const res = await request(app).get('/api/search/users').query({ q: TAG }).set(bearer(stranger.token)).expect(200);

    expect(idsOf(res.body.results)).toContain(her.member.id);
    await request(app).get(`/api/users/${her.member.id}`).set(bearer(stranger.token)).expect(200);
  });
});
