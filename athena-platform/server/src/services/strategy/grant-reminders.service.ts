/**
 * Deadline reminders for grant applications, the "deadline reminders" the
 * blueprint's grant matching promises.
 *
 * A member who started an application and has not submitted it is told a
 * week out and again the day before, in her notifications. The reminder
 * is keyed on the application and the window so it is sent once per
 * window however often the sweep runs. The sweep is a daily interval in
 * the API process, like the message expiry sweep, so it needs no queue.
 */

import { prisma } from '../../utils/prisma';
import { logger } from '../../utils/logger';

const DAY = 86400000;

export interface ReminderCandidate {
  applicationId: string;
  userId: string;
  grantId: string;
  grantName: string;
  deadline: Date;
  daysLeft: number;
  window: 'week' | 'day';
}

export interface OpenApplicationLike {
  id: string;
  userId: string;
  status: string;
  grant: { id: string; name: string; deadline: Date | string | null; isActive?: boolean | null };
}

/** Which applications are inside a reminder window right now. */
export function findReminderCandidates(applications: OpenApplicationLike[], now = new Date()): ReminderCandidate[] {
  const out: ReminderCandidate[] = [];
  for (const a of applications) {
    if (a.status !== 'DRAFT' || !a.grant.deadline || a.grant.isActive === false) continue;
    const deadline = new Date(a.grant.deadline);
    const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / DAY);
    if (daysLeft < 0) continue;
    const window: ReminderCandidate['window'] | null = daysLeft <= 1 ? 'day' : daysLeft <= 7 ? 'week' : null;
    if (!window) continue;
    out.push({ applicationId: a.id, userId: a.userId, grantId: a.grant.id, grantName: a.grant.name, deadline, daysLeft, window });
  }
  return out;
}

export function reminderMessage(c: ReminderCandidate): { title: string; message: string } {
  const when = c.daysLeft <= 0 ? 'today' : c.daysLeft === 1 ? 'tomorrow' : `in ${c.daysLeft} days`;
  return {
    title: c.window === 'day' ? 'Grant closes tomorrow' : 'Grant closing soon',
    message: `Your application for "${c.grantName}" is still a draft and the grant closes ${when} (${c.deadline.toISOString().slice(0, 10)}). Submit it from the grants page.`,
  };
}

/** Send what is due, skipping anything already sent for the same window. */
export async function sendGrantDeadlineReminders(now = new Date()): Promise<{ candidates: number; sent: number }> {
  const horizon = new Date(now.getTime() + 8 * DAY);
  const applications = await prisma.grantApplication.findMany({
    where: { status: 'DRAFT', grant: { isActive: true, deadline: { gte: new Date(now.getTime() - DAY), lte: horizon } } },
    select: { id: true, userId: true, status: true, grant: { select: { id: true, name: true, deadline: true, isActive: true } } },
  });
  const candidates = findReminderCandidates(applications, now);
  if (candidates.length === 0) return { candidates: 0, sent: 0 };

  const recent = await prisma.notification.findMany({
    where: { type: 'SYSTEM', createdAt: { gte: new Date(now.getTime() - 9 * DAY) }, data: { path: ['kind'], equals: 'GRANT_DEADLINE' } },
    select: { data: true },
  });
  const already = new Set(recent.map((n) => { const d = n.data as { applicationId?: string; window?: string } | null; return `${d?.applicationId}:${d?.window}`; }));

  let sent = 0;
  for (const c of candidates) {
    if (already.has(`${c.applicationId}:${c.window}`)) continue;
    const { title, message } = reminderMessage(c);
    await prisma.notification.create({
      data: { userId: c.userId, type: 'SYSTEM', title, message, link: '/dashboard/grants', data: { kind: 'GRANT_DEADLINE', applicationId: c.applicationId, grantId: c.grantId, window: c.window, deadline: c.deadline.toISOString() } },
    });
    sent += 1;
  }
  return { candidates: candidates.length, sent };
}

let timer: NodeJS.Timeout | null = null;

/** Once a day, after a minute's grace at start-up. */
export function startGrantReminderSweeper(intervalMs = DAY): void {
  if (timer || process.env.NODE_ENV === 'test') return;
  const run = () => sendGrantDeadlineReminders().then((r) => { if (r.sent > 0) logger.info('Grant deadline reminders sent', r); }).catch((err) => logger.warn('Grant reminder sweep failed', { error: (err as Error).message }));
  setTimeout(run, 60_000).unref();
  timer = setInterval(run, intervalMs);
  timer.unref();
}

export function stopGrantReminderSweeper(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
