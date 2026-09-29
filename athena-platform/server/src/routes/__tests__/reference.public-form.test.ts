import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: { jobApplication: { findUnique: jest.fn() }, referenceRequest: { findUnique: jest.fn() } },
}));

jest.mock('../../services/reference-check.service', () => ({
  referenceCheckService: {
    getReferenceByToken: jest.fn(),
    submitReferenceResponse: jest.fn(),
    declineReferenceRequest: jest.fn(),
    getCandidateReferenceSummary: jest.fn(),
    getApplicationReferences: jest.fn(),
    createReferenceRequest: jest.fn(),
    sendReferenceRequest: jest.fn(),
    batchSendReferenceRequests: jest.fn(),
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'candidate-1', role: 'USER', email: 'c@athena.com' };
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
import { referenceCheckService as serviceTyped } from '../../services/reference-check.service';

const service: any = serviceTyped;
const TOKEN = 'a'.repeat(64);

describe('The referee’s public form', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('serves the form for a live token', async () => {
    service.getReferenceByToken.mockResolvedValue({
      request: { id: 'r1', refereeName: 'Jo', relationship: 'MANAGER', type: 'PROFESSIONAL', status: 'SENT', questions: [] },
      candidate: { displayName: 'Mei Chen' },
      expired: false,
    });
    const res = await request(app).get(`/api/references/form/${TOKEN}`).expect(200);
    expect(res.body.data.candidate.displayName).toBe('Mei Chen');
  });

  it('answers 404 for a token that matches nothing, rather than a 500', async () => {
    service.getReferenceByToken.mockRejectedValue(new Error('Reference request not found'));
    const res = await request(app).get(`/api/references/form/${TOKEN}`).expect(404);
    expect(res.body.message).toMatch(/not found/i);
  });

  it('answers 410 once the request has expired', async () => {
    service.getReferenceByToken.mockResolvedValue({ request: {}, candidate: {}, expired: true });
    await request(app).get(`/api/references/form/${TOKEN}`).expect(410);
  });

  it('records a submission and requires the recommendation answer', async () => {
    service.submitReferenceResponse.mockResolvedValue(true);
    await request(app)
      .post(`/api/references/form/${TOKEN}/submit`)
      .send({ answers: [{ questionId: 'q1', answer: 'Excellent' }], overallRating: 5, wouldRecommend: true })
      .expect(200);
    expect(service.submitReferenceResponse.mock.calls[0][0]).toBe(TOKEN);
    expect(service.submitReferenceResponse.mock.calls[0][1]).toMatchObject({ overallRating: 5, wouldRecommend: true });

    await request(app).post(`/api/references/form/${TOKEN}/submit`).send({ answers: [] }).expect(400);
  });

  it('a submission for a token that matches nothing is a 404 too', async () => {
    service.submitReferenceResponse.mockRejectedValue(new Error('Reference request not found'));
    await request(app).post(`/api/references/form/${TOKEN}/submit`).send({ answers: [], wouldRecommend: false }).expect(404);
  });

  it('refuses a submission it would have stored whatever its size or shape', async () => {
    service.submitReferenceResponse.mockResolvedValue(true);
    const post = (body: unknown) => request(app).post(`/api/references/form/${TOKEN}/submit`).send(body as object);

    await post({ answers: [{ questionId: 'q1', answer: 'x'.repeat(5001) }], wouldRecommend: true }).expect(400);
    await post({ answers: [{ questionId: 'q1', answer: { nested: true } }], wouldRecommend: true }).expect(400);
    await post({ answers: [{ questionId: 'q'.repeat(65), answer: 'fine' }], wouldRecommend: true }).expect(400);
    await post({
      answers: Array.from({ length: 51 }, (_, i) => ({ questionId: `q${i}`, answer: 'fine' })),
      wouldRecommend: true,
    }).expect(400);
    await post({ answers: [], wouldRecommend: true, overallRating: 9 }).expect(400);
    await post({ answers: [], wouldRecommend: true, overallRating: 3.5 }).expect(400);
    await post({ answers: [], wouldRecommend: true, additionalComments: 'x'.repeat(5001) }).expect(400);
    await post({ answers: [], wouldRecommend: true, somethingElse: 'x' }).expect(400);

    expect(service.submitReferenceResponse).not.toHaveBeenCalled();
  });

  it('passes on the service’s own refusal, such as a reference already answered', async () => {
    const { ApiError } = jest.requireActual('../../middleware/errorHandler') as typeof import('../../middleware/errorHandler');
    service.submitReferenceResponse.mockRejectedValue(new ApiError(409, 'This reference has already been submitted'));

    const res = await request(app)
      .post(`/api/references/form/${TOKEN}/submit`)
      .send({ answers: [], wouldRecommend: true })
      .expect(409);
    expect(res.body.message).toMatch(/already been submitted/);
  });

  it('keeps a decline’s reason to a sensible length', async () => {
    await request(app).post(`/api/references/form/${TOKEN}/decline`).send({ reason: 'x'.repeat(2001) }).expect(400);
    await request(app).post(`/api/references/form/${TOKEN}/decline`).send({ reason: 'fine', extra: 1 }).expect(400);
    expect(service.declineReferenceRequest).not.toHaveBeenCalled();
  });

  it('never hands the candidate the token that opens her referee’s form', async () => {
    service.createReferenceRequest.mockResolvedValue({
      id: 'r1',
      candidateId: 'candidate-1',
      refereeName: 'Jo',
      refereeEmail: 'jo@example.com',
      relationship: 'MANAGER',
      type: 'PROFESSIONAL',
      status: 'PENDING',
      token: 'b'.repeat(64),
      customQuestions: [],
      expiresAt: new Date('2099-01-01'),
    });

    const res = await request(app)
      .post('/api/references/request')
      .send({
        refereeName: 'Jo',
        refereeEmail: 'jo@example.com',
        relationship: 'MANAGER',
        type: 'PROFESSIONAL',
        customQuestions: [{ id: 'x', question: 'Click this link to verify your bank', type: 'TEXT', required: true }],
      })
      .expect(200);

    expect(res.body.data.id).toBe('r1');
    expect(JSON.stringify(res.body)).not.toContain('b'.repeat(64));
    // Questions of her own wording do not go out under ATHENA's name.
    expect(service.createReferenceRequest.mock.calls[0][0]).not.toHaveProperty('customQuestions');
  });

  it('refuses a referee request it cannot send sensibly', async () => {
    await request(app)
      .post('/api/references/request')
      .send({ refereeName: 'Jo', refereeEmail: 'not an email', relationship: 'MANAGER', type: 'PROFESSIONAL' })
      .expect(400);
    await request(app)
      .post('/api/references/request')
      .send({ refereeName: 'Jo', refereeEmail: 'jo@example.com', relationship: 'MANAGER', type: 'ANYTHING' })
      .expect(400);
    await request(app)
      .post('/api/references/batch')
      .send({
        referees: Array.from({ length: 6 }, (_, i) => ({
          email: `r${i}@example.com`,
          name: `R${i}`,
          relationship: 'COLLEAGUE',
          type: 'PROFESSIONAL',
        })),
      })
      .expect(400);

    expect(service.createReferenceRequest).not.toHaveBeenCalled();
    expect(service.batchSendReferenceRequests).not.toHaveBeenCalled();
  });

  it('lets a referee decline', async () => {
    service.declineReferenceRequest.mockResolvedValue(true);
    await request(app).post(`/api/references/form/${TOKEN}/decline`).send({ reason: 'Left the company too long ago' }).expect(200);
    expect(service.declineReferenceRequest).toHaveBeenCalledWith(TOKEN, 'Left the company too long ago');
  });
});
