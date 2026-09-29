/**
 * What a referee's submission may store.
 *
 * The public form is reached by a token alone, and what it stores is shown to
 * the employer beside the candidate's application. The route bounds the size
 * of the body; this covers the half only the service can check, against the
 * questions this particular request asked.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    referenceRequest: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(async () => ({ count: 1 })),
      findMany: jest.fn(async () => []),
    },
    jobApplication: { update: jest.fn() },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

jest.mock('../email.service', () => ({ emailService: { sendEmail: jest.fn() } }));

import { prisma as prismaTyped } from '../../utils/prisma';
import { submitReferenceResponse } from '../reference-check.service';

const prisma: any = prismaTyped;

const QUESTIONS = [
  { id: 'q1', question: 'How long have you known her?', type: 'TEXT', required: true },
  { id: 'q2', question: 'Performance?', type: 'RATING', required: true },
  { id: 'q3', question: 'Would you rehire?', type: 'YES_NO', required: true },
  { id: 'q4', question: 'Reason for leaving?', type: 'MULTIPLE_CHOICE', options: ['Resigned', 'Other'], required: false },
];

function liveRequest(overrides: Record<string, unknown> = {}) {
  prisma.referenceRequest.findUnique.mockResolvedValue({
    id: 'ref-1',
    candidateId: 'cand-1',
    applicationId: null,
    refereeEmail: 'jo@example.com',
    status: 'SENT',
    expiresAt: new Date(Date.now() + 86_400_000),
    customQuestions: QUESTIONS,
    ...overrides,
  });
}

const valid = [
  { questionId: 'q1', answer: 'Four years, as her manager' },
  { questionId: 'q2', answer: 5 },
  { questionId: 'q3', answer: true },
];

const submit = (answers: Array<{ questionId: string; answer: string | number | boolean }>) =>
  submitReferenceResponse('t'.repeat(64), { answers, wouldRecommend: true, submittedAt: new Date() });

describe('A referee’s answers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.referenceRequest.updateMany.mockResolvedValue({ count: 1 });
  });

  it('stores only answers to the questions this request asked', async () => {
    liveRequest();

    await submit([...valid, { questionId: 'not-asked', answer: 'x'.repeat(4000) }]);

    const stored = prisma.referenceRequest.updateMany.mock.calls[0][0].data.responses.answers;
    expect(stored.map((a: { questionId: string }) => a.questionId)).toEqual(['q1', 'q2', 'q3']);
  });

  it('refuses a rating outside one to five, and a yes-or-no answered with text', async () => {
    liveRequest();
    await expect(submit([valid[0], { questionId: 'q2', answer: 400 }, valid[2]])).rejects.toMatchObject({ statusCode: 400 });

    liveRequest();
    await expect(submit([valid[0], valid[1], { questionId: 'q3', answer: 'an essay' }])).rejects.toMatchObject({
      statusCode: 400,
    });

    liveRequest();
    await expect(submit([...valid, { questionId: 'q4', answer: 'Something invented' }])).rejects.toMatchObject({
      statusCode: 400,
    });

    expect(prisma.referenceRequest.updateMany).not.toHaveBeenCalled();
  });

  it('counts a blank written answer as no answer to a required question', async () => {
    liveRequest();
    await expect(submit([{ questionId: 'q1', answer: '   ' }, valid[1], valid[2]])).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('answers 409, not a server error, for a reference already submitted or declined', async () => {
    liveRequest({ status: 'COMPLETED' });
    await expect(submit(valid)).rejects.toMatchObject({ statusCode: 409 });

    liveRequest({ status: 'DECLINED' });
    await expect(submit(valid)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('does not let a second submission racing the first overwrite it', async () => {
    liveRequest();
    prisma.referenceRequest.updateMany.mockResolvedValue({ count: 0 });

    await expect(submit(valid)).rejects.toMatchObject({ statusCode: 409 });
  });
});
