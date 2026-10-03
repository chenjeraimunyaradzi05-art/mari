/**
 * Hiding and showing a review of a practitioner, from wherever that is decided.
 *
 * A review comes out of a practitioner's average when a moderator hides it on
 * the practitioner's page (PATCH /api/wellness/reviews/:id) and, now that a
 * review can be reported, when the moderation queue decides a report of it
 * (content-report.service). Both are the same two writes: the flag on the row,
 * and the average and count the practitioner carries, which are cached on the
 * profile and order the directory. Either place forgetting the second write
 * would leave a practitioner ranked on a review nobody can see, so the two
 * writes live here and both callers use them.
 */

import { prisma } from '../../utils/prisma';

/**
 * The practitioner's average, asked of the database rather than assembled by
 * pulling every review row into memory and reducing over it. A practitioner
 * with nothing showing aggregates to _avg.rating === null; ratingAvg is a
 * non-null Decimal that the schema defaults to 0, so 0 is how "no ratings
 * yet" is stored, and ratingCount being 0 is what tells a page there is no
 * average to show.
 */
export async function practitionerRating(practitionerId: string): Promise<{ ratingAvg: number; ratingCount: number }> {
  const agg = await prisma.healthReview.aggregate({ where: { practitionerId, isHidden: false }, _avg: { rating: true }, _count: { rating: true } });
  return { ratingAvg: agg._avg.rating === null ? 0 : Math.round(agg._avg.rating * 10) / 10, ratingCount: agg._count.rating };
}

/**
 * Hide or show one review, and bring the practitioner's figures level with it.
 * Null when there is no such review, so a report decided on a review that has
 * since gone is not an error.
 */
export async function setReviewHidden(reviewId: string, isHidden: boolean): Promise<{ id: string; isHidden: boolean; practitionerId: string } | null> {
  const existing = await prisma.healthReview.findUnique({ where: { id: reviewId }, select: { id: true, practitionerId: true } });
  if (!existing) return null;
  const review = await prisma.healthReview.update({ where: { id: existing.id }, data: { isHidden } });
  await prisma.healthPractitioner.update({ where: { id: existing.practitionerId }, data: await practitionerRating(existing.practitionerId) });
  return { id: review.id, isHidden: review.isHidden, practitionerId: existing.practitionerId };
}
