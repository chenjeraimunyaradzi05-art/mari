/**
 * When a practitioner was verified, by whom, and when she must be checked
 * again.
 *
 * Verification was a permanent switch. An admin looked a practitioner up on
 * the AHPRA register (or her professional body's, for kinds AHPRA does not
 * register), set isVerified, and nothing ever looked again: a psychologist
 * suspended or deregistered a year later stayed "Verified and listed",
 * taking bookings from women who might attach a scoped health-share link to
 * her. Registration is renewed every year, so the check has to be too.
 *
 * The record of a check is the audit row the verify route writes: who
 * approved, when, and what the profile said (name, kind, AHPRA number,
 * qualifications). HealthPractitioner has no verifiedAt column, so that row
 * is the only place the date lives, and it is read from there. A practitioner
 * verified before those rows were written has no record; she is treated as
 * checked when her profile was created, which is the earliest a check could
 * have happened, so she comes up for re-checking rather than being trusted
 * for ever. So that a directory full of such profiles does not all vanish on
 * the first run, none of them falls due before RECHECK_RULE_STARTED: they get
 * the same grace as anyone else to be looked at.
 *
 * The rule: a verification is good for RECHECK_AFTER_DAYS. After that the
 * admins are told she is due, and RECHECK_GRACE_DAYS later, unchecked, she
 * comes out of the directory and goes back into the approval queue, and she
 * is told why. An admin re-verifying her (the same PATCH that verified her the
 * first time) writes a fresh row and starts the year again.
 *
 * What this does not do is read the register itself. AHPRA publishes no API
 * for it; checking a number is a person searching the public register. That
 * is why the sweep hands the check to a person rather than pretending to
 * make it.
 */

import { AuditAction } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { logger } from '../../utils/logger';
import { logAudit } from '../../utils/audit';
import { recordFailure } from '../../utils/ops-metrics';
import { bestEffort } from '../../utils/best-effort';
import { notifyAdmins } from '../admin-notify.service';

/** How long a verification holds before the register is checked again. */
export const RECHECK_AFTER_DAYS = 365;
/** How long past that the listing stays up while staff get to it. */
export const RECHECK_GRACE_DAYS = 30;
/**
 * When yearly re-checking began. A practitioner with no record of her check
 * is due no earlier than this, rather than overdue the moment the rule
 * existed.
 */
export const RECHECK_RULE_STARTED = new Date('2026-09-27T00:00:00+10:00');

/** How often the sweep runs. A practitioner who fell due since the last run is news; one already due is not. */
export const RECHECK_SWEEP_INTERVAL_HOURS = 24;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** How many approval rows are read at once: every practitioner decision there has been, to a ceiling far above the directory's size. */
const APPROVAL_WINDOW = 5000;
/** How many verified practitioners one sweep reads. */
const VERIFIED_WINDOW = 2000;

export interface VerificationCheck {
  checkedAt: Date;
  checkedById: string | null;
}

const PRACTITIONER_APPROVAL = {
  action: AuditAction.ADMIN_VERIFICATION_APPROVE,
  metadata: { path: ['resourceType'], equals: 'HealthPractitioner' },
} as const;

/**
 * The latest approval of each practitioner, read from the audit rows the
 * verify route writes. With one id it asks for that practitioner alone.
 */
export async function lastVerificationChecks(ids: string[]): Promise<Map<string, VerificationCheck>> {
  const checks = new Map<string, VerificationCheck>();
  if (ids.length === 0) return checks;
  const wanted = new Set(ids);

  const rows = await prisma.auditLog.findMany({
    where:
      ids.length === 1
        ? { action: PRACTITIONER_APPROVAL.action, AND: [{ metadata: PRACTITIONER_APPROVAL.metadata }, { metadata: { path: ['resourceId'], equals: ids[0] } }] }
        : { action: PRACTITIONER_APPROVAL.action, metadata: PRACTITIONER_APPROVAL.metadata },
    select: { createdAt: true, actorUserId: true, metadata: true },
    orderBy: { createdAt: 'desc' },
    take: ids.length === 1 ? 1 : APPROVAL_WINDOW,
  });

  for (const row of rows) {
    const meta = row.metadata;
    const id = meta && typeof meta === 'object' && !Array.isArray(meta) ? (meta as Record<string, unknown>).resourceId : undefined;
    if (typeof id !== 'string' || !wanted.has(id) || checks.has(id)) continue;
    checks.set(id, { checkedAt: row.createdAt, checkedById: row.actorUserId });
  }
  return checks;
}

export type RecheckStatus = 'CURRENT' | 'DUE' | 'LAPSED';

export interface RecheckState {
  /** When an admin last approved her, or null when no record of it exists. */
  checkedAt: string | null;
  checkedById: string | null;
  /** True when the date the clock runs from is her profile's creation, for want of a record. */
  recordMissing: boolean;
  dueAt: string;
  lapsesAt: string;
  status: RecheckStatus;
}

export function recheckState(check: VerificationCheck | undefined, createdAt: Date, now: Date = new Date()): RecheckState {
  const due = check
    ? new Date(check.checkedAt.getTime() + RECHECK_AFTER_DAYS * DAY_MS)
    : new Date(Math.max(createdAt.getTime() + RECHECK_AFTER_DAYS * DAY_MS, RECHECK_RULE_STARTED.getTime()));
  const lapses = new Date(due.getTime() + RECHECK_GRACE_DAYS * DAY_MS);
  const status: RecheckStatus = now >= lapses ? 'LAPSED' : now >= due ? 'DUE' : 'CURRENT';
  return {
    checkedAt: check ? check.checkedAt.toISOString() : null,
    checkedById: check?.checkedById ?? null,
    recordMissing: !check,
    dueAt: due.toISOString(),
    lapsesAt: lapses.toISOString(),
    status,
  };
}

/** Every verified practitioner with where her check stands, the most urgent first. */
export async function verifiedPractitionerRechecks(now: Date = new Date()) {
  const verified = await prisma.healthPractitioner.findMany({
    where: { isVerified: true },
    select: { id: true, name: true, kind: true, ahpraNumber: true, ownerUserId: true, isActive: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
    take: VERIFIED_WINDOW,
  });
  const checks = await lastVerificationChecks(verified.map((p) => p.id));
  return verified
    .map((p) => ({ ...p, verification: recheckState(checks.get(p.id), p.createdAt, now) }))
    .sort((a, b) => a.verification.lapsesAt.localeCompare(b.verification.lapsesAt));
}

export interface RecheckSweepResult {
  verified: number;
  due: number;
  newlyDue: number;
  lapsed: number;
}

const names = (rows: Array<{ name: string }>) => {
  const shown = rows.slice(0, 5).map((r) => r.name).join(', ');
  return rows.length > 5 ? `${shown} and ${rows.length - 5} more` : shown;
};

/**
 * Take lapsed verifications out of the directory and tell the admins what is
 * due. Built to run daily on the scheduled-tasks worker. It never throws: a
 * failure is logged and put on the operations screen, and the next run starts
 * from the records again, so nothing is lost by a missed day except the
 * notice for anyone who fell due on it (the re-check list still shows her).
 */
export async function sweepPractitionerRechecks(now: Date = new Date()): Promise<RecheckSweepResult> {
  let rows: Awaited<ReturnType<typeof verifiedPractitionerRechecks>>;
  try {
    rows = await verifiedPractitionerRechecks(now);
  } catch (error) {
    logger.error('The practitioner re-check sweep could not read the verified practitioners', {
      error: error instanceof Error ? error.message : String(error),
    });
    recordFailure('wellness.practitioner-recheck', error);
    return { verified: 0, due: 0, newlyDue: 0, lapsed: 0 };
  }

  const since = now.getTime() - RECHECK_SWEEP_INTERVAL_HOURS * HOUR_MS;
  const due = rows.filter((r) => r.verification.status === 'DUE');
  const newlyDue = due.filter((r) => new Date(r.verification.dueAt).getTime() > since);
  const lapsing = rows.filter((r) => r.verification.status === 'LAPSED');

  const lapsed: typeof lapsing = [];
  for (const p of lapsing) {
    try {
      // Conditional, so a practitioner an admin re-verified a moment ago is
      // not taken down on the strength of the row read before she did.
      const { count } = await prisma.healthPractitioner.updateMany({ where: { id: p.id, isVerified: true }, data: { isVerified: false } });
      if (count === 0) continue;
      lapsed.push(p);
    } catch (error) {
      logger.error('A lapsed practitioner verification could not be withdrawn', {
        practitionerId: p.id,
        error: error instanceof Error ? error.message : String(error),
      });
      recordFailure('wellness.practitioner-recheck', error);
      continue;
    }

    await bestEffort('audit.wellness-practitioner-lapsed', () =>
      logAudit({
        action: AuditAction.ADMIN_VERIFICATION_REJECT,
        actorUserId: null,
        targetUserId: p.ownerUserId,
        metadata: {
          resourceType: 'HealthPractitioner',
          resourceId: p.id,
          isVerified: false,
          lapsed: true,
          reason: `Not re-checked within ${RECHECK_AFTER_DAYS + RECHECK_GRACE_DAYS} days of the last check`,
          lastCheckedAt: p.verification.checkedAt,
          recordMissing: p.verification.recordMissing,
        },
      })
    );
    if (p.ownerUserId) {
      await bestEffort('notification.wellness-practitioner-lapsed', () =>
        prisma.notification.create({
          data: {
            userId: p.ownerUserId!,
            type: 'SYSTEM',
            title: 'Your practice profile is waiting for its yearly check',
            message:
              'ATHENA checks every practitioner’s registration once a year, and yours was due. Your profile is out of the directory until an admin has checked it again; you do not need to change anything unless your details have changed.',
            link: '/dashboard/wellness/practice',
            data: { kind: 'WELLNESS_VERIFY_LAPSED' },
          },
        })
      );
    }
  }

  if (lapsed.length > 0) {
    await notifyAdmins({
      title: lapsed.length === 1 ? 'A practitioner is out of the directory until re-checked' : `${lapsed.length} practitioners are out of the directory until re-checked`,
      message: `${names(lapsed)} passed ${RECHECK_GRACE_DAYS} days after their yearly check fell due. They are back in the approval queue.`,
      link: '/admin/practitioners',
      data: { kind: 'WELLNESS_PRACTITIONER_LAPSED', practitionerIds: lapsed.slice(0, 20).map((p) => p.id) },
    });
  }
  if (newlyDue.length > 0) {
    await notifyAdmins({
      title: due.length === 1 ? 'A practitioner is due a yearly registration check' : `${due.length} practitioners are due their yearly registration check`,
      message: `Newly due: ${names(newlyDue)}. Look each one up on the AHPRA register (or their professional body's) and verify them again; anyone not re-checked within ${RECHECK_GRACE_DAYS} days comes out of the directory.`,
      link: '/admin/practitioners',
      data: { kind: 'WELLNESS_PRACTITIONER_RECHECK_DUE', practitionerIds: newlyDue.slice(0, 20).map((p) => p.id) },
    });
  }

  return { verified: rows.length, due: due.length, newlyDue: newlyDue.length, lapsed: lapsed.length };
}
