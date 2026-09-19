import request from 'supertest';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { ConsentType } from '@prisma/client';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    subprocessor: {
      findMany: jest.fn(async () => []),
    },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'member-1', role: 'USER', email: 'member-1@example.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { consentService } from '../../services/consent.service';
import { requireConsent } from '../../middleware/gdpr.middleware';

const prisma: any = prismaTyped;

const ENV_KEYS = ['AWS_REGION', 'BACKUP_AWS_REGIONS', 'CONTACT_DOMAIN', 'NEXT_PUBLIC_CONTACT_DOMAIN'] as const;
const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

function subprocessorRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub-1',
    name: 'Stripe',
    description: 'Payments',
    country: 'United States',
    isEUAdequate: false,
    transferMechanism: 'Standard Contractual Clauses',
    services: ['payments'],
    dataCategories: ['FINANCIAL'],
    securityCertifications: ['PCI DSS'],
    dpaSignedAt: null,
    dpaExpiresAt: null,
    isActive: true,
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('Compliance routes for a Queensland company', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    prisma.subprocessor.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
    jest.restoreAllMocks();
  });

  describe('GET /api/compliance/data-transfers', () => {
    it('publishes nothing when no region and no subprocessor is configured', async () => {
      const res = await request(app).get('/api/compliance/data-transfers');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeNull();
      expect(res.body.meta.status).toBe('not_published');
      // The invented Frankfurt/London answer must be gone for good.
      expect(JSON.stringify(res.body)).not.toMatch(/Frankfurt|London/);
    });

    it('derives the primary location from AWS_REGION and the overseas list from the register', async () => {
      process.env.AWS_REGION = 'ap-southeast-2';
      prisma.subprocessor.findMany.mockResolvedValue([
        subprocessorRow(),
        subprocessorRow({ id: 'sub-2', name: 'Local host', country: 'Australia', transferMechanism: null }),
      ]);

      const res = await request(app).get('/api/compliance/data-transfers');

      expect(res.status).toBe(200);
      expect(res.body.meta.status).toBe('published');
      expect(res.body.data.primaryDataLocation).toBe('Australia (AWS Sydney)');
      expect(res.body.data.backupLocations).toEqual([]);
      // An Australian provider is not an overseas disclosure under APP 8.
      expect(res.body.data.overseasDisclosures).toHaveLength(1);
      expect(res.body.data.overseasDisclosures[0]).toMatchObject({
        processor: 'Stripe',
        destination: 'United States',
        mechanism: 'Standard Contractual Clauses',
        dpaStatus: 'NOT_RECORDED',
      });
    });

    it('names backup regions only when they are configured', async () => {
      process.env.AWS_REGION = 'ap-southeast-2';
      process.env.BACKUP_AWS_REGIONS = 'ap-southeast-4, eu-west-2';

      const res = await request(app).get('/api/compliance/data-transfers');

      expect(res.body.data.backupLocations).toEqual([
        'Australia (AWS Melbourne)',
        'United Kingdom (AWS London)',
      ]);
    });
  });

  describe('GET /api/compliance/online-safety', () => {
    it('returns both regulators and applies the Australian regime by default', async () => {
      const res = await request(app).get('/api/compliance/online-safety');

      expect(res.status).toBe(200);
      expect(res.body.data.applicable).toBe('ANZ');
      expect(res.body.data.regimes.ANZ.regulator.name).toBe('eSafety Commissioner');
      expect(res.body.data.regimes.ANZ.act).toMatch(/Online Safety Act 2021/);
      expect(res.body.data.regimes.UK.regulator.name).toBe('Ofcom');
      expect(res.body.data.regimes.UK.act).toMatch(/Online Safety Act 2023/);
      expect(res.body.data.regime.regulator.url).toMatch(/esafety\.gov\.au/);
    });

    it('applies the UK regime for a UK caller', async () => {
      const res = await request(app).get('/api/compliance/online-safety?region=GB');

      expect(res.body.data.region).toBe('UK');
      expect(res.body.data.applicable).toBe('UK');
      expect(res.body.data.regime.regulator.name).toBe('Ofcom');
    });

    it('keeps /uk-safety answering as before and pointing at its replacement', async () => {
      const res = await request(app).get('/api/compliance/uk-safety');

      expect(res.status).toBe(200);
      expect(res.body.data.regulatorInfo.name).toBe('Ofcom');
      expect(res.body.data.supersededBy).toBe('/api/compliance/online-safety');
    });
  });

  describe('GET /api/compliance/privacy/:region', () => {
    it('returns the Australian Privacy Principles and the OAIC for ANZ', async () => {
      const res = await request(app).get('/api/compliance/privacy/ANZ');

      expect(res.status).toBe(200);
      expect(res.body.data.regime).toBe('APP');
      expect(res.body.data.regulator.shortName).toBe('OAIC');
      expect(res.body.data.regulator.complaintUrl).toMatch(/oaic\.gov\.au/);
      expect(res.body.data.responseDays).toBe(30);
      expect(res.body.data.statementUrl).toBe('/privacy/au');

      const principles = res.body.data.rights.map((right: { principle: string }) => right.principle);
      expect(principles).toEqual(expect.arrayContaining(['APP 12', 'APP 13', 'APP 7']));
    });

    it('treats a country code the same way as its region', async () => {
      const res = await request(app).get('/api/compliance/privacy/au');

      expect(res.body.data.region).toBe('ANZ');
      expect(res.body.data.regime).toBe('APP');
    });

    it('returns the GDPR set and the ICO for the UK', async () => {
      const res = await request(app).get('/api/compliance/privacy/UK');

      expect(res.body.data.regime).toBe('GDPR');
      expect(res.body.data.regulator.name).toMatch(/ICO/);
      expect(res.body.data.rights).toHaveLength(6);
      expect(res.body.data.statementUrl).toBe('/privacy/uk');
    });
  });

  describe('GET /api/compliance/gdpr', () => {
    it('never publishes a mailbox on a domain ATHENA does not own', async () => {
      const res = await request(app).get('/api/compliance/gdpr');

      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toContain('athena.com');
      expect(res.body.data.dpoContact).toBeNull();
      expect(res.body.data.config.dpoContact).toBeNull();
      expect(res.body.data.dpoContactRoute).toBe('/privacy-center');
    });

    it('publishes the DPO mailbox once a domain we own is configured', async () => {
      process.env.CONTACT_DOMAIN = 'example.org';

      const res = await request(app).get('/api/compliance/gdpr');

      expect(res.body.data.dpoContact).toBe('dpo@example.org');
    });
  });

  describe('GET /api/compliance/legal-documents', () => {
    it('lists the Australian Privacy Statement for an Australian member', async () => {
      const res = await request(app).get('/api/compliance/legal-documents?region=ANZ');

      const ids = res.body.data.map((doc: { id: string }) => doc.id);
      expect(ids).toContain('au-privacy-statement-v1');
      expect(ids).not.toContain('uk-privacy-addendum-v1');
    });

    it('does not show it to a UK member, who gets the UK addendum instead', async () => {
      const res = await request(app).get('/api/compliance/legal-documents?region=UK');

      const ids = res.body.data.map((doc: { id: string }) => doc.id);
      expect(ids).toContain('uk-privacy-addendum-v1');
      expect(ids).not.toContain('au-privacy-statement-v1');
    });
  });

  describe('requireConsent', () => {
    function fakeResponse() {
      const res: any = {};
      res.status = jest.fn(() => res);
      res.json = jest.fn(() => res);
      return res;
    }

    it('refuses an Australian member who has not agreed to marketing email', async () => {
      jest.spyOn(consentService, 'hasConsent').mockResolvedValue(false);
      const req: any = {
        gdpr: { isGDPRRegion: false, isUKRegion: false, region: 'AU', consent: {} },
        user: { id: 'member-1' },
      };
      const res = fakeResponse();
      const next = jest.fn();

      await requireConsent(ConsentType.MARKETING_EMAIL)(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'CONSENT_REQUIRED' }));
    });

    it('lets the same member through once the ledger records the consent', async () => {
      jest.spyOn(consentService, 'hasConsent').mockResolvedValue(true);
      const req: any = {
        gdpr: { isGDPRRegion: false, isUKRegion: false, region: 'AU', consent: {} },
        user: { id: 'member-1' },
      };
      const res = fakeResponse();
      const next = jest.fn();

      await requireConsent(ConsentType.MARKETING_EMAIL)(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
