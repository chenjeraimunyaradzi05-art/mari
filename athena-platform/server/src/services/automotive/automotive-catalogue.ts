/**
 * The new-car catalogue is platform content, so it is put in place at
 * start-up (upsert by slug: a redeploy updates the figures and never
 * duplicates a row) rather than left to a seeding step someone has to
 * remember. Ratings and reviews members add are never touched.
 */

import { prisma } from '../../utils/prisma';
import { logger } from '../../utils/logger';
import { CAR_SEEDS, CATALOGUE_AS_AT } from './automotive-library';

export async function ensureCarCatalogue(): Promise<{ models: number }> {
  let models = 0;
  for (const s of CAR_SEEDS) {
    const data = {
      make: s.make, model: s.model, variant: s.variant ?? null, year: s.year, bodyType: s.bodyType, fuelType: s.fuelType, transmission: s.transmission ?? 'AUTOMATIC', seats: s.seats ?? 5,
      priceFrom: s.priceFrom, ancapStars: s.ancapStars ?? null, ancapYear: s.ancapYear ?? null, fuelPer100: s.fuelPer100 ?? null, kwhPer100: s.kwhPer100 ?? null, rangeKm: s.rangeKm ?? null,
      warrantyYears: s.warrantyYears, warrantyKm: s.warrantyKm, serviceIntervalMonths: s.serviceIntervalMonths, serviceIntervalKm: s.serviceIntervalKm, servicingCostYear: s.servicingCostYear ?? null,
      safetyFeatures: s.safetyFeatures, highlights: s.highlights, asAt: CATALOGUE_AS_AT, isActive: true,
    };
    await prisma.carModel.upsert({ where: { slug: s.slug }, create: { slug: s.slug, ...data }, update: data });
    models += 1;
  }
  return { models };
}

let started = false;

/** Once, a little after boot, and never in tests. */
export function startCarCatalogue(): void {
  if (started || process.env.NODE_ENV === 'test') return;
  started = true;
  setTimeout(() => {
    ensureCarCatalogue()
      .then((r) => logger.info('Car catalogue in place', r))
      .catch((err) => logger.warn('Car catalogue could not be written', { error: (err as Error).message }));
  }, 25_000).unref();
}
