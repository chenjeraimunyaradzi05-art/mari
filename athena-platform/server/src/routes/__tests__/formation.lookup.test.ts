import request from 'supertest';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    businessRegistration: { findUnique: jest.fn(), update: jest.fn() },
  },
}));

jest.mock('../../middleware/auth', () => {
  const actual: any = jest.requireActual('../../middleware/auth');
  return {
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      req.user = { id: 'staff', role: 'USER', email: 'staff@athena.com' };
      next();
    },
  };
});

jest.mock('../../middleware/rateLimiter', () => {
  const actual: any = jest.requireActual('../../middleware/rateLimiter');
  return { ...actual, createRateLimiter: () => (_req: any, _res: any, next: any) => next() };
});

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { isValidAbn, isValidAcn, formatAbn } from '../../services/abr.service';

const prisma: any = prismaTyped;

describe('ABN and ACN checksums', () => {
  it('accept the published examples and reject a digit out of place', () => {
    expect(isValidAbn('51 824 753 556')).toBe(true);
    expect(isValidAbn('51824753557')).toBe(false);
    expect(isValidAbn('1234')).toBe(false);
    expect(formatAbn('51824753556')).toBe('51 824 753 556');
    expect(isValidAcn('000 000 019')).toBe(true);
    expect(isValidAcn('004 085 616')).toBe(true);
    expect(isValidAcn('004085617')).toBe(false);
  });
});

describe('Formation lookups', () => {
  const originalGuid = process.env.ABR_GUID;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ABR_GUID;
  });

  afterEach(() => {
    if (originalGuid === undefined) delete process.env.ABR_GUID;
    else process.env.ABR_GUID = originalGuid;
    global.fetch = originalFetch;
  });

  it('checks the number even when the register is not configured, and says so', async () => {
    const res = await request(app).get('/api/formation/lookup/abn/51824753556').expect(200);
    expect(res.body.data).toMatchObject({ valid: true, configured: false, entity: null, formatted: '51 824 753 556' });

    const bad = await request(app).get('/api/formation/lookup/abn/123').expect(200);
    expect(bad.body.data).toMatchObject({ valid: false, entity: null });

    const acn = await request(app).get('/api/formation/lookup/acn/004085616').expect(200);
    expect(acn.body.data).toMatchObject({ valid: true, formatted: '004 085 616' });
    expect(acn.body.data.registerUrl).toContain('asic.gov.au');
  });

  it('reads the ABR record when a GUID is configured', async () => {
    process.env.ABR_GUID = 'test-guid';
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        'cb({"Abn":"51824753556","AbnStatus":"Active","AbnStatusEffectiveFrom":"2000-01-01","Acn":"004085616","EntityName":"EXAMPLE PTY LTD","EntityTypeName":"Australian Private Company","Gst":"2000-07-01","BusinessName":["Example Co"],"AddressState":"QLD","AddressPostcode":"4000"})',
    })) as any;

    const res = await request(app).get('/api/formation/lookup/abn/51 824 753 556').expect(200);
    expect(res.body.data.configured).toBe(true);
    expect(res.body.data.entity).toMatchObject({
      abn: '51824753556',
      abnStatus: 'Active',
      acn: '004085616',
      entityName: 'EXAMPLE PTY LTD',
      gstRegisteredFrom: '2000-07-01',
      businessNames: ['Example Co'],
      state: 'QLD',
    });
    const calledUrl = String((global.fetch as any).mock.calls[0][0]);
    expect(calledUrl).toContain('AbnDetails.aspx');
    expect(calledUrl).toContain('guid=test-guid');
  });

  it('name search without a GUID returns nothing rather than pretending', async () => {
    const res = await request(app).get('/api/formation/lookup/name?q=Example').expect(200);
    expect(res.body.data).toMatchObject({ configured: false, matches: [] });
  });

  it('a registration keeps only an ABN or ACN that passes its checksum', async () => {
    prisma.businessRegistration.findUnique.mockResolvedValue({ id: 'r1', userId: 'staff', status: 'DRAFT', businessName: 'Example', abn: null, acn: null });
    await request(app).patch('/api/formation/r1').send({ businessName: 'Example', abn: '12345678901' }).expect(400);
    expect(prisma.businessRegistration.update).not.toHaveBeenCalled();

    prisma.businessRegistration.update.mockImplementation(async ({ data }: any) => ({ id: 'r1', ...data }));
    await request(app).patch('/api/formation/r1').send({ businessName: 'Example', abn: '51 824 753 556', acn: '004 085 616' }).expect(200);
    expect(prisma.businessRegistration.update.mock.calls[0][0].data).toMatchObject({ abn: '51824753556', acn: '004085616' });
  });
});
