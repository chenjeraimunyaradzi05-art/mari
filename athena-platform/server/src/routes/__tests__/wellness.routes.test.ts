import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const store: { entries: any[]; settings: any; posts: any[]; habits: any[]; logs: any[]; circles: any[]; members: any[] } = { entries: [], settings: null, posts: [], habits: [], logs: [], circles: [], members: [] };

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(async () => ({ timezone: 'Australia/Brisbane' })), findMany: jest.fn(async ({ where }: any) => (where?.id?.in ?? []).map((id: string) => ({ id, timezone: 'Australia/Brisbane' }))), update: jest.fn(async () => ({})), count: jest.fn(async () => 1) },
    healthSettings: {
      findUnique: jest.fn(async () => store.settings),
      create: jest.fn(async ({ data }: any) => { store.settings = { id: 's1', cycleLengthHint: null, periodLengthHint: null, hiddenWarnings: [], anonymousByDefault: false, checkInReminderHour: null, shareWithPractitioners: true, ...data }; return store.settings; }),
      update: jest.fn(async ({ data }: any) => { store.settings = { ...store.settings, ...data }; return store.settings; }),
      findMany: jest.fn(async () => []), deleteMany: jest.fn(async () => ({ count: 1 })),
    },
    healthEntry: {
      findMany: jest.fn(async ({ where }: any) => store.entries.filter((e) => !where?.kind || (typeof where.kind === 'string' ? e.kind === where.kind : where.kind.in.includes(e.kind)))),
      findFirst: jest.fn(async ({ where }: any) => store.entries.find((e) => e.kind === where.kind && e.day.getTime() === where.day.getTime()) ?? null),
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
      update: jest.fn(async ({ where, data }: any) => { const row = store.posts.find((p) => p.id === where.id); Object.assign(row, { supportCount: row.supportCount + (data.supportCount?.increment ?? 0) - (data.supportCount?.decrement ?? 0) }); return row; }),
    },
    wellnessReply: { findMany: jest.fn(async () => []) },
    wellnessSupport: { findMany: jest.fn(async () => []), findFirst: jest.fn(async () => null), findUnique: jest.fn(async () => null), create: jest.fn(async () => ({})), delete: jest.fn() },
    adminFlag: { create: jest.fn(async () => ({})) },
    contentReport: { create: jest.fn(async ({ data }: any) => ({ id: 'r1', status: 'PENDING', ...data })) },
    notification: { create: jest.fn(async () => ({})), findMany: jest.fn(async () => []) },
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
    },
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
    healthReview: { findMany: jest.fn(async () => [{ rating: 5, isHidden: true }, { rating: 3, isHidden: false }]), findUnique: jest.fn(async ({ where }: any) => (where.id === 'r1' ? { id: 'r1', practitionerId: 'pr1' } : null)), update: jest.fn(async ({ where, data }: any) => ({ id: where.id, isHidden: data.isHidden })) },
    article: { findMany: jest.fn(async () => []) },
    $transaction: jest.fn(async (ops: any[]) => Promise.all(ops)),
  },
}));

const practitioner = { id: 'pr1', slug: 'dr-k', name: 'Dr K', kind: 'GP', headline: 'A women\'s health GP', bio: 'Bio', qualifications: [], modalities: [], specialties: ['Menopause'], languages: ['English'], suburb: null, city: 'Brisbane', state: 'QLD', telehealth: true, inPerson: false, bulkBilling: false, medicareRebate: true, privateHealth: false, feeFrom: null, feeNote: null, ahpraNumber: null, website: null, phone: null, bookingUrl: null, availability: { '1': [['09:00', '12:00']], '2': [['09:00', '12:00']], '3': [['09:00', '12:00']], '4': [['09:00', '12:00']], '5': [['09:00', '12:00']] }, slotMinutes: 60, acceptsBookings: true, ownerUserId: 'doctor', isVerified: true, isActive: true, ratingAvg: 0, ratingCount: 0 };

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
    store.entries = []; store.settings = null; store.posts = []; store.habits = []; store.logs = []; store.circles = []; store.members = [];
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
    expect(list.body.data.posts[0].author).toMatchObject({ isPractitioner: true, practitionerKind: 'GP', name: 'Kate Lin' });
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
    expect(prisma.healthPractitioner.update).toHaveBeenCalledWith(expect.objectContaining({ data: { ratingAvg: 3, ratingCount: 1 } }));
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
});
