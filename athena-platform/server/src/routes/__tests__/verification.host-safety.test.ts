import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * The host employer safety attestation.
 *
 * An organisation may place apprentices through ATHENA only while it is verified
 * AND holds an approved, unexpired attestation. These tests cover the second
 * half: who may send one, what it has to say, what staff decide, and what the
 * decision leaves behind. Nothing here collects an individual's police or
 * background check, and one test says so by looking for the field.
 */

jest.mock('../../utils/prisma', () => {
  const prisma: any = {
    organizationMember: { findUnique: jest.fn(), findMany: jest.fn(async () => []) },
    organization: { findUnique: jest.fn(), update: jest.fn(async () => ({})) },
    hostEmployerSafetyAttestation: {
      findFirst: jest.fn(async () => null),
      findUnique: jest.fn(),
      findMany: jest.fn(async () => []),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    user: { findMany: jest.fn(async () => []) },
    notification: { create: jest.fn(async () => ({})) },
    auditLog: { create: jest.fn(async () => ({})) },
  };
  prisma.$transaction = jest.fn(async (work: any) => (Array.isArray(work) ? Promise.all(work) : work(prisma)));
  return { prisma };
});

// A signed-in principal is named by two headers; without them the caller is anonymous.
jest.mock('../../middleware/auth', () => {
  const principal = (req: any) =>
    req.headers['x-test-user'] ? { id: req.headers['x-test-user'], role: req.headers['x-test-role'] || 'USER', email: 'x@athena.com' } : null;
  return {
    authenticate: (req: any, res: any, next: any) => {
      const user = principal(req);
      if (!user) return res.status(401).json({ success: false, message: 'No token provided' });
      req.user = user;
      next();
    },
    optionalAuth: (req: any, _res: any, next: any) => {
      const user = principal(req);
      if (user) req.user = user;
      next();
    },
    requireRole:
      (...roles: string[]) =>
      (req: any, res: any, next: any) => {
        if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ success: false, message: 'Insufficient permissions' });
        next();
      },
    requirePremium: (_req: any, _res: any, next: any) => next(),
  };
});

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// The register: configured or not, and what it answers, are set per test.
let abrConfigured = false;
const lookupAbn = jest.fn<(abn: string) => Promise<unknown>>();
jest.mock('../../services/abr.service', () => ({
  ...(jest.requireActual('../../services/abr.service') as object),
  isConfigured: () => abrConfigured,
  lookupAbn: (abn: string) => lookupAbn(abn),
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { HOST_SAFETY_QUESTIONS } from '../../services/host-safety.service';

const prisma: any = prismaTyped;
const DAY = 24 * 60 * 60 * 1000;
const as = (userId: string, role = 'USER') => ({ 'x-test-user': userId, 'x-test-role': role });
const ORG = { id: 'org-1', name: 'Brisbane Builders', isVerified: true, abn: null };
const VALID_ABN = '51 824 753 556';

const member = (role: string, acceptedAt: Date | null = new Date()) => ({ role, acceptedAt, organization: ORG });

/** Every statement affirmed. */
const allYes = () => Object.fromEntries(HOST_SAFETY_QUESTIONS.map((q) => [q.id, true]));

const attestation = (over: Record<string, unknown> = {}) => ({
  id: 'att-1',
  organizationId: 'org-1',
  version: 1,
  answers: allYes(),
  safetyContactName: 'Sam Carter',
  safetyContactEmail: 'safety@builders.example',
  safetyContactPhone: null,
  abn: '51824753556',
  abnCheck: { lookup: 'NOT_CONFIGURED', abn: '51824753556', checkedAt: '2026-10-01T00:00:00.000Z' },
  attestedById: 'owner-1',
  attestedAt: new Date(Date.now() - 2 * DAY),
  status: 'PENDING',
  reviewedById: null,
  reviewedAt: null,
  reviewNote: null,
  expiresAt: null,
  ...over,
});

const submission = (over: Record<string, unknown> = {}) => ({
  answers: allYes(),
  safetyContactName: 'Sam Carter',
  safetyContactEmail: 'safety@builders.example',
  abn: VALID_ABN,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  abrConfigured = false;
  prisma.organizationMember.findUnique.mockResolvedValue(null);
  prisma.organizationMember.findMany.mockResolvedValue([]);
  prisma.organization.findUnique.mockResolvedValue({ ...ORG, name: ORG.name });
  prisma.hostEmployerSafetyAttestation.findFirst.mockResolvedValue(null);
  prisma.hostEmployerSafetyAttestation.findMany.mockResolvedValue([]);
  prisma.hostEmployerSafetyAttestation.updateMany.mockResolvedValue({ count: 1 });
  prisma.hostEmployerSafetyAttestation.create.mockImplementation(async ({ data }: any) => ({ id: 'att-new', ...data }));
  prisma.hostEmployerSafetyAttestation.update.mockImplementation(async ({ data }: any) => ({ ...attestation(), ...data }));
  prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);
});

describe('GET /api/verification/host-safety/:orgId', () => {
  it('is for the organisation’s own team, and to anyone else it does not exist', async () => {
    await request(app).get('/api/verification/host-safety/org-1').expect(401);
    // Not a member, and a member who has not answered the invitation.
    await request(app).get('/api/verification/host-safety/org-1').set(as('stranger')).expect(404);
    prisma.organizationMember.findUnique.mockResolvedValue(member('OWNER', null));
    await request(app).get('/api/verification/host-safety/org-1').set(as('invitee')).expect(404);
  });

  it('gives the statements, where the organisation stands, and whether this member may send the attestation', async () => {
    prisma.organizationMember.findUnique.mockResolvedValue(member('OWNER'));
    const owner = await request(app).get('/api/verification/host-safety/org-1').set(as('owner-1')).expect(200);

    expect(owner.body.data.questions).toHaveLength(HOST_SAFETY_QUESTIONS.length);
    expect(owner.body.data.questions[0]).toEqual({ id: expect.any(String), statement: expect.any(String) });
    expect(owner.body.data).toMatchObject({ mayAttest: true, canSubmit: true, mayPlaceApprentices: false, attestation: { standing: 'NONE' } });

    prisma.organizationMember.findUnique.mockResolvedValue(member('RECRUITER'));
    const recruiter = await request(app).get('/api/verification/host-safety/org-1').set(as('recruiter-1')).expect(200);
    expect(recruiter.body.data).toMatchObject({ mayAttest: false, canSubmit: false });
  });

  it('says the organisation may place apprentices only when it is verified AND the approval has not run out', async () => {
    prisma.organizationMember.findUnique.mockResolvedValue(member('OWNER'));
    const standing = (isVerified: boolean, expiresAt: Date) => {
      prisma.organizationMember.findUnique.mockResolvedValue({ role: 'OWNER', acceptedAt: new Date(), organization: { ...ORG, isVerified } });
      const row = attestation({ status: 'APPROVED', reviewedAt: new Date(), expiresAt });
      // The latest attestation, and the question of whether an approval stands,
      // are two reads; the second filters on the end date as the database does.
      prisma.hostEmployerSafetyAttestation.findFirst.mockImplementation(async ({ where }: any) =>
        where.expiresAt?.gt ? (expiresAt.getTime() > where.expiresAt.gt.getTime() ? row : null) : row
      );
    };
    const ask = async () => (await request(app).get('/api/verification/host-safety/org-1').set(as('owner-1')).expect(200)).body.data;

    standing(true, new Date(Date.now() + 100 * DAY));
    expect(await ask()).toMatchObject({ mayPlaceApprentices: true, attestation: { standing: 'APPROVED', canSubmit: false } });
    standing(false, new Date(Date.now() + 100 * DAY));
    expect(await ask()).toMatchObject({ mayPlaceApprentices: false });
    standing(true, new Date(Date.now() - DAY));
    expect(await ask()).toMatchObject({ mayPlaceApprentices: false, attestation: { standing: 'EXPIRED', canSubmit: true } });
  });

  it('does not say the organisation cannot place apprentices because a renewal is waiting or was refused beside an approval that still stands', async () => {
    prisma.organizationMember.findUnique.mockResolvedValue(member('OWNER'));
    const renewal = attestation({ id: 'att-renewal', status: 'PENDING' });
    prisma.hostEmployerSafetyAttestation.findFirst.mockImplementation(async ({ where }: any) => (where.status === 'APPROVED' ? { id: 'att-old' } : renewal));

    const res = await request(app).get('/api/verification/host-safety/org-1').set(as('owner-1')).expect(200);

    expect(res.body.data).toMatchObject({ mayPlaceApprentices: true, attestation: { standing: 'PENDING' } });
  });

  it('shows staff any organisation, with or without membership', async () => {
    await request(app).get('/api/verification/host-safety/org-1').set(as('staff-1', 'ADMIN')).expect(200);
    prisma.organization.findUnique.mockResolvedValue(null);
    await request(app).get('/api/verification/host-safety/missing').set(as('staff-1', 'ADMIN')).expect(404);
  });
});

describe('POST /api/verification/host-safety/:orgId', () => {
  beforeEach(() => {
    prisma.organizationMember.findUnique.mockResolvedValue(member('OWNER'));
  });

  it('is for an owner or admin of the organisation and for no one else', async () => {
    await request(app).post('/api/verification/host-safety/org-1').send(submission()).expect(401);

    prisma.organizationMember.findUnique.mockResolvedValue(null);
    await request(app).post('/api/verification/host-safety/org-1').set(as('stranger')).send(submission()).expect(404);

    prisma.organizationMember.findUnique.mockResolvedValue(member('OWNER', null));
    await request(app).post('/api/verification/host-safety/org-1').set(as('invitee')).send(submission()).expect(404);

    for (const role of ['RECRUITER', 'VIEWER']) {
      prisma.organizationMember.findUnique.mockResolvedValue(member(role));
      await request(app).post('/api/verification/host-safety/org-1').set(as('someone')).send(submission()).expect(403);
    }
    prisma.organizationMember.findUnique.mockResolvedValue(member('ADMIN'));
    await request(app).post('/api/verification/host-safety/org-1').set(as('admin-member')).send(submission()).expect(201);

    expect(prisma.hostEmployerSafetyAttestation.create).toHaveBeenCalledTimes(1);
  });

  it('writes a waiting attestation, with the ABN as digits, who sent it, and the ABR answer it could not get', async () => {
    const res = await request(app).post('/api/verification/host-safety/org-1').set(as('owner-1')).send(submission()).expect(201);

    const data = prisma.hostEmployerSafetyAttestation.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      organizationId: 'org-1',
      status: 'PENDING',
      version: 1,
      safetyContactName: 'Sam Carter',
      safetyContactEmail: 'safety@builders.example',
      abn: '51824753556',
      attestedById: 'owner-1',
      abnCheck: { lookup: 'NOT_CONFIGURED', abn: '51824753556' },
    });
    expect(data.answers).toEqual(allYes());
    expect(res.body.data).toMatchObject({ standing: 'PENDING', canSubmit: false });
    // The member's own submission is in the audit log under their name.
    expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({ actorUserId: 'owner-1' });
  });

  it('tells staff it is waiting, with the link to the queue', async () => {
    await request(app).post('/api/verification/host-safety/org-1').set(as('owner-1')).send(submission()).expect(201);
    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'admin-1', link: '/admin/host-safety' });
    expect(prisma.notification.create.mock.calls[0][0].data.message).toContain('Brisbane Builders');
  });

  it('will not look at a request until every statement is true, and says which are not', async () => {
    const first = HOST_SAFETY_QUESTIONS[0];
    const res = await request(app)
      .post('/api/verification/host-safety/org-1')
      .set(as('owner-1'))
      .send(submission({ answers: { ...allYes(), [first.id]: false } }))
      .expect(400);
    expect(res.body.message).toContain(first.statement);
    expect(res.body.message).toContain('put it in place first');

    // Missing is not the same as yes.
    const { [first.id]: _omit, ...missingOne } = allYes();
    await request(app).post('/api/verification/host-safety/org-1').set(as('owner-1')).send(submission({ answers: missingOne })).expect(400);
    await request(app).post('/api/verification/host-safety/org-1').set(as('owner-1')).send(submission({ answers: undefined })).expect(400);
    expect(prisma.hostEmployerSafetyAttestation.create).not.toHaveBeenCalled();
  });

  it.each([
    ['no safety contact name', { safetyContactName: '' }],
    ['no way to reach the safety contact', { safetyContactEmail: '' }],
    ['an email that is not one', { safetyContactEmail: 'not-an-email' }],
    ['no ABN', { abn: '' }],
    ['an ABN that does not add up', { abn: '12 345 678 901' }],
  ])('refuses %s', async (_what, over) => {
    await request(app).post('/api/verification/host-safety/org-1').set(as('owner-1')).send(submission(over)).expect(400);
    expect(prisma.hostEmployerSafetyAttestation.create).not.toHaveBeenCalled();
  });

  it('takes a phone number in place of an email', async () => {
    await request(app)
      .post('/api/verification/host-safety/org-1')
      .set(as('owner-1'))
      .send(submission({ safetyContactEmail: '', safetyContactPhone: '07 3000 0000' }))
      .expect(201);
    expect(prisma.hostEmployerSafetyAttestation.create.mock.calls[0][0].data).toMatchObject({ safetyContactEmail: null, safetyContactPhone: '07 3000 0000' });
  });

  it('collects no individual’s police or background check, whatever the body carries', async () => {
    await request(app)
      .post('/api/verification/host-safety/org-1')
      .set(as('owner-1'))
      .send(submission({ policeCheck: 'clear', backgroundCheckReference: 'NPC-123', blueCardNumber: '1234567' }))
      .expect(201);
    const wire = JSON.stringify(prisma.hostEmployerSafetyAttestation.create.mock.calls[0][0].data);
    expect(wire).not.toMatch(/police|background|blueCard|NPC-123|1234567/i);
  });

  it('corrects a waiting attestation in place rather than queueing a second', async () => {
    prisma.hostEmployerSafetyAttestation.findFirst.mockImplementation(async ({ where }: any) => (where.status === 'PENDING' ? attestation() : null));

    await request(app).post('/api/verification/host-safety/org-1').set(as('owner-1')).send(submission({ safetyContactName: 'Pat Lee' })).expect(201);

    expect(prisma.hostEmployerSafetyAttestation.create).not.toHaveBeenCalled();
    expect(prisma.hostEmployerSafetyAttestation.update.mock.calls[0][0]).toMatchObject({ where: { id: 'att-1' }, data: { safetyContactName: 'Pat Lee' } });
  });

  it('does not reset a standing approval months before it ends, and takes a renewal inside the last month', async () => {
    const standing = (days: number) =>
      prisma.hostEmployerSafetyAttestation.findFirst.mockImplementation(async ({ where }: any) =>
        where.status === 'APPROVED' ? attestation({ status: 'APPROVED', reviewedAt: new Date(), expiresAt: new Date(Date.now() + days * DAY) }) : null
      );

    standing(200);
    const early = await request(app).post('/api/verification/host-safety/org-1').set(as('owner-1')).send(submission()).expect(409);
    expect(early.body.message).toContain('stands until');
    expect(prisma.hostEmployerSafetyAttestation.create).not.toHaveBeenCalled();

    standing(10);
    await request(app).post('/api/verification/host-safety/org-1').set(as('owner-1')).send(submission()).expect(201);
    // A new row, so the approval that stands is kept as it was while staff look.
    expect(prisma.hostEmployerSafetyAttestation.create).toHaveBeenCalledTimes(1);
  });

  describe('with the Australian Business Register configured', () => {
    beforeEach(() => {
      abrConfigured = true;
    });

    it('keeps only the entity name and the ABN’s status of what the register said', async () => {
      lookupAbn.mockResolvedValue({
        abn: '51824753556',
        abnStatus: 'Active',
        abnStatusFrom: '2000-01-01',
        acn: '123456789',
        entityName: 'BRISBANE BUILDERS PTY LTD',
        entityType: 'Australian Private Company',
        gstRegisteredFrom: '2000-07-01',
        businessNames: ['Brisbane Builders'],
        state: 'QLD',
        postcode: '4000',
      });

      await request(app).post('/api/verification/host-safety/org-1').set(as('owner-1')).send(submission()).expect(201);

      const { abnCheck } = prisma.hostEmployerSafetyAttestation.create.mock.calls[0][0].data;
      expect(abnCheck).toMatchObject({ lookup: 'FOUND', entityName: 'BRISBANE BUILDERS PTY LTD', abnStatus: 'Active' });
      expect(Object.keys(abnCheck).sort()).toEqual(['abn', 'abnStatus', 'checkedAt', 'entityName', 'lookup']);
    });

    it('refuses an ABN the register does not know, which is nearly always a typo', async () => {
      lookupAbn.mockResolvedValue(null);
      const res = await request(app).post('/api/verification/host-safety/org-1').set(as('owner-1')).send(submission()).expect(400);
      expect(res.body.message).toContain('not on the Australian Business Register');
      expect(prisma.hostEmployerSafetyAttestation.create).not.toHaveBeenCalled();
    });

    it('records a register that could not be asked as such, never as a pass, and still takes the request', async () => {
      lookupAbn.mockRejectedValue(new Error('The ABR did not answer in time'));
      await request(app).post('/api/verification/host-safety/org-1').set(as('owner-1')).send(submission()).expect(201);
      expect(prisma.hostEmployerSafetyAttestation.create.mock.calls[0][0].data.abnCheck).toMatchObject({ lookup: 'UNAVAILABLE' });
    });
  });
});

describe('GET /api/verification/host-safety-queue', () => {
  it('is for staff', async () => {
    await request(app).get('/api/verification/host-safety-queue').set(as('member')).expect(403);
    expect(prisma.hostEmployerSafetyAttestation.findMany).not.toHaveBeenCalled();
  });

  it('lists what is waiting, oldest first, and what is about to end, with the answers, the ABR reply and who sent it', async () => {
    prisma.hostEmployerSafetyAttestation.findMany.mockImplementation(async ({ where }: any) => {
      if (where.organizationId) return []; // the lookup for a standing approval: there is none
      return where.status === 'PENDING'
        ? [{ ...attestation(), organization: { ...ORG, slug: 'bb', website: null, type: 'company', city: 'Brisbane', state: 'QLD' } }]
        : [{ ...attestation({ id: 'att-2', status: 'APPROVED', reviewedAt: new Date(), expiresAt: new Date(Date.now() + 5 * DAY), attestedAt: new Date() }), organization: ORG }];
    });
    prisma.user.findMany.mockResolvedValue([{ id: 'owner-1', email: 'owner@builders.example', displayName: 'Ola' }]);

    const res = await request(app).get('/api/verification/host-safety-queue').set(as('staff-1', 'ADMIN')).expect(200);

    const order = prisma.hostEmployerSafetyAttestation.findMany.mock.calls
      .filter((c: any) => c[0].orderBy)
      .map((c: any) => [c[0].where.status, c[0].orderBy]);
    expect(order).toEqual([
      ['PENDING', { attestedAt: 'asc' }],
      ['APPROVED', { expiresAt: 'asc' }],
      ['APPROVED', { expiresAt: 'asc' }],
    ]);
    const [waiting] = res.body.data.waiting;
    expect(waiting).toMatchObject({ id: 'att-1', standing: 'PENDING', answers: allYes(), abnCheck: { lookup: 'NOT_CONFIGURED' }, organization: { name: 'Brisbane Builders' }, attestedBy: { email: 'owner@builders.example' } });
    expect(res.body.data.ending[0]).toMatchObject({ standing: 'APPROVED', renewal: false });
    // Nothing standing for this organisation, so the waiting request is a first one.
    expect(waiting).toMatchObject({ renewal: false, currentApprovalEndsAt: null });
  });

  it('lists the approvals that stand beyond the month too, so staff can find one to withdraw, and leaves the lapsed ones out of "ending"', async () => {
    prisma.hostEmployerSafetyAttestation.findMany.mockImplementation(async ({ where }: any) => {
      if (where.status !== 'APPROVED') return [];
      return where.expiresAt.lte ? [] : [{ ...attestation({ id: 'att-long', status: 'APPROVED', reviewedAt: new Date(), expiresAt: new Date(Date.now() + 200 * DAY) }), organization: ORG }];
    });

    const res = await request(app).get('/api/verification/host-safety-queue').set(as('staff-1', 'ADMIN')).expect(200);

    expect(res.body.data.standing).toHaveLength(1);
    expect(res.body.data.standing[0]).toMatchObject({ id: 'att-long', standing: 'APPROVED' });
    expect(res.body.data.ending).toEqual([]);
    const approvedReads = prisma.hostEmployerSafetyAttestation.findMany.mock.calls.map((c: any) => c[0].where).filter((w: any) => w.status === 'APPROVED');
    // Ending: still standing and ending within the month. Nothing writes EXPIRED,
    // so without the lower bound every lapsed approval stayed in this list.
    const ending = approvedReads.find((w: any) => w.expiresAt.lte);
    expect(ending.expiresAt.gt).toBeInstanceOf(Date);
    // Standing: ends after the month, so it is in neither of the other lists.
    const standing = approvedReads.find((w: any) => !w.expiresAt.lte);
    expect(standing.expiresAt.gt.getTime()).toBe(ending.expiresAt.lte.getTime());
  });

  it('marks a waiting request as a renewal, and says when the approval that stands ends, when one does', async () => {
    const ends = new Date(Date.now() + 12 * DAY);
    prisma.hostEmployerSafetyAttestation.findMany.mockImplementation(async ({ where }: any) => {
      if (where.status === 'PENDING') return [{ ...attestation(), organization: ORG }];
      if (where.organizationId) return [{ organizationId: 'org-1', expiresAt: ends }];
      return [];
    });

    const res = await request(app).get('/api/verification/host-safety-queue').set(as('staff-1', 'ADMIN')).expect(200);

    expect(res.body.data.waiting[0]).toMatchObject({ renewal: true, currentApprovalEndsAt: ends.toISOString() });
    const standingQuery = prisma.hostEmployerSafetyAttestation.findMany.mock.calls.find((c: any) => c[0].where.organizationId)[0];
    expect(standingQuery.where).toMatchObject({ organizationId: { in: ['org-1'] }, status: 'APPROVED' });
    expect(standingQuery.where.expiresAt.gt).toBeInstanceOf(Date);
  });
});

describe('PATCH /api/verification/host-safety-attestations/:id', () => {
  const staff = as('staff-1', 'ADMIN');
  const approve = { decision: 'APPROVE', note: 'Rang the safety contact and read the WHS policy. ABN matches the register.' };

  beforeEach(() => {
    prisma.hostEmployerSafetyAttestation.findUnique.mockResolvedValue(attestation());
    prisma.organizationMember.findUnique.mockResolvedValue(null);
    prisma.organizationMember.findMany.mockResolvedValue([{ userId: 'owner-1' }, { userId: 'admin-member' }]);
  });

  it('is for staff only', async () => {
    await request(app).patch('/api/verification/host-safety-attestations/att-1').set(as('member')).send(approve).expect(403);
    await request(app).patch('/api/verification/host-safety-attestations/att-1').send(approve).expect(401);
    expect(prisma.hostEmployerSafetyAttestation.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ['no note', { decision: 'APPROVE' }],
    ['a note too short to say what was checked', { decision: 'APPROVE', note: 'ok fine' }],
    ['an answer that is neither', { decision: 'MAYBE', note: 'A sentence of reasons here.' }],
    ['a term of more than two years', { ...approve, validForDays: 4000 }],
    ['a field it does not know', { ...approve, expiresAt: '2099-01-01' }],
  ])('refuses %s', async (_what, body) => {
    await request(app).patch('/api/verification/host-safety-attestations/att-1').set(staff).send(body).expect(400);
    expect(prisma.hostEmployerSafetyAttestation.updateMany).not.toHaveBeenCalled();
  });

  it('answers 404 for an attestation that is not there', async () => {
    prisma.hostEmployerSafetyAttestation.findUnique.mockResolvedValue(null);
    await request(app).patch('/api/verification/host-safety-attestations/nope').set(staff).send(approve).expect(404);
  });

  it('approves for a year, records the ABN on the organisation in the same write, and says who and why', async () => {
    const res = await request(app).patch('/api/verification/host-safety-attestations/att-1').set(staff).send(approve).expect(200);

    const write = prisma.hostEmployerSafetyAttestation.updateMany.mock.calls[0][0];
    // Conditional on the status read, so two reviewers cannot both win.
    expect(write.where).toEqual({ id: 'att-1', status: 'PENDING' });
    expect(write.data).toMatchObject({ status: 'APPROVED', reviewedById: 'staff-1', reviewNote: approve.note });
    expect(Math.round((write.data.expiresAt.getTime() - write.data.reviewedAt.getTime()) / DAY)).toBe(365);
    expect(prisma.organization.update).toHaveBeenCalledWith({ where: { id: 'org-1' }, data: { abn: '51824753556' } });
    expect(res.body.data).toMatchObject({ standing: 'APPROVED' });
  });

  it('is recorded in the audit log under the member of staff, with what they did and what the register said', async () => {
    await request(app).patch('/api/verification/host-safety-attestations/att-1').set(staff).send(approve).expect(200);

    const row = prisma.auditLog.create.mock.calls[0][0].data;
    expect(row.actorUserId).toBe('staff-1');
    expect(row.metadata).toMatchObject({
      adminAction: 'HOST_SAFETY_ATTESTATION_DECIDED',
      resourceType: 'HostEmployerSafetyAttestation',
      resourceId: 'att-1',
      decision: 'APPROVE',
      organizationId: 'org-1',
      before: { status: 'PENDING' },
      after: { status: 'APPROVED' },
      note: approve.note,
      abnCheck: { lookup: 'NOT_CONFIGURED' },
      standingAfter: 'APPROVED',
    });
  });

  it('tells the owners and admins of the organisation, and warns when it still has to be verified', async () => {
    await request(app).patch('/api/verification/host-safety-attestations/att-1').set(staff).send(approve).expect(200);
    expect(prisma.organizationMember.findMany.mock.calls[0][0].where).toEqual({ organizationId: 'org-1', role: { in: ['OWNER', 'ADMIN'] }, acceptedAt: { not: null } });
    const told = prisma.notification.create.mock.calls.map((c: any) => c[0].data);
    expect(told.map((n: any) => n.userId).sort()).toEqual(['admin-member', 'owner-1']);
    expect(told[0]).toMatchObject({ title: 'Your host safety attestation is approved', link: '/employer/organizations/org-1/apprenticeships' });
    expect(told[0].message).toContain('can now place apprentices');

    prisma.notification.create.mockClear();
    prisma.organization.findUnique.mockResolvedValue({ name: 'Brisbane Builders', isVerified: false });
    await request(app).patch('/api/verification/host-safety-attestations/att-1').set(staff).send(approve).expect(200);
    expect(prisma.notification.create.mock.calls[0][0].data.message).toContain('also has to be verified');
  });

  it('refuses with the reason, which the organisation reads, and writes no ABN', async () => {
    const res = await request(app)
      .patch('/api/verification/host-safety-attestations/att-1')
      .set(staff)
      .send({ decision: 'REJECT', note: 'The ABN is registered to a different business name.' })
      .expect(200);

    const write = prisma.hostEmployerSafetyAttestation.updateMany.mock.calls[0][0];
    expect(write.data).toMatchObject({ status: 'REJECTED', expiresAt: null, reviewNote: 'The ABN is registered to a different business name.' });
    expect(prisma.organization.update).not.toHaveBeenCalled();
    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({ title: 'Your host safety attestation was not approved' });
    expect(prisma.notification.create.mock.calls[0][0].data.message).toContain('registered to a different business name');
    expect(res.body.data).toMatchObject({ standing: 'REJECTED' });
  });

  it('can withdraw an approval that stands, and a refusal then ends the standing at once', async () => {
    prisma.hostEmployerSafetyAttestation.findUnique.mockResolvedValue(attestation({ status: 'APPROVED', reviewedAt: new Date(), expiresAt: new Date(Date.now() + 200 * DAY) }));

    const res = await request(app)
      .patch('/api/verification/host-safety-attestations/att-1')
      .set(staff)
      .send({ decision: 'REJECT', note: 'A report about a workplace injury was not disclosed.' })
      .expect(200);

    expect(prisma.hostEmployerSafetyAttestation.updateMany.mock.calls[0][0].where).toEqual({ id: 'att-1', status: 'APPROVED' });
    expect(res.body.data).toMatchObject({ standing: 'REJECTED', expiresAt: null });
  });

  it('withdrawing an approval withdraws every approval the organisation holds, so a renewal approved beside it does not keep it placing apprentices', async () => {
    prisma.hostEmployerSafetyAttestation.findUnique.mockResolvedValue(attestation({ status: 'APPROVED', reviewedAt: new Date(), expiresAt: new Date(Date.now() + 20 * DAY) }));

    await request(app)
      .patch('/api/verification/host-safety-attestations/att-1')
      .set(staff)
      .send({ decision: 'REJECT', note: 'A report about a workplace injury was not disclosed.' })
      .expect(200);

    expect(prisma.hostEmployerSafetyAttestation.updateMany).toHaveBeenCalledTimes(2);
    const others = prisma.hostEmployerSafetyAttestation.updateMany.mock.calls[1][0];
    expect(others.where).toMatchObject({ organizationId: 'org-1', status: 'APPROVED', id: { not: 'att-1' } });
    expect(others.where.expiresAt.gt).toBeInstanceOf(Date);
    expect(others.data).toMatchObject({ status: 'REJECTED', expiresAt: null, reviewNote: 'A report about a workplace injury was not disclosed.' });
  });

  it('refusing a waiting renewal leaves the approval that stands alone', async () => {
    prisma.hostEmployerSafetyAttestation.findUnique.mockResolvedValue(attestation({ status: 'PENDING' }));

    await request(app).patch('/api/verification/host-safety-attestations/att-1').set(staff).send({ decision: 'REJECT', note: 'The safety contact could not be reached.' }).expect(200);

    expect(prisma.hostEmployerSafetyAttestation.updateMany).toHaveBeenCalledTimes(1);
  });

  it('will not approve what is already decided, or turn a refusal into an approval', async () => {
    prisma.hostEmployerSafetyAttestation.findUnique.mockResolvedValue(attestation({ status: 'REJECTED' }));
    const refused = await request(app).patch('/api/verification/host-safety-attestations/att-1').set(staff).send(approve).expect(409);
    expect(refused.body.message).toContain('has to send a new one');

    prisma.hostEmployerSafetyAttestation.findUnique.mockResolvedValue(attestation({ status: 'APPROVED', expiresAt: new Date(Date.now() + DAY) }));
    await request(app).patch('/api/verification/host-safety-attestations/att-1').set(staff).send(approve).expect(409);

    prisma.hostEmployerSafetyAttestation.findUnique.mockResolvedValue(attestation({ status: 'REJECTED' }));
    await request(app).patch('/api/verification/host-safety-attestations/att-1').set(staff).send({ decision: 'REJECT', note: 'Refused again for the record.' }).expect(409);

    expect(prisma.hostEmployerSafetyAttestation.updateMany).not.toHaveBeenCalled();
  });

  it('loses cleanly to another reviewer who decided first, and does not touch the organisation', async () => {
    prisma.hostEmployerSafetyAttestation.updateMany.mockResolvedValue({ count: 0 });

    const res = await request(app).patch('/api/verification/host-safety-attestations/att-1').set(staff).send(approve).expect(409);

    expect(res.body.message).toContain('Another member of staff');
    expect(prisma.organization.update).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('is not decided by a member of staff who belongs to the organisation', async () => {
    prisma.organizationMember.findUnique.mockResolvedValue({ id: 'm-staff' });
    const res = await request(app).patch('/api/verification/host-safety-attestations/att-1').set(staff).send(approve).expect(403);
    expect(res.body.message).toContain('another member of staff');
    expect(prisma.organizationMember.findUnique.mock.calls[0][0].where).toEqual({ organizationId_userId: { organizationId: 'org-1', userId: 'staff-1' } });
    expect(prisma.hostEmployerSafetyAttestation.updateMany).not.toHaveBeenCalled();
  });
});
