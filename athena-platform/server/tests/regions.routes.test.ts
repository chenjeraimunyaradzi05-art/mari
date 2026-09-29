import request from 'supertest';
import { describe, it, expect, jest } from '@jest/globals';

/**
 * GET /api/regions, which had no test of any kind.
 *
 * It is read before sign-in, by the onboarding and settings pages, to offer a
 * member her region, currency and language. Two things are worth holding in
 * place: that every region's defaults are among the values it says it
 * supports (a default outside the list is a picker whose preselected option
 * the server then refuses to save), and that the answer is configuration only
 * — the Stripe price ids live in the same module and have no business in a
 * public response.
 */

// The route reads configuration only; nothing here may open a database connection.
jest.mock('../src/utils/prisma', () => ({ prisma: {} }));

jest.mock('../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../src/index';
import { INTERFACE_LOCALES, isSupportedLocale } from '../src/config/regions';

interface Region {
  key: string;
  defaultLocale: string;
  defaultCurrency: string;
  supportedLocales: string[];
  supportedCurrencies: string[];
}

describe('GET /api/regions', () => {
  it('answers without signing in, with Australia and New Zealand in Australian dollars', async () => {
    const res = await request(app).get('/api/regions').expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.regions.ANZ).toEqual(
      expect.objectContaining({ defaultLocale: 'en-AU', defaultCurrency: 'AUD', supportedCurrencies: expect.arrayContaining(['AUD']) })
    );
  });

  it("gives every region defaults that are among its own supported values", async () => {
    const res = await request(app).get('/api/regions').expect(200);
    const regions = Object.values(res.body.data.regions as Record<string, Region>);

    expect(regions.length).toBeGreaterThan(0);
    for (const region of regions) {
      expect({ region: region.key, ok: region.supportedLocales.includes(region.defaultLocale) }).toEqual({ region: region.key, ok: true });
      expect({ region: region.key, ok: region.supportedCurrencies.includes(region.defaultCurrency) }).toEqual({ region: region.key, ok: true });
    }
  });

  it('lists every currency and locale a member can save, including the interface languages', async () => {
    const res = await request(app).get('/api/regions').expect(200);
    const { regions, supportedCurrencies, supportedLocales } = res.body.data as {
      regions: Record<string, Region>;
      supportedCurrencies: string[];
      supportedLocales: string[];
    };

    for (const region of Object.values(regions)) {
      expect(supportedCurrencies).toEqual(expect.arrayContaining(region.supportedCurrencies));
      expect(supportedLocales).toEqual(expect.arrayContaining(region.supportedLocales));
    }
    expect(supportedLocales).toEqual(expect.arrayContaining(INTERFACE_LOCALES));
    // The list the page offers is the list the server accepts on save.
    for (const locale of supportedLocales) expect(isSupportedLocale(locale)).toBe(true);
  });

  it('carries no payment configuration', async () => {
    const res = await request(app).get('/api/regions').expect(200);
    expect(JSON.stringify(res.body)).not.toMatch(/price_|STRIPE|sk_|pk_/i);
  });
});
