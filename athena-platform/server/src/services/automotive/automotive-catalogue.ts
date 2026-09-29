/**
 * The starter catalogue, put in place at start-up — once, and never again
 * over the top of what the team has done since.
 *
 * This used to upsert every row of CAR_SEEDS by slug on each boot, writing
 * the literals in automotive-library over whatever was in the table. That was
 * the right call while the literals were the only way to change a figure, and
 * the wrong one the moment there was another: an admin who repriced a car or
 * recorded a new ANCAP result would have had it silently put back to the old
 * figure by the next deploy, with nothing in the audit trail to say so.
 *
 * So the starter rows are now created and left alone. `skipDuplicates` makes
 * the insert ON CONFLICT DO NOTHING on the unique slug, which means a row the
 * team has edited, retired or checked is never touched, and a model added to
 * the starter list in code still arrives on the next boot. Nothing in the
 * admin routes deletes a row or renames a slug (see catalogue-admin.service),
 * so a car the team took out of the catalogue cannot come back this way.
 *
 * A starter row carries CATALOGUE_AS_AT, the as-at the literals were written
 * against, and no source link; until someone at ATHENA checks it, the admin
 * catalogue page lists it as never checked. Ratings and reviews members add
 * are never touched.
 */

import { prisma } from '../../utils/prisma';
import { logger } from '../../utils/logger';
import { CAR_SEEDS, CATALOGUE_AS_AT, type CarSeed } from './automotive-library';

export function starterRow(s: CarSeed) {
  return {
    slug: s.slug, make: s.make, model: s.model, variant: s.variant ?? null, year: s.year, bodyType: s.bodyType, fuelType: s.fuelType, transmission: s.transmission ?? 'AUTOMATIC', seats: s.seats ?? 5,
    priceFrom: s.priceFrom, ancapStars: s.ancapStars ?? null, ancapYear: s.ancapYear ?? null, fuelPer100: s.fuelPer100 ?? null, kwhPer100: s.kwhPer100 ?? null, rangeKm: s.rangeKm ?? null,
    warrantyYears: s.warrantyYears, warrantyKm: s.warrantyKm, serviceIntervalMonths: s.serviceIntervalMonths, serviceIntervalKm: s.serviceIntervalKm, servicingCostYear: s.servicingCostYear ?? null,
    safetyFeatures: s.safetyFeatures, highlights: s.highlights, asAt: CATALOGUE_AS_AT, sourceUrl: null, isActive: true,
  };
}

/** Creates the starter rows the table does not have yet, and reports how many that was. */
export async function ensureCarCatalogue(): Promise<{ created: number; starter: number }> {
  const { count } = await prisma.carModel.createMany({ data: CAR_SEEDS.map(starterRow), skipDuplicates: true });
  return { created: count, starter: CAR_SEEDS.length };
}

let started = false;

/** Once, a little after boot, and never in tests. */
export function startCarCatalogue(): void {
  if (started || process.env.NODE_ENV === 'test') return;
  started = true;
  setTimeout(() => {
    ensureCarCatalogue()
      .then((r) => logger.info('Car catalogue starter rows in place', r))
      .catch((err) => logger.warn('Car catalogue starter rows could not be written', { error: (err as Error).message }));
  }, 25_000).unref();
}
