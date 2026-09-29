/**
 * The forums and the directory's opening services are platform content,
 * not member content, so they are put in place at start-up (upsert by
 * slug, so a redeploy updates the words and never duplicates a row) rather
 * than left to a seeding step someone has to remember.
 *
 * What a boot may change is the words, and only the words. The upsert used
 * to write isVerified and isActive on every start as well, which undid staff:
 * an admin who took a service out of the directory, or withdrew its Verified
 * mark, saw it back the next time the API restarted. And every seeded service
 * was created already carrying a Verified chip that no check had earned. A
 * service is now created unverified, like a member's own practice profile,
 * and waits in the same admin queue until someone has looked at it; after
 * that, whether it is listed and whether it is verified are staff decisions
 * no deploy overrides. The same holds for a forum staff have closed.
 */

import { prisma } from '../../utils/prisma';
import { logger } from '../../utils/logger';
import { FORUM_SEEDS, SERVICE_SEEDS } from './wellness-library';

export async function ensureWellnessCatalogue(): Promise<{ forums: number; services: number }> {
  let forums = 0;
  for (const f of FORUM_SEEDS) {
    const words = { name: f.name, topic: f.topic, description: f.description, guidelines: f.guidelines, sortOrder: f.sortOrder };
    await prisma.wellnessForum.upsert({
      where: { slug: f.slug },
      create: { slug: f.slug, ...words },
      update: words,
    });
    forums += 1;
  }
  let services = 0;
  for (const s of SERVICE_SEEDS) {
    // The descriptive fields a redeploy may refresh.
    const words = {
      name: s.name, kind: 'SERVICE' as const, headline: s.headline, bio: s.bio, specialties: s.specialties, phone: s.phone ?? null, website: s.website,
      state: s.state ?? null, city: s.city ?? null, telehealth: s.telehealth, inPerson: s.inPerson, bulkBilling: s.bulkBilling, medicareRebate: false, feeNote: s.feeNote,
      acceptsBookings: false, bookingUrl: s.website,
    };
    await prisma.healthPractitioner.upsert({
      where: { slug: s.slug },
      // Listed only once staff have verified it; see the note above.
      create: { slug: s.slug, ...words, isVerified: false, isActive: true },
      update: words,
    });
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
