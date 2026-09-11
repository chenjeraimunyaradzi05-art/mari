/**
 * The forums and the directory's opening services are platform content,
 * not member content, so they are put in place at start-up (upsert by
 * slug, so a redeploy updates the words and never duplicates a row) rather
 * than left to a seeding step someone has to remember.
 */

import { prisma } from '../../utils/prisma';
import { logger } from '../../utils/logger';
import { FORUM_SEEDS, SERVICE_SEEDS } from './wellness-library';

export async function ensureWellnessCatalogue(): Promise<{ forums: number; services: number }> {
  let forums = 0;
  for (const f of FORUM_SEEDS) {
    await prisma.wellnessForum.upsert({
      where: { slug: f.slug },
      create: { slug: f.slug, name: f.name, topic: f.topic, description: f.description, guidelines: f.guidelines, sortOrder: f.sortOrder },
      update: { name: f.name, topic: f.topic, description: f.description, guidelines: f.guidelines, sortOrder: f.sortOrder, isActive: true },
    });
    forums += 1;
  }
  let services = 0;
  for (const s of SERVICE_SEEDS) {
    const data = {
      name: s.name, kind: 'SERVICE' as const, headline: s.headline, bio: s.bio, specialties: s.specialties, phone: s.phone ?? null, website: s.website,
      state: s.state ?? null, city: s.city ?? null, telehealth: s.telehealth, inPerson: s.inPerson, bulkBilling: s.bulkBilling, medicareRebate: false, feeNote: s.feeNote,
      acceptsBookings: false, isVerified: true, isActive: true, bookingUrl: s.website,
    };
    await prisma.healthPractitioner.upsert({ where: { slug: s.slug }, create: { slug: s.slug, ...data }, update: data });
    services += 1;
  }
  return { forums, services };
}

let started = false;

/** Once, a little after boot, and never in tests. */
export function startWellnessCatalogue(): void {
  if (started || process.env.NODE_ENV === 'test') return;
  started = true;
  setTimeout(() => {
    ensureWellnessCatalogue()
      .then((r) => logger.info('Wellness catalogue in place', r))
      .catch((err) => logger.warn('Wellness catalogue could not be written', { error: (err as Error).message }));
  }, 20_000).unref();
}
