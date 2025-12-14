import { NextRequest } from 'next/server';

const mockFind = jest.fn();
const mockUpdateScore = jest.fn();
const mockScoreLead = jest.fn();
const mockDeliver = jest.fn();
const mockRecordMetric = jest.fn();

jest.mock('../../src/lib/db', () => ({
  leadDb: {
    findById: (...args: unknown[]) => mockFind(...args),
    updateScore: (...args: unknown[]) => mockUpdateScore(...args),
  },
}));

jest.mock('../../src/lib/leadScoring', () => ({
  scoreLead: (...args: unknown[]) => mockScoreLead(...args),
}));

jest.mock('../../src/lib/leads/delivery', () => ({
  deliverWithRetries: (...args: unknown[]) => mockDeliver(...args),
}));

jest.mock('../../src/lib/metrics', () => ({
  ensureCorrelationId: () => 'corr-id',
  recordApiMetric: (...args: unknown[]) => mockRecordMetric(...args),
}));

jest.mock('../../src/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

import { POST } from '../../src/app/api/leads/deliver/route';

describe('API Handler: /api/leads/deliver', () => {
  beforeEach(() => {
    mockFind.mockReset();
    mockUpdateScore.mockReset();
    mockScoreLead.mockReset();
    mockDeliver.mockReset();
    mockRecordMetric.mockReset();
  });

  it('prices and delivers a lead payload', async () => {
    mockFind.mockResolvedValue({
      id: 'lead1',
      source: 'ad_campaign',
      tier: 'warm',
      createdAt: new Date().toISOString(),
      score: 0,
      priceCents: 0,
    });
    mockScoreLead.mockReturnValue({
      score: 80,
      tier: 'hot',
      priceCents: 12000,
      modelVersion: 'v0.2',
      explanation: { why: 'test' },
    });
    mockDeliver.mockResolvedValue({ status: 'delivered', attempts: 1, latencyMs: 12.3 });

    const req = {
      method: 'POST',
      headers: new Headers(),
      json: async () => ({ leadId: 'lead1', destinationUrl: 'https://example.com/hook' }),
    } as unknown as NextRequest;

    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.leadId).toBe('lead1');
    expect(body.priceCents).toBe(12000);
    expect(mockUpdateScore).toHaveBeenCalledWith('lead1', 80, 'hot', 12000, expect.anything());
    expect(mockDeliver).toHaveBeenCalled();
  });
});
