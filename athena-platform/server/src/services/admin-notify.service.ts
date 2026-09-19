/**
 * Tells the platform admins that something needs a person: a practitioner,
 * vendor, workshop or dealership waiting to be verified, a listing held by a
 * check. One in-app notification per admin, with the link that opens the
 * queue it belongs to.
 *
 * It never fails the request that raised it. A member who has just listed
 * her practice should see "saved", not an error because the admin list could
 * not be read; the queue page finds her record either way.
 *
 * automotive.routes.ts carries an older private copy of this (noteAdmins);
 * new callers should use this one.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

export type AdminNotice = {
  title: string;
  message: string;
  /** Where the admin lands when she opens it: the queue, not the record. */
  link: string;
  data?: Record<string, unknown>;
};

/** How many admins were told. Zero when there are none, or when it failed. */
export async function notifyAdmins(notice: AdminNotice): Promise<number> {
  try {
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true }, take: 10 });
    if (admins.length === 0) return 0;
    await prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        type: 'SYSTEM' as const,
        title: notice.title,
        message: notice.message,
        link: notice.link,
        data: (notice.data ?? {}) as Prisma.InputJsonValue,
      })),
    });
    return admins.length;
  } catch (error) {
    logger.warn('Could not notify the admins', { title: notice.title, error: error instanceof Error ? error.message : String(error) });
    return 0;
  }
}
