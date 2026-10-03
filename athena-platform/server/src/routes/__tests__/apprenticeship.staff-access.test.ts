import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    apprenticeship: { findUnique: jest.fn() },
    apprenticeshipApplication: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn() },
    organizationMember: { findFirst: jest.fn(), findMany: jest.fn() },
    // The host check: verified, with an approved attestation that has not run out.
    organization: { findMany: jest.fn(async () => []) },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: req.headers['x-test-user'] || 'applicant-1', role: req.headers['x-test-role'] || 'USER', email: 'u@athena.com' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    if (req.headers['x-test-user']) {
      req.user = { id: req.headers['x-test-user'], role: req.headers['x-test-role'] || 'USER', email: 'u@athena.com' };
    }
    next();
  },
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

const notify = jest.fn();
jest.mock('../../services/notification.service', () => ({
  ...(jest.requireActual('../../services/notification.service') as object),
  notificationService: { notify: (...a: unknown[]) => notify(...a) },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;
const APPLICANT = 'applicant-1';

const LISTING = {
  id: 'ap1',
  title: 'Electrotechnology apprenticeship',
  status: 'OPEN',
  rtoId: 'rto-1',
  hostEmployerId: null,
  positions: 2,
  positionsFilled: 0,
};

/** How the organisation named on the listing stands. `checked` has both halves; the others are missing one. */
function hostIs(standing: 'checked' | 'unverified' | 'unattested' | 'unknown') {
  prisma.organization.findMany.mockImplementation(async ({ where }: any) =>
    standing === 'unknown'
      ? []
      : (where.id.in as string[]).map((id) => ({
          id,
          isVerified: standing !== 'unverified',
          hostSafetyAttestations: standing === 'unattested' ? [] : [{ id: 'att-1' }],
        }))
  );
}

const HIRING_FILTER = {
  acceptedAt: { not: null },
  OR: [{ role: { in: ['OWNER', 'ADMIN', 'RECRUITER'] } }, { canPostJobs: true }],
};

describe('Who can read an apprenticeship’s applicants', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.apprenticeship.findUnique.mockResolvedValue(LISTING);
    prisma.apprenticeshipApplication.findMany.mockResolvedValue([]);
    prisma.apprenticeshipApplication.count.mockResolvedValue(0);
  });

  it('asks for an accepted membership with a hiring role, not any membership row', async () => {
    prisma.organizationMember.findFirst.mockResolvedValue({ id: 'm1' });

    await request(app).get('/api/apprenticeships/ap1/applications').set({ 'x-test-user': 'staff-1' }).expect(200);

    expect(prisma.organizationMember.findFirst.mock.calls[0][0].where).toEqual({
      userId: 'staff-1',
      organizationId: { in: ['rto-1'] },
      ...HIRING_FILTER,
    });
  });

  it('answers 404 to a VIEWER or an unanswered invitation, and reads no applicants', async () => {
    // The hiring filter above is what excludes them; with it applied the
    // lookup finds nothing.
    prisma.organizationMember.findFirst.mockResolvedValue(null);

    await request(app).get('/api/apprenticeships/ap1/applications').set({ 'x-test-user': 'viewer-1' }).expect(404);

    expect(prisma.apprenticeshipApplication.findMany).not.toHaveBeenCalled();
  });

  it('pages the list instead of returning every applicant at once', async () => {
    prisma.organizationMember.findFirst.mockResolvedValue({ id: 'm1' });
    prisma.apprenticeshipApplication.count.mockResolvedValue(320);

    const res = await request(app)
      .get('/api/apprenticeships/ap1/applications?limit=5000')
      .set({ 'x-test-user': 'staff-1' })
      .expect(200);

    expect(prisma.apprenticeshipApplication.findMany.mock.calls[0][0].take).toBe(100);
    expect(res.body.pagination).toMatchObject({ total: 320, limit: 100, pages: 4 });
  });

  it('holds a single application to the same rule', async () => {
    prisma.apprenticeshipApplication.findUnique.mockResolvedValue({ id: 'a1', apprenticeshipId: 'ap1', userId: APPLICANT });
    prisma.organizationMember.findFirst.mockResolvedValue(null);

    await request(app).get('/api/apprenticeships/applications/a1').set({ 'x-test-user': 'viewer-1' }).expect(404);

    expect(prisma.organizationMember.findFirst.mock.calls[0][0].where).toMatchObject(HIRING_FILTER);
  });
});

describe('Applying for an apprenticeship', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.apprenticeship.findUnique.mockResolvedValue(LISTING);
    prisma.apprenticeshipApplication.findUnique.mockResolvedValue(null);
    prisma.apprenticeshipApplication.create.mockImplementation(async ({ data }: any) => ({ id: 'a-new', ...data }));
    (notify as any).mockResolvedValue(undefined);
    hostIs('checked');
  });

  // A listing that was open before the host check existed, or one whose host's
  // attestation has since run out, stays visible but takes no applications: an
  // applicant is not placed with a workplace ATHENA has not looked at.
  describe('when the host has not been safety-checked', () => {
    it.each([
      ['is not verified', 'unverified'],
      ['has no approved safety attestation', 'unattested'],
      ['is not an organisation ATHENA knows', 'unknown'],
    ] as const)('refuses, writes nothing, and says why, when the host %s', async (_what, standing) => {
      hostIs(standing);
      prisma.organizationMember.findMany.mockResolvedValue([{ userId: 'staff-1', organizationId: 'rto-1' }]);

      const res = await request(app).post('/api/apprenticeships/ap1/apply').set({ 'x-test-user': APPLICANT }).send({ coverLetter: 'Hello' }).expect(409);

      expect(res.body.message ?? res.body.error).toMatch(/has not safety-checked this host yet/);
      expect(prisma.apprenticeshipApplication.create).not.toHaveBeenCalled();
      expect(prisma.apprenticeshipApplication.findUnique).not.toHaveBeenCalled();
      expect(notify).not.toHaveBeenCalled();
    });

    it('asks only about the host named on the listing when one is named, and about the training provider when none is', async () => {
      prisma.organizationMember.findMany.mockResolvedValue([{ userId: 'staff-1', organizationId: 'host-1' }]);

      prisma.apprenticeship.findUnique.mockResolvedValue({ ...LISTING, hostEmployerId: 'host-1' });
      await request(app).post('/api/apprenticeships/ap1/apply').set({ 'x-test-user': APPLICANT }).send({ coverLetter: 'Hello' }).expect(201);
      expect(prisma.organization.findMany.mock.calls[0][0].where).toEqual({ id: { in: ['host-1'] } });

      prisma.organization.findMany.mockClear();
      prisma.apprenticeshipApplication.findUnique.mockResolvedValue(null);
      prisma.apprenticeship.findUnique.mockResolvedValue({ ...LISTING, hostEmployerId: null });
      await request(app).post('/api/apprenticeships/ap1/apply').set({ 'x-test-user': APPLICANT }).send({ coverLetter: 'Hello' }).expect(201);
      expect(prisma.organization.findMany.mock.calls[0][0].where).toEqual({ id: { in: ['rto-1'] } });
    });

    it('only counts an attestation that is approved and has not run out', async () => {
      prisma.organizationMember.findMany.mockResolvedValue([{ userId: 'staff-1', organizationId: 'rto-1' }]);
      const before = Date.now();

      await request(app).post('/api/apprenticeships/ap1/apply').set({ 'x-test-user': APPLICANT }).send({ coverLetter: 'Hello' }).expect(201);

      const select = prisma.organization.findMany.mock.calls[0][0].select.hostSafetyAttestations;
      expect(select.where.status).toBe('APPROVED');
      expect(select.where.expiresAt.gt).toBeInstanceOf(Date);
      expect(select.where.expiresAt.gt.getTime()).toBeGreaterThanOrEqual(before - 1000);
    });
  });

  it('refuses, before writing anything, when nobody at the provider could read it', async () => {
    // A seeded TAFE listing: the RTO exists, nobody from it has an account.
    prisma.organizationMember.findMany.mockResolvedValue([]);

    const res = await request(app)
      .post('/api/apprenticeships/ap1/apply')
      .set({ 'x-test-user': APPLICANT })
      .send({ coverLetter: 'Hello' })
      .expect(409);

    expect(res.body.message ?? res.body.error).toMatch(/has not set up its ATHENA account/);
    expect(prisma.apprenticeshipApplication.create).not.toHaveBeenCalled();
  });

  it('tells the provider’s hiring team, and tells her it was sent', async () => {
    prisma.organizationMember.findMany.mockResolvedValue([
      { userId: 'staff-1', organizationId: 'rto-1' },
      { userId: 'staff-2', organizationId: 'rto-1' },
    ]);

    await request(app)
      .post('/api/apprenticeships/ap1/apply')
      .set({ 'x-test-user': APPLICANT })
      .send({ coverLetter: 'Hello' })
      .expect(201);

    const staffQuery = prisma.organizationMember.findMany.mock.calls[0][0].where;
    expect(staffQuery).toEqual({ organizationId: { in: ['rto-1'] }, ...HIRING_FILTER });

    const recipients = (notify as any).mock.calls.map((call: any[]) => call[0].userId);
    expect(recipients).toEqual(expect.arrayContaining(['staff-1', 'staff-2', APPLICANT]));
    const staffNotice = (notify as any).mock.calls.find((call: any[]) => call[0].userId === 'staff-1')[0];
    expect(staffNotice.link).toBe('/employer/organizations/rto-1/apprenticeships');
  });

  it('will not attach another member’s uploaded résumé', async () => {
    prisma.organizationMember.findMany.mockResolvedValue([{ userId: 'staff-1', organizationId: 'rto-1' }]);

    await request(app)
      .post('/api/apprenticeships/ap1/apply')
      .set({ 'x-test-user': APPLICANT })
      .send({ resumeUrl: '/api/media/local/resumes/someone-else/cv.pdf' })
      .expect(400);

    expect(prisma.apprenticeshipApplication.create).not.toHaveBeenCalled();
  });

  it('takes her own upload and nothing held elsewhere, as job applications do', async () => {
    prisma.organizationMember.findMany.mockResolvedValue([{ userId: 'staff-1', organizationId: 'rto-1' }]);

    await request(app)
      .post('/api/apprenticeships/ap1/apply')
      .set({ 'x-test-user': APPLICANT })
      .send({ resumeUrl: `/api/media/local/resumes/${APPLICANT}/cv.pdf` })
      .expect(201);

    // The form uploads the file now. A link sends the provider's click to a
    // server somebody else controls.
    await request(app)
      .post('/api/apprenticeships/ap1/apply')
      .set({ 'x-test-user': APPLICANT })
      .send({ resumeUrl: 'https://drive.google.com/file/d/abc/view' })
      .expect(400);

    expect(prisma.apprenticeshipApplication.create).toHaveBeenCalledTimes(1);
  });

  it('refuses a résumé link that is not a web address', async () => {
    prisma.organizationMember.findMany.mockResolvedValue([{ userId: 'staff-1', organizationId: 'rto-1' }]);

    await request(app)
      .post('/api/apprenticeships/ap1/apply')
      .set({ 'x-test-user': APPLICANT })
      .send({ resumeUrl: 'javascript:alert(1)' })
      .expect(400);
  });

  it('keeps the start date and portfolio she entered, which used to be dropped', async () => {
    prisma.organizationMember.findMany.mockResolvedValue([{ userId: 'staff-1', organizationId: 'rto-1' }]);

    await request(app)
      .post('/api/apprenticeships/ap1/apply')
      .set({ 'x-test-user': APPLICANT })
      .send({
        coverLetter: 'Hello',
        availableStartDate: '2027-02-01',
        portfolioUrl: 'https://example.com/work',
        answers: { availableStartDate: 'not what she chose' },
      })
      .expect(201);

    expect(prisma.apprenticeshipApplication.create.mock.calls[0][0].data.answers).toEqual({
      availableStartDate: '2027-02-01',
      portfolioUrl: 'https://example.com/work',
    });
  });

  it('reopens a withdrawn application instead of refusing her for ever', async () => {
    prisma.organizationMember.findMany.mockResolvedValue([{ userId: 'staff-1', organizationId: 'rto-1' }]);
    prisma.apprenticeshipApplication.findUnique.mockResolvedValue({ id: 'a-old', status: 'WITHDRAWN', userId: APPLICANT });
    prisma.apprenticeshipApplication.update = jest.fn(async ({ data }: any) => ({ id: 'a-old', ...data }));

    await request(app)
      .post('/api/apprenticeships/ap1/apply')
      .set({ 'x-test-user': APPLICANT })
      .send({ coverLetter: 'Trying again' })
      .expect(201);

    expect(prisma.apprenticeshipApplication.create).not.toHaveBeenCalled();
    expect(prisma.apprenticeshipApplication.update.mock.calls[0][0]).toMatchObject({
      where: { id: 'a-old' },
      data: { status: 'SUBMITTED', coverLetter: 'Trying again' },
    });
  });

  it('answers 409 to an application still in progress', async () => {
    prisma.organizationMember.findMany.mockResolvedValue([{ userId: 'staff-1', organizationId: 'rto-1' }]);
    prisma.apprenticeshipApplication.findUnique.mockResolvedValue({ id: 'a-old', status: 'SCREENING', userId: APPLICANT });

    const res = await request(app)
      .post('/api/apprenticeships/ap1/apply')
      .set({ 'x-test-user': APPLICANT })
      .send({ coverLetter: 'Again' })
      .expect(409);
    expect(res.body.message).toMatch(/already applied/);
  });

  it('refuses answers that are not a short list of text', async () => {
    prisma.organizationMember.findMany.mockResolvedValue([{ userId: 'staff-1', organizationId: 'rto-1' }]);

    await request(app)
      .post('/api/apprenticeships/ap1/apply')
      .set({ 'x-test-user': APPLICANT })
      .send({ answers: { essay: 'x'.repeat(5001) } })
      .expect(400);

    await request(app)
      .post('/api/apprenticeships/ap1/apply')
      .set({ 'x-test-user': APPLICANT })
      .send({ portfolioUrl: 'javascript:alert(1)' })
      .expect(400);

    expect(prisma.apprenticeshipApplication.create).not.toHaveBeenCalled();
  });
});

describe('A listing says whether it can take applications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.apprenticeship.findUnique.mockResolvedValue({ ...LISTING, rto: { id: 'rto-1', name: 'TAFE Queensland', logo: null }, hostEmployer: null });
    hostIs('checked');
  });

  // The seeded catalogue names training providers nobody here has checked. They
  // are shown, labelled, not hidden: an honest "not yet checked" serves a
  // visitor better than an empty page.
  it('says honestly that its host has not been checked, and still shows the listing', async () => {
    hostIs('unknown');
    prisma.organizationMember.findMany.mockResolvedValue([]);

    const res = await request(app).get('/api/apprenticeships/ap1').expect(200);

    expect(res.body.data).toMatchObject({ id: 'ap1', hostVerified: false, hostSafetyChecked: false, hostMayPlace: false });
  });

  it.each([
    ['verified but without an attestation', 'unattested', { hostVerified: true, hostSafetyChecked: false, hostMayPlace: false }],
    ['with an attestation but not verified', 'unverified', { hostVerified: false, hostSafetyChecked: true, hostMayPlace: false }],
    ['verified and attested', 'checked', { hostVerified: true, hostSafetyChecked: true, hostMayPlace: true }],
  ] as const)('reports each half separately for a host that is %s', async (_what, standing, expected) => {
    hostIs(standing);
    prisma.organizationMember.findMany.mockResolvedValue([{ userId: 'staff-1', organizationId: 'rto-1' }]);

    const res = await request(app).get('/api/apprenticeships/ap1').expect(200);

    expect(res.body.data).toMatchObject(expected);
  });

  it('is false when nobody at the provider has an account', async () => {
    prisma.organizationMember.findMany.mockResolvedValue([]);
    const res = await request(app).get('/api/apprenticeships/ap1').expect(200);
    expect(res.body.data.acceptsApplications).toBe(false);
  });

  it('is true when the provider has a hiring team here', async () => {
    prisma.organizationMember.findMany.mockResolvedValue([{ userId: 'staff-1', organizationId: 'rto-1' }]);
    const res = await request(app).get('/api/apprenticeships/ap1').expect(200);
    expect(res.body.data.acceptsApplications).toBe(true);
  });
});
