import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const store: { entries: any[]; settings: any; posts: any[]; replies: any[]; reviews: any[]; habits: any[]; logs: any[]; circles: any[]; members: any[] } = { entries: [], settings: null, posts: [], replies: [], reviews: [], habits: [], logs: [], circles: [], members: [] };

jest.mock('../../utils/prisma', () => ({
  prisma: {
    // A practitioner's listing now lapses a year after her last approval, and the
    // approval date is read from the audit rows the verify route writes. None
    // here: these practitioners were approved before re-checks were recorded.
    auditLog: { findMany: jest.fn(async () => []), create: jest.fn(async () => ({})) },
    // The forums, circles and challenges leave out whoever is across a block, in both lists a block can be written to; nobody is here (wellness.blocks.test.ts holds the rest).
    userSafetySettings: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    dvSafetyProfile: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []), findFirst: jest.fn(async () => null) },
    user: { findUnique: jest.fn(async () => ({ timezone: 'Australia/Brisbane' })), findMany: jest.fn(async ({ where }: any) => (where?.role === 'ADMIN' ? [{ id: 'admin-1' }] : (where?.id?.in ?? []).map((id: string) => ({ id, timezone: 'Australia/Brisbane' })))), update: jest.fn(async () => ({})), count: jest.fn(async () => 1) },
    healthSettings: {
      findUnique: jest.fn(async () => store.settings),
      create: jest.fn(async ({ data }: any) => { store.settings = { id: 's1', cycleLengthHint: null, periodLengthHint: null, hiddenWarnings: [], anonymousByDefault: false, checkInReminderHour: null, shareWithPractitioners: true, ...data }; return store.settings; }),
      update: jest.fn(async ({ data }: any) => { store.settings = { ...store.settings, ...data }; return store.settings; }),
      findMany: jest.fn(async () => []), deleteMany: jest.fn(async () => ({ count: 1 })),
    },
    healthEntry: {
      findMany: jest.fn(async ({ where }: any) => store.entries.filter((e) => !where?.kind || (typeof where.kind === 'string' ? e.kind === where.kind : where.kind.in.includes(e.kind)))),
      findFirst: jest.fn(async ({ where }: any) => (where.id ? store.entries.find((e) => e.id === where.id) : store.entries.find((e) => e.kind === where.kind && e.day.getTime() === where.day.getTime())) ?? null),
      create: jest.fn(async ({ data }: any) => { const row = { id: `e${store.entries.length + 1}`, at: new Date(), refId: null, ...data }; store.entries.push(row); return row; }),
      update: jest.fn(async ({ where, data }: any) => { const row = store.entries.find((e) => e.id === where.id); Object.assign(row, data); return row; }),
      deleteMany: jest.fn(async ({ where }: any) => { const before = store.entries.length; store.entries = store.entries.filter((e) => !(where?.id?.in ? where.id.in.includes(e.id) : where?.id ? e.id === where.id : true)); return { count: before - store.entries.length }; }),
    },
    medication: { findMany: jest.fn(async () => []), findFirst: jest.fn(async () => null), count: jest.fn(async () => 0), create: jest.fn(), deleteMany: jest.fn(async () => ({ count: 1 })) },
    healthNote: { findMany: jest.fn(async () => []), groupBy: jest.fn(async () => []), deleteMany: jest.fn(async () => ({ count: 1 })) },
    healthShare: {
      findMany: jest.fn(async () => []), create: jest.fn(async ({ data }: any) => ({ id: 'sh1', ...data })), update: jest.fn(async () => ({})), deleteMany: jest.fn(async () => ({ count: 1 })),
      findUnique: jest.fn(async ({ where }: any) => (where.token === 'live' || where.token === 'anon' ? { id: 'sh1', userId: 'member', scope: ['checkins', 'sleep'], days: 30, label: 'Dr K', anonymous: where.token === 'anon', expiresAt: new Date(Date.now() + 86400000), revokedAt: null, user: { firstName: 'Mei', lastName: 'Lin', timezone: 'Australia/Brisbane' } } : where.token === 'dead' ? { id: 'sh2', userId: 'member', scope: [], days: 30, anonymous: false, expiresAt: new Date(Date.now() - 1), revokedAt: null, user: { firstName: 'Mei', lastName: 'Lin', timezone: 'Australia/Brisbane' } } : null)),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    mentalLoadEntry: { findMany: jest.fn(async () => []), create: jest.fn(async ({ data }: any) => ({ id: 'ml1', createdAt: new Date(), ...data })), deleteMany: jest.fn(async () => ({ count: 1 })) },
    wellnessForum: {
      findMany: jest.fn(async () => [{ id: 'f1', slug: 'anxiety', name: 'Anxiety', topic: 'anxiety', description: '', guidelines: '', isActive: true, sortOrder: 1, postCount: 0 }]),
      findUnique: jest.fn(async ({ where }: any) => (where.slug === 'anxiety' ? { id: 'f1', slug: 'anxiety', name: 'Anxiety', topic: 'anxiety', description: '', guidelines: '', isActive: true, sortOrder: 1, postCount: 0 } : null)),
      update: jest.fn(async () => ({})),
    },
    wellnessPost: {
      groupBy: jest.fn(async () => []), findMany: jest.fn(async () => store.posts), count: jest.fn(async () => store.posts.length),
      create: jest.fn(async ({ data }: any) => { const row = { id: `p${store.posts.length + 1}`, isHidden: false, hiddenReason: null, isPinned: false, isLocked: false, replyCount: 0, supportCount: 0, lastReplyAt: null, createdAt: new Date(), updatedAt: new Date(), author: { id: data.authorId, firstName: data.authorId === 'doctor' ? 'Kate' : 'Mei', lastName: 'Lin', displayName: null, avatar: null, role: 'USER', practitionerProfile: data.authorId === 'doctor' ? { isVerified: true, kind: 'GP' } : null }, forum: { slug: 'anxiety', name: 'Anxiety' }, ...data }; store.posts.push(row); return row; }),
      findUnique: jest.fn(async ({ where }: any) => store.posts.find((p) => p.id === where.id) ?? null),
      // Plain values in the update land on the row, as they do in the database; counters move by their increment.
      update: jest.fn(async ({ where, data }: any) => { const row = store.posts.find((p) => p.id === where.id); const plain = Object.fromEntries(Object.entries(data).filter(([, v]) => v === null || typeof v !== 'object' || v instanceof Date)); Object.assign(row, plain, { supportCount: row.supportCount + (data.supportCount?.increment ?? 0) - (data.supportCount?.decrement ?? 0) }); return row; }),
    },
    // A thread comes back a page at a time, so the mock has to honour skip and
    // take: a findMany that ignored them could not tell a thread that stops at
    // reply fifty from one that is only fifty replies long.
    wellnessReply: {
      findMany: jest.fn(async ({ skip = 0, take }: any) => store.replies.slice(skip, take === undefined ? undefined : skip + take)),
      count: jest.fn(async () => store.replies.length),
      findUnique: jest.fn(async ({ where }: any) => store.replies.find((r) => r.id === where.id) ?? null),
      create: jest.fn(async ({ data }: any) => { const row = { id: `re${store.replies.length + 1}`, isHidden: false, createdAt: new Date(), ...data, author: { id: data.authorId, firstName: 'Ana', lastName: 'M', displayName: null, avatar: null, role: 'USER', practitionerProfile: null } }; store.replies.push(row); return row; }),
      update: jest.fn(async ({ where, data }: any) => { const row = store.replies.find((r) => r.id === where.id); Object.assign(row, data); return row; }),
    },
    wellnessSupport: { findMany: jest.fn(async () => []), findFirst: jest.fn(async () => null), findUnique: jest.fn(async () => null), create: jest.fn(async () => ({})), delete: jest.fn() },
    adminFlag: { create: jest.fn(async () => ({ id: 'flag-1' })) },
    contentReport: { create: jest.fn(async ({ data }: any) => ({ id: 'r1', status: 'PENDING', ...data })) },
    notification: { create: jest.fn(async () => ({})), createMany: jest.fn(async () => ({ count: 1 })), findMany: jest.fn(async () => []) },
    userAchievement: { findFirst: jest.fn(async () => ({ id: 'already' })), findMany: jest.fn(async () => [{ achievementId: 'first_checkin', earnedAt: new Date('2026-09-01T00:00:00Z') }, { achievementId: 'first_post', earnedAt: new Date('2026-09-01T00:00:00Z') }]), create: jest.fn() },
    habit: {
      findMany: jest.fn(async () => store.habits), findFirst: jest.fn(async ({ where }: any) => store.habits.find((h) => h.id === where.id) ?? null), count: jest.fn(async () => store.habits.length),
      create: jest.fn(async ({ data }: any) => { const row = { id: `h${store.habits.length + 1}`, isArchived: false, createdAt: new Date(), cue: null, reminderTime: null, evidenceNote: null, evidenceUrl: null, templateKey: null, ...data }; store.habits.push(row); return row; }),
      update: jest.fn(), deleteMany: jest.fn(async () => ({ count: 1 })),
    },
    habitLog: {
      findMany: jest.fn(async ({ where }: any) => store.logs.filter((l) => !where?.habitId || l.habitId === where.habitId)),
      upsert: jest.fn(async ({ create }: any) => { const row = { id: `l${store.logs.length + 1}`, ...create }; store.logs.push(row); return row; }),
    },
    wellnessGoal: { findMany: jest.fn(async () => []), count: jest.fn(async () => 0), deleteMany: jest.fn(async () => ({ count: 1 })) },
    wellnessCircle: {
      findMany: jest.fn(async () => store.circles), count: jest.fn(async () => 0),
      create: jest.fn(async ({ data }: any) => { const row = { id: `c${store.circles.length + 1}`, isFeatured: false, createdAt: new Date(), meetingLink: null, location: null, ...data, facilitator: { id: data.facilitatorId, firstName: 'Mei', lastName: 'Lin', displayName: null, avatar: null, role: 'USER' }, members: [{ userId: data.facilitatorId, leftAt: null }] }; delete row.members.create; store.circles.push(row); return row; }),
      findUnique: jest.fn(async ({ where }: any) => store.circles.find((c) => c.id === where.id) ?? null),
      update: jest.fn(async ({ where, data }: any) => { const row = store.circles.find((c) => c.id === where.id); Object.assign(row, data); return row; }),
    },
    wellnessCircleCheckIn: { upsert: jest.fn(async ({ create }: any) => ({ id: 'ci1', createdAt: new Date(), ...create })) },
    wellnessCircleMember: { count: jest.fn(async () => 0), findMany: jest.fn(async () => []), upsert: jest.fn(async ({ create }: any) => { const c = store.circles.find((x) => x.id === create.circleId); c.members.push({ userId: create.userId, leftAt: null }); return create; }), findUnique: jest.fn(async () => null), updateMany: jest.fn(async () => ({ count: 1 })) },
    wellnessChallenge: { findMany: jest.fn(async () => []) },
    healthPractitioner: {
      findMany: jest.fn(async ({ where }: any) => (where?.acceptsBookings === false ? [] : [practitioner])), count: jest.fn(async () => 1),
      findUnique: jest.fn(async ({ where }: any) => (where.id === 'pr1' ? practitioner : where.ownerUserId === 'doctor' ? { ...practitioner, ownerUserId: 'doctor' } : null)),
      findFirst: jest.fn(async ({ where }: any) => (where.OR?.some((o: any) => o.slug === 'dr-k' || o.id === 'pr1') ? practitioner : null)),
      update: jest.fn(async () => practitioner),
    },
    healthBooking: {
      findMany: jest.fn(async () => []), groupBy: jest.fn(async () => []),
      findFirst: jest.fn(async ({ where }: any) => (where.id === 'b-ics' && where.userId === 'member' ? { id: 'b-ics', userId: 'member', scheduledAt: new Date('2026-09-15T23:00:00.000Z'), durationMinutes: 50, mode: 'TELEHEALTH', meetingLink: 'https://meet.example.com/x', practitioner: { name: 'Dr K, women\'s health', kind: 'GP', suburb: null, city: 'Brisbane', state: 'QLD' } } : null)),
      create: jest.fn(async ({ data }: any) => ({ id: 'b1', status: 'REQUESTED', createdAt: new Date(), practitionerNote: null, meetingLink: null, shareId: null, followUpOfId: null, ...data, practitioner: { id: 'pr1', slug: 'dr-k', name: 'Dr K', kind: 'GP', headline: 'GP', telehealth: true, inPerson: false, ownerUserId: 'doctor' }, review: null })),
      update: jest.fn(async () => ({})),
    },
    healthReview: {
      findMany: jest.fn(async () => store.reviews.filter((r) => !r.isHidden).map((r) => ({ ...r, comment: null, createdAt: new Date(), user: { firstName: 'Ana' } }))),
      count: jest.fn(async () => store.reviews.filter((r) => !r.isHidden).length),
      // practitionerRating() asks the database for the average rather than
      // pulling every review row into memory, so the mock answers aggregate
      // the way Prisma does: _avg.rating is null when nothing is showing, and
      // _count.rating counts only the rows the where clause matched.
      aggregate: jest.fn(async ({ where }: any) => {
        const showing = store.reviews.filter((r) => (where?.isHidden === false ? !r.isHidden : true));
        return { _avg: { rating: showing.length ? showing.reduce((sum: number, r: any) => sum + r.rating, 0) / showing.length : null }, _count: { rating: showing.length } };
      }),
      findUnique: jest.fn(async ({ where }: any) => store.reviews.find((r) => r.id === where.id) ?? null),
      update: jest.fn(async ({ where, data }: any) => { const row = store.reviews.find((r) => r.id === where.id); Object.assign(row, data); return row; }),
    },
    article: { findMany: jest.fn(async () => []) },
    $transaction: jest.fn(async (ops: any[]) => Promise.all(ops)),
  },
}));

const practitioner = { id: 'pr1', slug: 'dr-k', name: 'Dr K', kind: 'GP', headline: 'A women\'s health GP', bio: 'Bio', qualifications: [], modalities: [], specialties: ['Menopause'], languages: ['English'], suburb: null, city: 'Brisbane', state: 'QLD', telehealth: true, inPerson: false, bulkBilling: false, medicareRebate: true, privateHealth: false, feeFrom: null, feeNote: null, ahpraNumber: null, website: null, phone: null, bookingUrl: null, availability: { '1': [['09:00', '12:00']], '2': [['09:00', '12:00']], '3': [['09:00', '12:00']], '4': [['09:00', '12:00']], '5': [['09:00', '12:00']] }, slotMinutes: 60, acceptsBookings: true, ownerUserId: 'doctor', isVerified: true, isActive: true, ratingAvg: 0, ratingCount: 0, createdAt: new Date() };

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: req.headers['x-test-user'] || 'member', role: req.headers['x-test-role'] || 'USER', email: 'x@athena.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// The safety score is its own suite's business; here what matters is that a forum
// report is handed to it, as a report from any other door is.
const handleUserReport = jest.fn(async (..._args: unknown[]) => undefined);
jest.mock('../../services/safety-score.service', () => ({
  ...(jest.requireActual('../../services/safety-score.service') as object),
  handleUserReport: (...args: unknown[]) => handleUserReport(...args),
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { decryptJson } from '../../services/wellness/health-crypto';
import { zonedToUtc } from '../../services/wellness/wellness-dates';

const prisma: any = prismaTyped;
const as = (userId: string, role = 'USER') => ({ 'x-test-user': userId, 'x-test-role': role });
const TODAY = '2026-09-11';

describe('The wellness routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store.entries = []; store.settings = null; store.posts = []; store.replies = []; store.habits = []; store.logs = []; store.circles = []; store.members = [];
    // Three showing reviews to start with; hiding one has to move the average.
    store.reviews = [{ id: 'r1', practitionerId: 'pr1', rating: 5, isHidden: false }, { id: 'r2', practitionerId: 'pr1', rating: 4, isHidden: false }, { id: 'r3', practitionerId: 'pr1', rating: 3, isHidden: false }];
  });

  it('opens the reference, the library and the K10 to anyone', async () => {
    const ref = await request(app).get('/api/wellness/reference').expect(200);
    expect(ref.body.data.crisisLines.find((l: any) => l.name === 'Lifeline').phone).toBe('13 11 14');
    expect(ref.body.data.habitTemplates.length).toBeGreaterThan(10);
    const lib = await request(app).get('/api/wellness/library').expect(200);
    expect(lib.body.data.topics).toHaveLength(8);
    const k10 = await request(app).post('/api/wellness/k10').send({ answers: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4] }).expect(200);
    expect(k10.body.data.band).toBe('severe');
    expect(k10.body.data.crisisLines.length).toBeGreaterThan(0);
    await request(app).post('/api/wellness/k10').send({ answers: [1, 2] }).expect(400);
  });

  it('stores a check-in encrypted, once per day, and refuses a tracker she switched off', async () => {
    const first = await request(app).post('/api/wellness/entries').set(as('member')).query({ today: TODAY }).send({ kind: 'CHECKIN', payload: { mood: 4, stress: 2, anxiety: 2, energy: 3, note: 'ok' } }).expect(201);
    expect(first.body.data.entry.payload.mood).toBe(4);
    const stored = prisma.healthEntry.create.mock.calls[0][0].data.payload;
    expect(stored).not.toContain('mood');
    expect(decryptJson(stored)).toMatchObject({ mood: 4 });
    const again = await request(app).post('/api/wellness/entries').set(as('member')).query({ today: TODAY }).send({ kind: 'CHECKIN', payload: { mood: 2, stress: 4, anxiety: 4, energy: 2 } }).expect(201);
    expect(again.body.data.entry.id).toBe(first.body.data.entry.id);
    expect(prisma.healthEntry.update).toHaveBeenCalled();
    await request(app).post('/api/wellness/entries').set(as('member')).query({ today: TODAY }).send({ kind: 'CHECKIN', payload: { mood: 9, stress: 2, anxiety: 2, energy: 3 } }).expect(400);
    await request(app).put('/api/wellness/settings').set(as('member')).send({ trackers: { nutrition: false } }).expect(200);
    const off = await request(app).post('/api/wellness/entries').set(as('member')).query({ today: TODAY }).send({ kind: 'NUTRITION', payload: { meal: 'lunch' } }).expect(400);
    expect(off.body.message ?? off.body.error).toMatch(/switched off/);
  });

  it('adds hydration to the day rather than replacing it, and lists the entries back decrypted', async () => {
    await request(app).post('/api/wellness/entries').set(as('member')).query({ today: TODAY }).send({ kind: 'HYDRATION', payload: { glasses: 2 } }).expect(201);
    const more = await request(app).post('/api/wellness/entries').set(as('member')).query({ today: TODAY }).send({ kind: 'HYDRATION', payload: { glasses: 3 }, add: true }).expect(201);
    expect(more.body.data.entry.payload.glasses).toBe(5);
    const list = await request(app).get('/api/wellness/entries').set(as('member')).query({ today: TODAY, kind: 'HYDRATION' }).expect(200);
    expect(list.body.data.entries[0].payload.glasses).toBe(5);
    const today = await request(app).get('/api/wellness/today').set(as('member')).query({ today: TODAY }).expect(200);
    expect(today.body.data.todays.HYDRATION.payload.glasses).toBe(5);
    expect(today.body.data.cycle.hasData).toBe(false);
    expect(today.body.data.checkinStreak.current).toBe(0);
  });

  it('puts the crisis lines in front of a member whose post sounds like crisis, and flags it for safety', async () => {
    const res = await request(app).post('/api/wellness/forums/anxiety/posts').set(as('member')).send({ title: 'I do not know what to do', body: 'Some nights I want to die and I do not know who to tell about any of it.', isAnonymous: true }).expect(201);
    expect(res.body.data.crisis.flagged).toBe(true);
    expect(res.body.data.crisis.lines[0].phone).toBeDefined();
    expect(res.body.data.post.author.name).toBe('You, anonymously');
    expect(prisma.adminFlag.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: 'SAFETY_CONCERN', severity: 'HIGH' }) }));
    const calm = await request(app).post('/api/wellness/forums/anxiety/posts').set(as('member')).send({ title: 'What helps on a bad morning?', body: 'Looking for the small things that get you out the door when the anxiety is loud.' }).expect(201);
    expect(calm.body.data.crisis.flagged).toBe(false);
    const list = await request(app).get('/api/wellness/forums/anxiety').set(as('other')).expect(200);
    expect(list.body.data.posts[0].author.name).toBe('A member');
    expect(list.body.data.posts[0].author.id).toBeNull();
    await request(app).post('/api/wellness/forums/nope/posts').set(as('member')).send({ title: 'What helps?', body: 'Looking for the small things that get you out the door when it is loud.' }).expect(404);
    const support = await request(app).post('/api/wellness/forum-posts/p1/support').set(as('other')).expect(200);
    expect(support.body.data).toEqual({ supported: true, supportCount: 1 });
    await request(app).post('/api/wellness/forum-posts/p1/report').set(as('member')).send({ reason: 'SPAM' }).expect(400);
    await request(app).post('/api/wellness/forum-posts/p1/report').set(as('other')).send({ reason: 'SPAM' }).expect(201);
  });

  it('pages a long thread rather than stopping at the fiftieth reply', async () => {
    await request(app).post('/api/wellness/forums/anxiety/posts').set(as('member')).send({ title: 'The thread that ran for months', body: 'Long enough that the replies do not fit on one page, which is the whole point of this one.' }).expect(201);
    store.replies = Array.from({ length: 137 }, (_, i) => ({ id: `re${i + 1}`, postId: 'p1', authorId: 'other', isAnonymous: false, isFromModerator: false, isHidden: false, body: `Reply ${i + 1}`, createdAt: new Date(Date.UTC(2026, 8, 1, 0, i)), author: { id: 'other', firstName: 'Ana', lastName: 'M', displayName: null, avatar: null, role: 'USER', practitionerProfile: null } }));

    const first = await request(app).get('/api/wellness/forum-posts/p1').set(as('member')).expect(200);
    expect(first.body.data).toMatchObject({ replyPage: 1, replyLimit: 50, replyTotal: 137 });
    expect(first.body.data.replies).toHaveLength(50);
    expect(first.body.data.replies[0].body).toBe('Reply 1');
    // The newest replies were unreachable: the thread stopped at reply fifty
    // with no way to ask for the rest, so the last page has to come back.
    const last = await request(app).get('/api/wellness/forum-posts/p1').set(as('member')).query({ page: 3 }).expect(200);
    expect(last.body.data.replies).toHaveLength(37);
    expect(last.body.data.replies[36].body).toBe('Reply 137');
    // A fractional page or limit reached Prisma as a fractional skip or take,
    // which it refuses, so '?limit=7.5' turned a thread into a 500.
    const fractional = await request(app).get('/api/wellness/forum-posts/p1').set(as('member')).query({ page: '2.7', limit: '7.5' }).expect(200);
    expect(prisma.wellnessReply.findMany.mock.calls.at(-1)[0]).toMatchObject({ skip: 7, take: 7 });
    expect(fractional.body.data.replies.map((r: any) => r.body)).toEqual(['Reply 8', 'Reply 9', 'Reply 10', 'Reply 11', 'Reply 12', 'Reply 13', 'Reply 14']);
  });

  it('logs a habit, counts the streak and celebrates the milestone', async () => {
    const created = await request(app).post('/api/wellness/habits').set(as('member')).query({ today: TODAY }).send({ templateKey: 'walk-30' }).expect(201);
    expect(created.body.data.name).toBe('Walk for thirty minutes');
    expect(created.body.data.evidenceUrl).toMatch(/health.gov.au/);
    for (const d of ['2026-09-09', '2026-09-10']) await request(app).post(`/api/wellness/habits/${created.body.data.id}/log`).set(as('member')).query({ today: TODAY }).send({ day: d }).expect(201);
    const third = await request(app).post(`/api/wellness/habits/${created.body.data.id}/log`).set(as('member')).query({ today: TODAY }).send({}).expect(201);
    expect(third.body.data.streak.current).toBe(3);
    expect(third.body.data.milestone).toBe(3);
    expect(third.body.data.celebration).toMatch(/Three days/);
    await request(app).post(`/api/wellness/habits/${created.body.data.id}/log`).set(as('member')).query({ today: TODAY }).send({ day: '2026-09-20' }).expect(400);
    await request(app).post('/api/wellness/habits').set(as('member')).send({ templateKey: 'nope' }).expect(400);
  });

  it('books only a slot that is actually free, and shares the summary with the practitioner she chose', async () => {
    let day = '2026-09-14';
    while (new Date(`${day}T00:00:00Z`).getTime() < Date.now() + 3 * 86400000 || new Date(`${day}T00:00:00Z`).getUTCDay() !== 1) day = new Date(new Date(`${day}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);
    const slots = await request(app).get('/api/wellness/practitioners/pr1/slots').set(as('member')).query({ day }).expect(200);
    expect(slots.body.data.slots.map((s: any) => s.label)).toEqual(['09:00', '10:00', '11:00']);
    const wrong = zonedToUtc(day, '13:00', 'Australia/Brisbane').toISOString();
    await request(app).post('/api/wellness/practitioners/pr1/bookings').set(as('member')).send({ scheduledAt: wrong, mode: 'TELEHEALTH' }).expect(400);
    await request(app).post('/api/wellness/practitioners/pr1/bookings').set(as('member')).send({ scheduledAt: slots.body.data.slots[0].start, mode: 'IN_PERSON' }).expect(400);
    const booked = await request(app).post('/api/wellness/practitioners/pr1/bookings').set(as('member')).send({ scheduledAt: slots.body.data.slots[0].start, mode: 'TELEHEALTH', reason: 'Perimenopause questions', shareScope: ['checkins', 'cycle'] }).expect(201);
    expect(booked.body.data.booking.status).toBe('REQUESTED');
    expect(booked.body.data.booking.reason).toBe('Perimenopause questions');
    expect(prisma.healthBooking.create.mock.calls[0][0].data.reason).not.toContain('Perimenopause');
    expect(booked.body.data.share.scope).toEqual(['checkins', 'cycle']);
    expect(prisma.notification.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'doctor' }) }));
    await request(app).post('/api/wellness/practitioners/pr1/bookings').set(as('doctor')).send({ scheduledAt: slots.body.data.slots[1].start }).expect(400);
  });

  it('opens a live share link by token and refuses a dead one', async () => {
    const live = await request(app).get('/api/wellness/share/live').expect(200);
    expect(live.body.data.memberName).toBe('Mei Lin');
    expect(live.body.data.report.checkins).not.toBeNull();
    expect(live.body.data.report.cycle).toBeNull();
    expect(prisma.healthShare.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ openedCount: { increment: 1 } }) }));
    await request(app).get('/api/wellness/share/dead').expect(404);
    await request(app).get('/api/wellness/share/none').expect(404);
  });

  it('starts a circle, fills it, and keeps the meeting link to its members', async () => {
    const circle = await request(app).post('/api/wellness/circles').set(as('member')).query({ today: TODAY }).send({ name: 'Burnout, eight weeks', topic: 'burnout', description: 'Weekly check-ins for women coming back from the edge.', capacity: 3, startsOn: TODAY, meetingDay: 2, meetingTime: '19:00', meetingLink: 'https://meet.example.com/abc' }).expect(201);
    expect(circle.body.data.isFacilitator).toBe(true);
    expect(circle.body.data.status).toBe('RUNNING');
    expect(circle.body.data.meetingLink).toBe('https://meet.example.com/abc');
    const id = circle.body.data.id;
    const outsider = await request(app).get(`/api/wellness/circles/${id}`).set(as('other')).query({ today: TODAY }).expect(200);
    expect(outsider.body.data.meetingLink).toBeNull();
    expect(outsider.body.data.strategies.length).toBeGreaterThan(0);
    await request(app).post(`/api/wellness/circles/${id}/join`).set(as('other')).query({ today: TODAY }).expect(200);
    await request(app).post(`/api/wellness/circles/${id}/join`).set(as('third')).query({ today: TODAY }).expect(200);
    const full = await request(app).post(`/api/wellness/circles/${id}/join`).set(as('fourth')).query({ today: TODAY }).expect(400);
    expect(full.body.message ?? full.body.error).toMatch(/full/);
    await request(app).post(`/api/wellness/circles/${id}/join`).set(as('other')).query({ today: TODAY }).expect(400);
  });

  it('keeps the practice side to the practitioner who owns the profile', async () => {
    await request(app).get('/api/wellness/practice/bookings').set(as('member')).expect(404);
    const mine = await request(app).get('/api/wellness/practice').set(as('doctor')).expect(200);
    expect(mine.body.data.profile.slug).toBe('dr-k');
    await request(app).patch('/api/wellness/practice/bookings/b1').set(as('doctor')).send({ status: 'CONFIRMED' }).expect(404);
    await request(app).put('/api/wellness/practice').set(as('member')).send({ name: 'x', kind: 'SERVICE', headline: 'nope', bio: 'short' }).expect(400);
  });

  it('imports a file twice and keeps one copy, because a sourced record replaces its own earlier rows', async () => {
    const batch = { entries: [{ kind: 'ACTIVITY', day: '2026-09-10', payload: { type: 'other', minutes: 0, steps: 8200, source: 'apple-health' } }, { kind: 'SLEEP', day: '2026-09-10', payload: { hours: 7.2, source: 'apple-health' } }] };
    const first = await request(app).post('/api/wellness/entries/import').set(as('member')).query({ today: TODAY }).send(batch).expect(201);
    expect(first.body.data).toMatchObject({ imported: 2, failed: 0, replaced: 0 });
    const second = await request(app).post('/api/wellness/entries/import').set(as('member')).query({ today: TODAY }).send(batch).expect(201);
    expect(second.body.data).toMatchObject({ imported: 2, failed: 0, replaced: 1 });
    expect(store.entries.filter((e) => e.kind === 'ACTIVITY')).toHaveLength(1);
    expect(store.entries.filter((e) => e.kind === 'SLEEP')).toHaveLength(1);
    const typed = await request(app).post('/api/wellness/entries').set(as('member')).query({ today: TODAY }).send({ kind: 'ACTIVITY', payload: { type: 'walk', minutes: 0 } }).expect(400);
    expect(typed.body.message ?? typed.body.error).toMatch(/minute|step/);
  });

  it('marks a verified practitioner in the forums, and only when she is not anonymous', async () => {
    await request(app).post('/api/wellness/forums/anxiety/posts').set(as('doctor')).send({ title: 'What a GP actually does with a mental health plan', body: 'A plain explanation of the steps, the rebate and what to ask for at the appointment.' }).expect(201);
    await request(app).post('/api/wellness/forums/anxiety/posts').set(as('doctor')).send({ title: 'Speaking for myself for once', body: 'Some things I would rather say without the title attached, because I carry them too.', isAnonymous: true }).expect(201);
    const list = await request(app).get('/api/wellness/forums/anxiety').set(as('member')).expect(200);
    // First name alone: the legal surname is not shown to other members.
    expect(list.body.data.posts[0].author).toMatchObject({ isPractitioner: true, practitionerKind: 'GP', name: 'Kate' });
    expect(JSON.stringify(list.body.data.posts[0].author)).not.toContain('Lin');
    expect(list.body.data.posts[1].author).toMatchObject({ isPractitioner: false, practitionerKind: null, name: 'A member' });
    expect(list.body.data.viewer).toEqual({ hiddenWarnings: [], anonymousByDefault: false });
  });

  it('leaves the name off an anonymous share link', async () => {
    await request(app).post('/api/wellness/shares').set(as('member')).send({ scope: ['checkins'], anonymous: true }).expect(201);
    expect(prisma.healthShare.create.mock.calls[0][0].data.anonymous).toBe(true);
    const anon = await request(app).get('/api/wellness/share/anon').expect(200);
    expect(anon.body.data.memberName).toBe('A member');
    expect(anon.body.data.anonymous).toBe(true);
    const named = await request(app).get('/api/wellness/share/live').expect(200);
    expect(named.body.data.memberName).toBe('Mei Lin');
  });

  it('writes an appointment and a circle as calendar files, for the member only', async () => {
    const ics = await request(app).get('/api/wellness/bookings/b-ics/ics').set(as('member')).expect(200);
    expect(ics.headers['content-type']).toMatch(/text\/calendar/);
    expect(ics.text).toContain('DTSTART:20260915T230000Z');
    expect(ics.text).toContain('DURATION:PT50M');
    expect(ics.text).toContain('SUMMARY:Dr K\\, women\'s health (GP)');
    expect(ics.text).toContain('URL:https://meet.example.com/x');
    await request(app).get('/api/wellness/bookings/b-ics/ics').set(as('other')).expect(404);
    const circle = await request(app).post('/api/wellness/circles').set(as('member')).query({ today: TODAY }).send({ name: 'Grief, gently', topic: 'grief', description: 'Eight weeks of walking beside each other, one evening a week.', startsOn: TODAY, meetingDay: 3, meetingTime: '19:30' }).expect(201);
    const series = await request(app).get(`/api/wellness/circles/${circle.body.data.id}/ics`).set(as('member')).expect(200);
    expect(series.text).toContain('RRULE:FREQ=WEEKLY;COUNT=8');
    expect(series.text).toContain('DTSTART:20260916T193000');
    expect(series.text).toContain('SUMMARY:Grief\\, gently (support circle)');
    await request(app).get('/api/wellness/circles/nope/ics').set(as('member')).expect(404);
  });

  it('shows the wellness badges with the earned ones first', async () => {
    const res = await request(app).get('/api/wellness/badges').set(as('member')).expect(200);
    expect(res.body.data.total).toBe(8);
    expect(res.body.data.earned).toBe(1);
    expect(res.body.data.badges[0]).toMatchObject({ id: 'first_checkin', earned: true });
    expect(res.body.data.badges.some((b: any) => b.id === 'first_post')).toBe(false);
  });

  it('lets a moderator, and only a moderator, take a review out of the average', async () => {
    await request(app).patch('/api/wellness/reviews/r1').set(as('member')).send({ isHidden: true }).expect(403);
    const res = await request(app).patch('/api/wellness/reviews/r1').set(as('mod', 'MODERATOR')).send({ isHidden: true }).expect(200);
    expect(res.body.data).toEqual({ id: 'r1', isHidden: true });
    // The five is out, so the average is the four and the three that are left:
    // what the aggregate the route asks the database for implies, rather than
    // a number the mock was told to hand back whatever happened.
    expect(prisma.healthReview.aggregate).toHaveBeenCalledWith(expect.objectContaining({ where: { practitionerId: 'pr1', isHidden: false } }));
    expect(prisma.healthPractitioner.update).toHaveBeenCalledWith(expect.objectContaining({ data: { ratingAvg: 3.5, ratingCount: 2 } }));
    await request(app).patch('/api/wellness/reviews/none').set(as('mod', 'MODERATOR')).send({ isHidden: true }).expect(404);
  });

  it('says when a bookable practitioner is next free, and filters on booking here', async () => {
    const res = await request(app).get('/api/wellness/practitioners').set(as('member')).query({ acceptsBookings: 'true', language: 'english' }).expect(200);
    expect(res.body.data.practitioners[0].slug).toBe('dr-k');
    expect(res.body.data.practitioners[0].nextFree).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const where = prisma.healthPractitioner.findMany.mock.calls[0][0].where;
    expect(where.acceptsBookings).toBe(true);
    expect(where.languages.hasSome).toContain('English');
  });

  describe('crisis language, on every surface a woman writes on', () => {
    const CRISIS = 'Some nights I do not want to be alive and I cannot go on like this.';
    const CALM = 'What helped me most was a walk before the school run, and a friend on the phone.';
    const flagData = () => prisma.adminFlag.create.mock.calls.map((c: any) => c[0].data);

    // A thread for the replies and edits below, written by 'member' and calm.
    const calmPost = () => request(app).post('/api/wellness/forums/anxiety/posts').set(as('member')).send({ title: 'What helps on a bad morning?', body: 'Looking for the small things that get you out the door when the anxiety is loud.' }).expect(201);

    // The lines she is shown are chosen by key, so 1800RESPECT is among them and
    // 000 comes first; this is what the compact strip prints.
    const expectLines = (crisis: any) => {
      expect(crisis.flagged).toBe(true);
      expect(crisis.lines.slice(0, 3).map((l: any) => l.key)).toEqual(['emergency', 'lifeline', '1800respect']);
      expect(crisis.lines.find((l: any) => l.key === '1800respect').phone).toBe('1800 737 732');
    };

    it('raises a safety concern for a reply, tells the admins without her words, and shows her the lines', async () => {
      await calmPost();

      const res = await request(app).post('/api/wellness/forum-posts/p1/replies').set(as('other')).send({ body: CRISIS, isAnonymous: true }).expect(201);

      expectLines(res.body.data.crisis);
      expect(res.body.data.crisis.message).toContain('a moderator has been told');
      const [flag] = flagData();
      expect(flag).toMatchObject({ userId: 'other', type: 'SAFETY_CONCERN', severity: 'HIGH', flaggedById: 'system' });
      expect(flag.reason).toContain('forum reply');
      // Where it was and the phrases that matched, and none of the rest of what she wrote.
      expect(flag.notes).toMatch(/^forum reply re1\. Matched: /);
      expect(flag.notes).toContain('cannot go on');
      expect(flag.notes).not.toContain('school');
      expect(prisma.notification.createMany).toHaveBeenCalledTimes(1);
      const told = prisma.notification.createMany.mock.calls[0][0].data[0];
      expect(told).toMatchObject({ userId: 'admin-1', link: '/admin/moderation#safety-concerns' });
      expect(JSON.stringify(told)).not.toMatch(/cannot go on|alive|other/);
    });

    it('does not tell her a moderator has been told when the flag could not be written, and still shows her the lines', async () => {
      await calmPost();
      prisma.adminFlag.create.mockRejectedValueOnce(new Error('table refused the write'));

      const res = await request(app).post('/api/wellness/forum-posts/p1/replies').set(as('other')).send({ body: CRISIS }).expect(201);

      // Her reply is up and the lines reach her; what she is not given is a sentence that is not so.
      expectLines(res.body.data.crisis);
      expect(res.body.data.crisis.message).not.toMatch(/moderator has been told/);
      expect(res.body.data.reply.body).toBe(CRISIS);
      // No flag, so nobody was rung either.
      expect(prisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('does not screen what a moderator writes in reply: naming suicide to help is not a concern about the moderator', async () => {
      await calmPost();

      const res = await request(app).post('/api/wellness/forum-posts/p1/replies').set(as('mod', 'MODERATOR')).send({ body: 'I am so sorry. If you are thinking about suicide, please call Lifeline on 13 11 14 now.' }).expect(201);

      expect(res.body.data.crisis).toEqual({ flagged: false });
      expect(prisma.adminFlag.create).not.toHaveBeenCalled();
      expect(prisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('raises nothing, and adds no lines, for a reply that is calm', async () => {
      await calmPost();
      const res = await request(app).post('/api/wellness/forum-posts/p1/replies').set(as('other')).send({ body: CALM }).expect(201);
      expect(res.body.data.crisis).toEqual({ flagged: false });
      expect(prisma.adminFlag.create).not.toHaveBeenCalled();
    });

    it('screens an edit to a post as it screened the post, and marks the post', async () => {
      await calmPost();

      const calmEdit = await request(app).patch('/api/wellness/forum-posts/p1').set(as('member')).send({ body: 'Looking for the small things that get you out the door when it is loud.' }).expect(200);
      expect(calmEdit.body.data.crisis).toEqual({ flagged: false });
      expect(prisma.adminFlag.create).not.toHaveBeenCalled();

      const res = await request(app).patch('/api/wellness/forum-posts/p1').set(as('member')).send({ body: `${CRISIS} Nobody knows how bad it has got.` }).expect(200);

      expectLines(res.body.data.crisis);
      expect(flagData()).toHaveLength(1);
      expect(flagData()[0]).toMatchObject({ userId: 'member', reason: expect.stringContaining('forum post edit') });
      expect(flagData()[0].notes).toMatch(/^forum post edit p1/);
      expect(prisma.wellnessPost.update.mock.calls.at(-1)[0].data.crisisFlagged).toBe(true);
    });

    it('does not screen, or flag its author, when a moderator hides or pins a post', async () => {
      await request(app).post('/api/wellness/forums/anxiety/posts').set(as('member')).send({ title: 'I do not know what to do', body: `${CRISIS} I do not know who to tell about any of it.` }).expect(201);
      prisma.adminFlag.create.mockClear();

      const res = await request(app).patch('/api/wellness/forum-posts/p1').set(as('mod', 'MODERATOR')).send({ isHidden: true, isPinned: true }).expect(200);

      expect(res.body.data.crisis).toEqual({ flagged: false });
      expect(prisma.adminFlag.create).not.toHaveBeenCalled();
    });

    it('screens an edit to a reply, and only the author\'s own words', async () => {
      await calmPost();
      store.replies = [{ id: 're1', postId: 'p1', authorId: 'other', isAnonymous: false, isFromModerator: false, isHidden: false, body: 'Hello', createdAt: new Date() }];

      const res = await request(app).patch('/api/wellness/forum-replies/re1').set(as('other')).send({ body: CRISIS }).expect(200);
      expectLines(res.body.data.crisis);
      expect(flagData()[0]).toMatchObject({ userId: 'other' });
      expect(flagData()[0].notes).toMatch(/^forum reply edit re1/);

      prisma.adminFlag.create.mockClear();
      const hidden = await request(app).patch('/api/wellness/forum-replies/re1').set(as('mod', 'MODERATOR')).send({ isHidden: true }).expect(200);
      expect(hidden.body.data.crisis).toEqual({ flagged: false });
      expect(prisma.adminFlag.create).not.toHaveBeenCalled();
    });

    describe('a support circle', () => {
      const circleBody = { name: 'Burnout, eight weeks', topic: 'burnout', description: 'Weekly check-ins for women coming back from the edge.', startsOn: TODAY, meetingDay: 2, meetingTime: '19:00' };

      it('screens a check-in, which the circle reads and staff cannot', async () => {
        const circle = await request(app).post('/api/wellness/circles').set(as('member')).query({ today: TODAY }).send(circleBody).expect(201);
        expect(circle.body.data.crisis).toEqual({ flagged: false });
        const id = circle.body.data.id;

        const calm = await request(app).post(`/api/wellness/circles/${id}/check-ins`).set(as('member')).query({ today: TODAY }).send({ mood: 3, wins: 'Got out for a walk', blockers: 'Tired', nextStep: 'Call Mum' }).expect(201);
        expect(calm.body.data.crisis).toEqual({ flagged: false });
        expect(prisma.adminFlag.create).not.toHaveBeenCalled();

        const res = await request(app).post(`/api/wellness/circles/${id}/check-ins`).set(as('member')).query({ today: TODAY }).send({ mood: 1, wins: 'None', blockers: CRISIS, nextStep: 'Nothing' }).expect(201);

        expectLines(res.body.data.crisis);
        expect(res.body.data).toMatchObject({ mood: 1, week: 1 });
        expect(flagData()).toHaveLength(1);
        expect(flagData()[0]).toMatchObject({ userId: 'member', type: 'SAFETY_CONCERN', severity: 'HIGH' });
        expect(flagData()[0].notes).toMatch(/^support circle check-in ci1\. Matched: /);
      });

      it('screens the name and description of a circle, when it is made and when its facilitator changes it', async () => {
        const made = await request(app).post('/api/wellness/circles').set(as('member')).query({ today: TODAY }).send({ ...circleBody, description: `A place to say it plainly: ${CRISIS}` }).expect(201);
        expectLines(made.body.data.crisis);
        expect(flagData()).toHaveLength(1);
        expect(flagData()[0].notes).toMatch(/^support circle name or description c1/);

        prisma.adminFlag.create.mockClear();
        const changed = await request(app).patch(`/api/wellness/circles/${made.body.data.id}`).set(as('member')).query({ today: TODAY }).send({ description: 'A calmer description than the first one was.' }).expect(200);
        expect(changed.body.data.crisis).toEqual({ flagged: false });
        expect(prisma.adminFlag.create).not.toHaveBeenCalled();

        const again = await request(app).patch(`/api/wellness/circles/${made.body.data.id}`).set(as('member')).query({ today: TODAY }).send({ description: CRISIS + ' Please come anyway.' }).expect(200);
        expectLines(again.body.data.crisis);
        expect(flagData()).toHaveLength(1);

        // A moderator editing it is not the woman who wrote it, and is not flagged for it.
        prisma.adminFlag.create.mockClear();
        const byMod = await request(app).patch(`/api/wellness/circles/${made.body.data.id}`).set(as('mod', 'MODERATOR')).query({ today: TODAY }).send({ isFeatured: true, description: CRISIS }).expect(200);
        expect(byMod.body.data.crisis).toEqual({ flagged: false });
        expect(prisma.adminFlag.create).not.toHaveBeenCalled();
      });
    });

    describe('what is private to her', () => {
      it('shows the lines for a mental load task and says nobody has been told, and flags nobody', async () => {
        const res = await request(app).post('/api/wellness/mental-load').set(as('member')).query({ today: TODAY }).send({ category: 'PLANNING', task: 'Planning my own funeral so nobody else has to, I cannot go on', minutes: 30 }).expect(201);

        expectLines(res.body.data.crisis);
        // The qualifier is load-bearing: a practitioner share link with the
        // mental-load scope lists the tasks she logged, this one included.
        expect(res.body.data.crisis.message).toContain('shown to nobody but you unless you share it');
        expect(res.body.data.crisis.message).toContain('nobody has been told');
        // A task is stored as she typed it, and a note is opened by the server
        // to show it to her, so "only you can read it" is a promise neither keeps.
        expect(res.body.data.crisis.message).not.toMatch(/only you can read/i);
        expect(prisma.adminFlag.create).not.toHaveBeenCalled();
        expect(prisma.notification.createMany).not.toHaveBeenCalled();
        // The row is stored as she wrote it.
        expect(prisma.mentalLoadEntry.create.mock.calls[0][0].data.task).toContain('funeral');

        const calm = await request(app).post('/api/wellness/mental-load').set(as('member')).query({ today: TODAY }).send({ category: 'PLANNING', task: 'School forms and the dinner plan', minutes: 30 }).expect(201);
        expect(calm.body.data.crisis).toEqual({ flagged: false });
      });

      it('shows the lines for a daily check-in note, on the day and when she edits it, and flags nobody', async () => {
        const res = await request(app).post('/api/wellness/entries').set(as('member')).query({ today: TODAY }).send({ kind: 'CHECKIN', payload: { mood: 1, stress: 5, anxiety: 5, energy: 1, note: CRISIS } }).expect(201);
        expectLines(res.body.data.crisis);
        expect(res.body.data.crisis.message).toContain('nobody has been told');
        expect(res.body.data.entry.payload.note).toBe(CRISIS);

        const calm = await request(app).post('/api/wellness/entries').set(as('member')).query({ today: TODAY }).send({ kind: 'SLEEP', payload: { hours: 6, note: 'Woke twice' } }).expect(201);
        expect(calm.body.data.crisis).toEqual({ flagged: false });

        const edited = await request(app).patch(`/api/wellness/entries/${res.body.data.entry.id}`).set(as('member')).send({ payload: { mood: 1, stress: 5, anxiety: 5, energy: 1, note: 'I wish I was dead' } }).expect(200);
        expectLines(edited.body.data.crisis);

        expect(prisma.adminFlag.create).not.toHaveBeenCalled();
        expect(prisma.notification.createMany).not.toHaveBeenCalled();
      });

      it('sends the lines with the mental load so the page can show them beside a burnout level of high', async () => {
        const res = await request(app).get('/api/wellness/mental-load').set(as('member')).query({ today: TODAY }).expect(200);
        expect(res.body.data.crisisLines.slice(0, 3).map((l: any) => l.key)).toEqual(['emergency', 'lifeline', '1800respect']);
        expect(res.body.data.analysis.burnout).toBeDefined();
      });
    });

    describe('reporting a post or a reply', () => {
      const intake = jest.requireActual('../../services/content-report.service') as typeof import('../../services/content-report.service');

      it('goes through the same intake as every other report: a reference, a priority, a clock and an alert', async () => {
        await calmPost();
        const consequences = jest.spyOn(intake, 'runReportIntakeConsequences').mockResolvedValue(undefined);

        const res = await request(app).post('/api/wellness/forum-posts/p1/report').set(as('other')).send({ reason: 'SELF_HARM', description: 'She says she cannot go on' }).expect(201);

        const row = prisma.contentReport.create.mock.calls[0][0].data;
        expect(row).toMatchObject({ reporterId: 'other', contentType: 'WELLNESS_POST', contentId: 'p1', reportedUserId: 'member', reason: 'self_harm', status: 'PENDING', priority: 'URGENT' });
        // Harmful content is reviewed within 48 hours and the most urgent within 24;
        // a report of self-harm runs on the shorter clock, and the deadline is stamped.
        const hoursToDeadline = (row.reviewDeadline.getTime() - Date.now()) / 3_600_000;
        expect(hoursToDeadline).toBeGreaterThan(23);
        expect(hoursToDeadline).toBeLessThanOrEqual(24);
        expect(row.evidence.reviewHours).toBe(24);
        expect(row.evidence).toMatchObject({ ticketId: expect.stringMatching(/^RPT-/), source: 'WELLNESS_FORUM_REPORT', reportedAs: 'SELF_HARM', priority: 'critical' });
        expect(res.body.data).toMatchObject({ id: 'r1', reference: row.evidence.ticketId });
        expect(consequences).toHaveBeenCalledWith(expect.objectContaining({ ticketId: row.evidence.ticketId, reason: 'self_harm', priority: 'critical', contentType: 'WELLNESS_POST', contentId: 'p1', isUrgent: true }));
        consequences.mockRestore();
      });

      // A forum report counts towards the reported member's safety score like a
      // report from the report button: it was the one door that did not. (What the
      // score does with it, and that a self-harm report records nothing against
      // her, is the score service's own suite.)
      it('is handed to the safety score, as a report from any other door is', async () => {
        await calmPost();
        const consequences = jest.spyOn(intake, 'runReportIntakeConsequences').mockResolvedValue(undefined);

        await request(app).post('/api/wellness/forum-posts/p1/report').set(as('other')).send({ reason: 'HARASSMENT' }).expect(201);

        expect(handleUserReport).toHaveBeenCalledWith('member', 'other', 'harassment', 'p1', 'wellness_post');
        consequences.mockRestore();
      });

      it('is still filed when the safety score cannot be written', async () => {
        await calmPost();
        const consequences = jest.spyOn(intake, 'runReportIntakeConsequences').mockResolvedValue(undefined);
        handleUserReport.mockRejectedValueOnce(new Error('score unavailable'));

        const res = await request(app).post('/api/wellness/forum-posts/p1/report').set(as('other')).send({ reason: 'SPAM' }).expect(201);

        expect(res.body.data.reference).toMatch(/^RPT-/);
        consequences.mockRestore();
      });

      it('rates spam as the lowest priority and a harassment report as it rates it elsewhere', async () => {
        await calmPost();
        const consequences = jest.spyOn(intake, 'runReportIntakeConsequences').mockResolvedValue(undefined);

        await request(app).post('/api/wellness/forum-posts/p1/report').set(as('other')).send({ reason: 'SPAM' }).expect(201);
        await request(app).post('/api/wellness/forum-posts/p1/report').set(as('other')).send({ reason: 'INAPPROPRIATE' }).expect(201);
        await request(app).post('/api/wellness/forum-posts/p1/report').set(as('other')).send({ reason: 'HATE_SPEECH' }).expect(201);

        const rows = prisma.contentReport.create.mock.calls.map((c: any) => c[0].data);
        expect(rows.map((r: any) => [r.reason, r.priority])).toEqual([['spam', 'NORMAL'], ['other', 'NORMAL'], ['hate_speech', 'HIGH']]);
        expect(rows.map((r: any) => r.evidence.reviewHours)).toEqual([48, 48, 48]);
        // What she picked is kept, since two of her choices read as the same reason in the queue.
        expect(rows[1].evidence.reportedAs).toBe('INAPPROPRIATE');
        consequences.mockRestore();
      });

      it('refuses a reason that is not one of the choices, and her own post', async () => {
        await calmPost();
        await request(app).post('/api/wellness/forum-posts/p1/report').set(as('other')).send({ reason: 'BORED' }).expect(400);
        await request(app).post('/api/wellness/forum-posts/p1/report').set(as('member')).send({ reason: 'SPAM' }).expect(400);
        expect(prisma.contentReport.create).not.toHaveBeenCalled();
      });

      it('can be filed on a reply, which had no way to be reported', async () => {
        await calmPost();
        store.replies = [{ id: 're1', postId: 'p1', authorId: 'other', isAnonymous: true, isFromModerator: false, isHidden: false, body: 'You should just stop talking about it', createdAt: new Date() }];
        const consequences = jest.spyOn(intake, 'runReportIntakeConsequences').mockResolvedValue(undefined);

        const res = await request(app).post('/api/wellness/forum-replies/re1/report').set(as('member')).send({ reason: 'HARASSMENT', description: 'Unkind to a woman who is struggling' }).expect(201);

        expect(prisma.contentReport.create.mock.calls[0][0].data).toMatchObject({ contentType: 'WELLNESS_REPLY', contentId: 're1', reportedUserId: 'other', reason: 'harassment', status: 'PENDING' });
        expect(res.body.data.reference).toMatch(/^RPT-/);
        expect(consequences).toHaveBeenCalledWith(expect.objectContaining({ contentType: 'WELLNESS_REPLY', contentId: 're1' }));

        await request(app).post('/api/wellness/forum-replies/re1/report').set(as('other')).send({ reason: 'SPAM' }).expect(400);
        await request(app).post('/api/wellness/forum-replies/nope/report').set(as('member')).send({ reason: 'SPAM' }).expect(404);
        consequences.mockRestore();
      });
    });
  });

});
